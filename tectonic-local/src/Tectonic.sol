// SPDX-License-Identifier: AEL
pragma solidity ^0.8.0;

// =============================================================================
// LOCAL DEVELOPMENT FORK of StabilityNexus/Tectonic-EVM-Contracts/src/Tectonic.sol
// Forked at upstream commit e657330.
//
// PURPOSE: unblock StablePay integration work before the upstream contract is
// finished. This is NOT the canonical Tectonic implementation. Do not deploy to
// a public network. When upstream is complete, delete this fork and point the
// SDK at the real deployment.
//
// PATCHES APPLIED (each marked `PATCH n` inline). All are minimal and preserve
// upstream behaviour wherever the upstream behaviour is well-defined:
//
//   1. ratio() reverted with division-by-zero whenever L() == 0 (i.e. at zero
//      stablecoin supply). Because mint() and mintEquityCoins() both read
//      ratio() before doing anything, the very first mint on a fresh deployment
//      always reverted and the contract could never be bootstrapped.
//      Fix: return type(uint256).max when L() == 0 ("infinitely reserved"),
//      which is the mathematically correct limit and makes every
//      `ratio() < threshold` guard evaluate false at zero supply.
//
//   2. Nested ReentrancyGuard. _redeem was `internal nonReentrant` while its
//      only callers (redeem, forceRedemptions) were themselves nonReentrant, so
//      OpenZeppelin's guard reverted on the nested entry: redeem() could never
//      succeed. Likewise mint / mintEquityCoins / redeemEquityCoins call
//      forceRedemptions, which was `public nonReentrant`.
//      Fix: drop nonReentrant from the internal _redeem, and split
//      forceRedemptions into a guarded external entry point plus an unguarded
//      internal _forceRedemptions used by the already-guarded callers.
//
//   3. forceRedemptions computed `% (holders.length - 1)` which reverts with
//      panic 0x12 when there are no holders (length == 1, index 0 being the
//      address(0) sentinel).
//      Fix: return early when there are no holders.
//
//   4. leverage() and cushion() divided by E() and L() without zero checks.
//      Fix: guard both. Purely informational views; no economic change.
//
//   5. ecPrice() was `internal`, so no off-chain caller could read the equity
//      coin price. Fix: make it `public`. (Requested upstream; see doc 06.)
//
//   6. yieldFromStabilityFeeDaily() divided by equityCoin.totalSupply(), which
//      is zero before any equity coin is minted. Fix: guard.
//
//   7. stabilityFeeAmount() measured accrual from timestamp[a], which defaults
//      to 0 (the UNIX epoch) for an address that has never been charged. A
//      brand-new holder receiving coins while r <= rsafe would be assessed a
//      ~56-year fee window and have their entire balance burned.
//      Fix: return 0 when timestamp[a] == 0 (the accrual window opens on first
//      charge, which _update performs on receipt), and cap the fee at the
//      holder's balance as a belt-and-braces invariant.
//      NOTE: this is a behavioural change, not just a guard. Upstream must
//      decide the intended semantics; flag it in the bug report.
//
//   8. chargeStabilityFee() burned first and recorded timestamp[a] afterwards.
//      Because _burn triggers _update, which calls chargeStabilityFee again,
//      and the timestamp had not yet moved, the fee recomputed as non-zero on
//      every level: unbounded recursion ending only in out-of-gas. It fires
//      whenever a fee is owed, so every transfer, mint and redeem reverted
//      once the reserve ratio reached rsafe and any time had passed.
//      Fix: write the timestamp before the burn, so the re-entrant call sees
//      t = 0. Found by test_ChargingAFeeDoesNotRecurseUntilOutOfGas.
//
//   9. The constructor validated none of the parameter constraints the paper
//      states in section 2.11. In particular rsafe == D makes stabilityFee()
//      divide by zero on every operation, bricking the deployment with no
//      signal at deploy time. Fix: require the documented bounds, plus
//      non-zero oracle and treasury addresses.
//
//   3b. forceRedemptions advanced its index immediately after a redemption,
//      but updateHolder backfills the vacated slot by swapping in the last
//      holder — so that holder was passed over for the rest of the sweep.
//      Coverage still worked out because the index wraps, so this is a
//      robustness fix rather than a live defect. Fix: only advance when the
//      slot was not backfilled.
//
//  10. A stability fee is burned inside _update before the outer burn or
//      transfer moves its amount, so any amount sized from the pre-fee
//      balance reverts with ERC20InsufficientBalance once a fee is owed.
//      _forceRedemptions read balanceOf(h) and then redeemed exactly that,
//      so the sweep — and with it every mint / mintEquityCoins /
//      redeemEquityCoins that triggers it — reverted whenever the protocol
//      was below rcrit (where a fee is always owed) and any time had passed.
//      redeem(balanceOf(msg.sender), ...) failed the same way.
//      Fix: settle the fee before sizing. _redeem charges the fee before it
//      prices the redemption, and the sweep charges each holder before it
//      reads their balance. External callers of redeem() must pass at most
//      balanceOfAfterStabilityFee(msg.sender).
//
//  11. A forced redemption paid the holder with a reverting send(). Holders
//      are arbitrary addresses, so one contract whose receive() reverts (or
//      burns the forwarded gas) made every sweep revert — and with it every
//      mint / mintEquityCoins / redeemEquityCoins below rcrit, i.e. the
//      protocol could not recover its ratio.
//      Fix: forced payouts use a gas-capped call that cannot revert the
//      sweep. A payout that fails is credited to unclaimedBC[holder] and
//      withdrawn later via claimUnpaidRedemption(). Credited basecoin belongs
//      to the holder, not the protocol, so R() excludes totalUnclaimedBC.
//
//  12. ecPrice() is 0 when E() == 0 (reserve fully committed to
//      liabilities). mintEquityCoins then divided by zero (panic 0x12) and
//      redeemEquityCoins burned the caller's equity coins for 0 basecoin.
//      Fix: explicit reverts in both paths, same treatment as PATCH 6.
//
//   Minor additions by the fork (not bug fixes): holderCount() view for tests
//   and SDK use; send() no-ops on zero amount to avoid pointless calls to the
//   treasury when treasuryFee == 0; equity coin symbol "RC" -> "EC".
//
// NOT patched (deliberately out of scope — these are upstream design questions,
// tracked in documentation/docs/05-tectonic-contract-status.md):
//   - speculation fee, staking interest, tx limits, volume-based spreads (TODO)
//   - forceRedemptions being permissionless and refunding gas to tx.origin
//   - absence of a Djed-style UI fee
// =============================================================================

import "./Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Coin.sol";
import "./IOracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Tectonic is ERC20, ReentrancyGuard {
    IOracle public oracle;
    Coin public equityCoin;
    uint256 public constant D = 1e18; // Denominator for fixed-point calculations
    uint256 public immutable criticalReserveRatio;
    uint256 public immutable safeReserveRatio;
    uint256 public constant numRedemptionIterations = 100; // max forced redemptions per mint/redeem call
    uint256 public constant maxDailyStabilityFee = 548 * 1e12; // 0.0548% per day; ~20% per year
    uint256 public constant maxSpeculationFee = 10 * 1e16; // 10% (unused: TODO upstream)
    uint256 public constant speculationPeriod = 10 * 1e16; // (unused: TODO upstream)

    address public immutable treasury;
    uint256 public immutable treasuryFee;
    uint256 public immutable fee;

    uint256 public volumeMint = 0;
    uint256 public volumeRedeem = 0;
    uint256 public volumenMintEC = 0;
    uint256 public volumenRedeemEC = 0;

    // TODO(upstream): positive interest on staked stable coins
    // TODO(upstream): speculation fee
    // TODO(upstream): limits on transactions that reduce the reserve ratio when it is already low
    // TODO(upstream): volume based spreads for minting and redeeming stable coins

    address[] public holders; // 1-based index; 0 is reserved for non-holders
    mapping(address => uint256) public holderIndexes;
    mapping(address => uint256) public timestamp; // last chargeStabilityFee time per address

    /// PATCH 11: basecoin owed to holders whose forced-redemption payout
    /// failed. Held by the contract on their behalf, never part of the reserve.
    mapping(address => uint256) public unclaimedBC;
    uint256 public totalUnclaimedBC;

    /// PATCH 11: gas forwarded to a holder receiving a forced-redemption
    /// payout. Enough for an EOA or a typical smart-contract wallet's
    /// receive(); a holder needing more is credited and claims it themselves
    /// with as much gas as they like. Bounding it stops a holder from burning
    /// the sweep's gas, and the assembly call in _payOrCredit stops them from
    /// returning a huge revert payload for the caller to copy.
    uint256 public constant forcedPayoutGasLimit = 50_000;

    function updateHolder(address a) internal {
        if (holderIndexes[a] == 0 && balanceOf(a) > 0) {
            // add new holder
            holders.push(a);
            holderIndexes[a] = holders.length - 1;
        } else if (holderIndexes[a] != 0 && balanceOf(a) == 0) {
            // remove former holder
            uint256 index = holderIndexes[a];
            address lastHolder = holders[holders.length - 1];
            holders[index] = lastHolder;
            holderIndexes[lastHolder] = index;
            holders.pop();
            holderIndexes[a] = 0;
        }
    }

    /// @notice Number of stablecoin holders (excluding the address(0) sentinel).
    /// @dev Added by the fork: lets the SDK and tests reason about forced-redemption
    ///      eligibility without indexing the raw array.
    function holderCount() public view returns (uint256) {
        return holders.length - 1;
    }

    event Minted(address indexed minter, address indexed receiver, uint256 amountSC, uint256 amountBC);
    event Redeemed(address indexed redeemer, address indexed receiver, uint256 amountSC, uint256 amountBC);
    event MintedEquityCoins(address indexed minter, address indexed receiver, uint256 amountEC, uint256 amountBC);
    event RedeemedEquityCoins(address indexed redeemer, address indexed receiver, uint256 amountEC, uint256 amountBC);
    event ForcedRedemptions(
        uint256 totalRedeemedAmountSC, uint256 initialRatio, uint256 finalRatio, address indexed origin, uint256 refund
    );
    event ChargedStabilityFee(address indexed holder, uint256 feeAmount);
    event ForcedPayoutDeferred(address indexed holder, uint256 amountBC);
    event ClaimedUnpaidRedemption(address indexed holder, address indexed receiver, uint256 amountBC);
    event BatchChargedStabilityFee(uint256 start, uint256 iterations, uint256 totalFeeAmount, address indexed origin, uint256 refund);

    constructor(
        address oracleAddress,
        address _treasury,
        uint256 _treasuryFee,
        uint256 _fee,
        uint256 _criticalReserveRatio,
        uint256 _safeReserveRatio
    ) ERC20("StableCoin", "SC") payable {
        // PATCH 9: validate the parameter constraints the paper states in
        // section 2.11 (non-negative fees summing below 1, and
        // 1 < rcrit < rsafe < 2). Upstream accepts any values, so a deployment
        // with rsafe == D makes stabilityFee() divide by zero on every
        // transfer, mint and redeem — a permanently bricked contract with no
        // signal at deploy time. Failing here costs one transaction; failing
        // later costs the deployment.
        require(oracleAddress != address(0), "Tectonic: oracle is the zero address");
        require(_treasury != address(0), "Tectonic: treasury is the zero address");
        require(_fee + _treasuryFee < D, "Tectonic: fees consume the entire payment");
        require(_criticalReserveRatio > D, "Tectonic: rcrit must exceed 1");
        require(_safeReserveRatio > _criticalReserveRatio, "Tectonic: rsafe must exceed rcrit");
        require(_safeReserveRatio < 2 * D, "Tectonic: rsafe must be below 2");

        equityCoin = new Coin("EquityCoin", "EC");
        treasury = _treasury;
        treasuryFee = _treasuryFee;
        fee = _fee;
        criticalReserveRatio = _criticalReserveRatio;
        safeReserveRatio = _safeReserveRatio;
        oracle = IOracle(oracleAddress);
        holders.push(address(0)); // reserve index 0 for non-holders
    }

    // ---------------------------------------------------------------------
    // Reserve, Liabilities, Equity (in wei) and Reserve Ratio
    // ---------------------------------------------------------------------

    /// PATCH 11: basecoin credited to holders by a failed forced payout is
    /// owed to them, so it is not reserve. Counting it would overstate R(),
    /// E() and ratio(), and let the next sweep stop before the ratio is
    /// genuinely restored. The subtraction cannot underflow: a credit is only
    /// recorded for basecoin that stayed in the contract, and only leaves it
    /// when the credit is cleared.
    function R() public view returns (uint256) {
        return address(this).balance - totalUnclaimedBC;
    }

    function L() public view returns (uint256) {
        return (totalSupply() * scPriceRedeem()) / D;
    }

    function E() public view returns (uint256) {
        return R() - L();
    }

    /// PATCH 1: with no liabilities the reserve ratio is unbounded. Upstream
    /// divided by zero here, which made the first mint on a fresh deployment
    /// revert and left the contract permanently unusable.
    function ratio() public view returns (uint256) {
        uint256 l = L();
        if (l == 0) return type(uint256).max;
        return D * R() / l;
    }

    /// PATCH 4: guard division by zero (informational view only).
    function leverage() public view returns (uint256) {
        uint256 e = E();
        if (e == 0) return type(uint256).max;
        return D * L() / e;
    }

    /// PATCH 4: guard division by zero (informational view only).
    function cushion() public view returns (uint256) {
        uint256 l = L();
        if (l == 0) return type(uint256).max;
        return D * E() / l;
    }

    /// PATCH 6: guard division by zero before any equity coin exists.
    function yieldFromStabilityFeeDaily() public view returns (uint256) {
        uint256 ecSupply = equityCoin.totalSupply();
        if (ecSupply == 0) return 0;
        uint256 p = ecPrice();
        if (p == 0) return 0;
        return (stabilityFee() * totalSupply() * scPriceRedeem()) / (ecSupply * p * D);
    }

    // ---------------------------------------------------------------------
    // Stablecoin operations
    // ---------------------------------------------------------------------

    function mint(address receiver) external payable nonReentrant {
        if (ratio() < criticalReserveRatio) {
            _forceRedemptions(numRedemptionIterations); // PATCH 2
        }
        uint256 scP = scPriceMint();
        uint256 amountBC = deductFees(msg.value);
        uint256 amountSC = (amountBC * D) / scP;
        _mint(receiver, amountSC);
        emit Minted(msg.sender, receiver, amountSC, msg.value);
    }

    /// @notice Redeem `amountSC` stablecoins for basecoin.
    /// @dev Any stability fee owed is burned first (PATCH 10), so `amountSC`
    ///      must not exceed balanceOfAfterStabilityFee(msg.sender) — passing
    ///      balanceOf(msg.sender) reverts with ERC20InsufficientBalance while a
    ///      fee is owed. Read the post-fee figure in the same block if
    ///      redeeming everything; the fee keeps accruing with time.
    function redeem(uint256 amountSC, address receiver) external nonReentrant {
        _redeem(amountSC, msg.sender, receiver);
    }

    /// PATCH 2: `nonReentrant` removed. Every caller is already guarded; the
    /// nested acquisition made redeem() and all forced redemptions revert.
    function _redeem(uint256 amountSC, address from, address receiver) internal {
        uint256 amountBC = _burnForRedemption(amountSC, from);
        send(receiver, amountBC);
        emit Redeemed(from, receiver, amountSC, amountBC);
    }

    /// PATCH 10: settle `from`'s stability fee BEFORE pricing and burning.
    ///
    /// The fee is burned inside _update ahead of the outer burn, so without
    /// this the burn of `amountSC` runs against `balance - fee` and reverts.
    /// Charging here also means the redemption is priced off the post-fee
    /// supply, i.e. the scPriceRedeem() the burn actually executes against.
    /// The charge that _burn's _update performs afterwards sees t = 0 and is a
    /// no-op.
    ///
    /// Returns the basecoin owed to the redeemer; the caller pays it.
    function _burnForRedemption(uint256 amountSC, address from) internal returns (uint256 amountBC) {
        chargeStabilityFee(from);
        uint256 scP = scPriceRedeem();
        uint256 value = (amountSC * scP) / D;
        amountBC = deductFees(value);
        _burn(from, amountSC);
    }

    /// PATCH 2: external guarded entry point; internal logic split out so that
    /// already-guarded callers (mint, mintEquityCoins, redeemEquityCoins) can
    /// reuse it without re-entering the guard.
    function forceRedemptions(uint256 maxIterations) external nonReentrant {
        _forceRedemptions(maxIterations);
    }

    function _forceRedemptions(uint256 maxIterations) internal {
        uint256 n = holderCount();
        if (n == 0) return; // PATCH 3: upstream computed `% 0` and reverted

        uint256 gasStart = gasleft();
        uint256 iterations = 0;
        uint256 totalRedeemedAmountSC = 0;
        uint256 initialRatio = ratio();
        // pseudo-random starting index for fairness among holders
        uint256 i = 1 + (uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender))) % n);
        while (ratio() < criticalReserveRatio && iterations < maxIterations && gasleft() > gasStart / 2) {
            if (holderCount() == 0) break; // PATCH 3: supply fully redeemed
            if (i >= holders.length) i = 1;

            address h = holders[i];
            uint256 lengthBefore = holders.length;

            // PATCH 10: settle the fee before reading the balance to redeem.
            // Reading first and redeeming that figure reverts whenever a fee
            // is owed, which below rcrit is always. If the fee consumes the
            // whole balance the holder leaves the set here (swap-and-pop),
            // which the lengthBefore check below already accounts for.
            chargeStabilityFee(h);
            uint256 b = balanceOf(h);

            if (b > 0) {
                uint256 amountBC = _burnForRedemption(b, h);
                // PATCH 11: an unpayable holder is credited, not allowed to
                // revert the sweep that every under-reserved mint relies on.
                _payOrCredit(h, amountBC);
                emit Redeemed(h, h, b, amountBC);
                totalRedeemedAmountSC += b;
            }
            iterations++;

            // PATCH 3b: updateHolder removes a holder by swapping the last
            // entry into the vacated slot, so after a redemption index `i`
            // holds a different, unvisited holder. Advancing unconditionally
            // would pass over them for the remainder of this sweep. Coverage
            // still worked out in practice because the index wraps, but
            // re-examining the slot matches the evident intent and makes the
            // traversal independent of the wrap arithmetic.
            if (holders.length == lengthBefore) i++;
        }
        uint256 finalRatio = ratio();
        // refund capped at 0.1% of the total amount redeemed
        uint256 refund =
            Math.min((gasStart - gasleft()) * block.basefee, totalRedeemedAmountSC * scPriceRedeem() / 1000 / D);
        emit ForcedRedemptions(totalRedeemedAmountSC, initialRatio, finalRatio, tx.origin, refund);
        if (refund > 0 && iterations > 0) send(tx.origin, refund);
    }

    // ---------------------------------------------------------------------
    // Stability fees
    // ---------------------------------------------------------------------

    function balanceOfAfterStabilityFee(address a) public view returns (uint256) {
        return balanceOf(a) - stabilityFeeAmount(a);
    }

    function stabilityFee() public view returns (uint256) {
        uint256 r = ratio(); // r >= D by construction of L()
        if (r > safeReserveRatio) return 0;
        return ((safeReserveRatio - r) * maxDailyStabilityFee) / (safeReserveRatio - D);
    }

    function stabilityFeeAmount(address a) public view returns (uint256) {
        uint256 f = stabilityFee();
        if (f == 0) return 0;
        uint256 last = timestamp[a];
        if (last == 0) return 0; // never charged: no accrual window yet
        uint256 t = block.timestamp - last;
        uint256 amount = (balanceOf(a) * f * t) / (D * 1 days);
        return Math.min(amount, balanceOf(a)); // never burn more than the balance
    }

    /// PATCH 8: the timestamp is written BEFORE the burn.
    ///
    /// Upstream burned first and recorded the timestamp afterwards, which is
    /// unbounded recursion: _burn triggers _update, _update calls
    /// chargeStabilityFee(from) again, and because timestamp[a] has not been
    /// updated yet the fee recomputes as non-zero every level. The balance
    /// decays geometrically rather than reaching zero, so the recursion only
    /// ends when the transaction runs out of gas.
    ///
    /// It fires whenever a fee is actually owed — i.e. whenever the reserve
    /// ratio is at or below rsafe and any time has passed — so every transfer,
    /// mint and redeem reverts in precisely the stressed conditions the
    /// stability fee exists to handle.
    ///
    /// Writing the effect before the interaction makes the re-entrant call
    /// compute t = 0, so it returns 0 and terminates immediately.
    function chargeStabilityFee(address a) public returns (uint256) {
        uint256 feeAmount = stabilityFeeAmount(a);
        timestamp[a] = block.timestamp; // effect before interaction
        if (feeAmount > 0) _burn(a, feeAmount);
        emit ChargedStabilityFee(a, feeAmount);
        return feeAmount;
    }

    function chargeStabilityFeeForManyHolders(uint256 start, uint256 maxIterations) external nonReentrant {
        uint256 l = holderCount();
        if (l == 0) return;

        uint256 gasStart = gasleft();
        uint256 iterations = 0;
        uint256 i = 1 + start;
        if (i >= holders.length) i = 1;
        uint256 totalFeeCharged = 0;
        while (iterations < maxIterations && iterations < l && gasleft() > gasStart / 2) {
            totalFeeCharged += chargeStabilityFee(holders[i]);
            iterations++;
            i++;
            if (i >= holders.length) i = 1;
        }
        uint256 refund = Math.min((gasStart - gasleft()) * block.basefee, totalFeeCharged / 1000);
        emit BatchChargedStabilityFee(start, iterations, totalFeeCharged, tx.origin, refund);
        if (refund > 0) send(tx.origin, refund);
    }

    // ---------------------------------------------------------------------
    // Equity coin operations
    // ---------------------------------------------------------------------

    function mintEquityCoins(address receiver) external payable nonReentrant {
        if (ratio() < criticalReserveRatio) {
            _forceRedemptions(numRedemptionIterations); // PATCH 2
        }
        uint256 rcBP = ecPrice();
        // PATCH 12: ecPrice() is 0 when E() == 0; the division below would
        // panic with 0x12. Fail with a reason instead. Pricing new equity
        // against worthless existing equity is an upstream design question
        // (Djed answers it with a minimum price), not something to guess here.
        require(rcBP > 0, "Tectonic: equity is exhausted, equity coins cannot be priced");
        uint256 amountBC = deductFees(msg.value);
        uint256 amountRC = (amountBC * D) / rcBP;
        equityCoin.mint(receiver, amountRC);
        emit MintedEquityCoins(msg.sender, receiver, amountRC, msg.value);
    }

    function redeemEquityCoins(uint256 amountRC, address receiver) external nonReentrant {
        require(equityCoin.balanceOf(msg.sender) >= amountRC, "redeemEquityCoin: insufficient balance");
        uint256 value = (amountRC * ecPrice()) / D;
        // PATCH 12: with ecPrice() == 0 (E() == 0), or an amount too small to
        // be worth a wei, the coins below would be burned for nothing and the
        // call would still succeed. Refuse rather than silently take them.
        require(value > 0, "Tectonic: equity coins would be redeemed for nothing");
        uint256 amountBC = deductFees(value);
        equityCoin.burn(msg.sender, amountRC);
        send(receiver, amountBC);
        emit RedeemedEquityCoins(msg.sender, receiver, amountRC, amountBC);
        if (ratio() < criticalReserveRatio) {
            _forceRedemptions(numRedemptionIterations); // PATCH 2
        }
    }

    // ---------------------------------------------------------------------
    // Pricing
    // ---------------------------------------------------------------------

    function deductFees(uint256 value) internal returns (uint256) {
        uint256 f = (value * fee) / D;
        uint256 fT = (value * treasuryFee) / D;
        send(treasury, fT); // `f` stays in the contract, i.e. in the reserve
        return value - f - fT;
    }

    /// price in wei for 1 whole stablecoin
    function scPriceMint() public view returns (uint256) {
        return oracle.readData();
    }

    /// price in wei for 1 whole stablecoin
    function scPriceRedeem() public view returns (uint256) {
        uint256 scTargetPrice = oracle.readData();
        uint256 sSC = totalSupply();
        return sSC == 0 ? scTargetPrice : Math.min(scTargetPrice, (R() * D) / sSC);
    }

    /// PATCH 5: was `internal`; made public so the SDK can price equity coins.
    /// Returns 0 when E() == 0 (the reserve is fully committed to
    /// liabilities); every caller must handle that (PATCH 6, PATCH 12).
    function ecPrice() public view returns (uint256) {
        uint256 sRC = equityCoin.totalSupply();
        return sRC == 0 ? D : (E() * D) / sRC;
    }

    function send(address receiver, uint256 amount) internal {
        if (amount == 0) return;
        (bool success,) = payable(receiver).call{value: amount}("");
        require(success, "Transfer failed.");
    }

    /// PATCH 11: pay a force-redeemed holder without letting them revert or
    /// starve the sweep. Gas is capped at forcedPayoutGasLimit and no return
    /// data is copied. On failure the basecoin stays in the contract as a
    /// credit the holder withdraws with claimUnpaidRedemption().
    function _payOrCredit(address holder, uint256 amount) internal {
        if (amount == 0) return;
        bool success;
        uint256 gasLimit = forcedPayoutGasLimit;
        assembly ("memory-safe") {
            success := call(gasLimit, holder, amount, 0, 0, 0, 0)
        }
        if (!success) {
            unclaimedBC[holder] += amount;
            totalUnclaimedBC += amount;
            emit ForcedPayoutDeferred(holder, amount);
        }
    }

    /// @notice Withdraw basecoin from a forced redemption whose payout failed.
    /// @dev PATCH 11. Pull-based, with the caller choosing the receiver and
    ///      forwarding all gas, so a holder contract that cannot accept a push
    ///      can still collect to another address. Effects before the transfer.
    function claimUnpaidRedemption(address receiver) external nonReentrant {
        uint256 amount = unclaimedBC[msg.sender];
        require(amount > 0, "Tectonic: nothing to claim");
        unclaimedBC[msg.sender] = 0;
        totalUnclaimedBC -= amount;
        send(receiver, amount);
        emit ClaimedUnpaidRedemption(msg.sender, receiver, amount);
    }

    /// Charge stability fees before all token transfers, mints and burns, and
    /// keep the holder set in sync afterwards.
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0)) chargeStabilityFee(from);
        if (to != address(0)) chargeStabilityFee(to);
        super._update(from, to, amount);
        if (from != address(0)) updateHolder(from);
        if (to != address(0)) updateHolder(to);
    }
}
