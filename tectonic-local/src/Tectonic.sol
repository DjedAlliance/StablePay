// SPDX-License-Identifier: AEL
pragma solidity ^0.8.0;

import "./Math.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "./Coin.sol";
import "./IOracle.sol";
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract Tectonic is ERC20, ReentrancyGuard {
    IOracle public oracle;
    Coin public equityCoin;
    uint256 public constant D = 1e18; // Denominator for fixed-point calculations    
    uint256 public immutable superCriticalReserveRatio; // floor of the reserve ratio; below it, stablecoins are redeemed at a discount (see scPriceRedeem)
    uint256 public immutable criticalReserveRatio;
    uint256 public immutable safeReserveRatio;
    uint256 public constant numRedemptionIterations = 100; // max number of forced redemption iterations per mint/redeem call (to avoid out-of-gas errors in extreme cases) 
    uint256 public constant maxDailyStabilityFee = 548 * 1e12 ; // 0.0548% per day; ~20% per year
    uint256 public constant maxSpeculationFee = 10 * 1e16 ; // 10%
    uint256 public constant speculationPeriod = 10 * 1e16 ; // 10%

    address public immutable treasury;
    uint256 public immutable treasuryFee;
    uint256 public immutable fee;

    uint256 public volumeMint = 0;
    uint256 public volumeRedeem = 0;
    uint256 public volumenMintEC = 0;
    uint256 public volumenRedeemEC = 0;

    

    // TODO: implement positive interest on staked stable coins
    // TODO: implement speculation fee
    // TODO: implement limits on transactions that reduce reserve ratio (e.g. redeem, sell equity coins) when reserve ratio is below a certain threshold, to prevent the reserve ratio from dropping too quickly during times of low reserve.
    // TODO: implement volume based spreads for minting and redeeming stable coins to incentivize trading when the reserve ratio is low and disincentivize trading when the reserve ratio is high, to help stabilize the reserve ratio around the target.


    address[] public holders; // 1-based index, 0 is reserved for non-holders (to distinguish from the default value of the mapping)
    mapping(address => uint256) public holderIndexes;
    mapping(address => uint256) public timestamp; // timestamp of the last chargeStabilityFee action for each address

    function updateHolder(address a) internal {
        if (holderIndexes[a] == 0 && balanceOf(a) > 0) { // add new holder
            holders.push(a);
            holderIndexes[a] = holders.length - 1;
        } else if (holderIndexes[a] != 0 && balanceOf(a) == 0) { // remove former holder
            uint256 index = holderIndexes[a];
            address lastHolder = holders[holders.length - 1];
            holders[index] = lastHolder;
            holderIndexes[lastHolder] = index;
            holders.pop();
            holderIndexes[a] = 0;
        }
    }

    event Minted(address indexed minter, address indexed receiver, uint256 amountSC, uint256 amountBC);
    event Redeemed(address indexed redeemer, address indexed receiver, uint256 amountSC, uint256 amountBC);
    event MintedEquityCoins(address indexed minter, address indexed receiver, uint256 amountEC, uint256 amountBC);
    event RedeemedEquityCoins(address indexed redeemer, address indexed receiver, uint256 amountEC, uint256 amountBC);
    event ForcedRedemptions(uint256 totalRedeemedAmountSC, uint256 initialRatio, uint256 finalRatio, address indexed origin, uint256 refund);
    event ChargedStabilityFee(address indexed holder, uint256 feeAmount);
    event BatchChargedStabilityFee(uint256 start, uint256 iterations, uint256 totalFeeAmount, address indexed origin, uint256 refund);

    // Stablecoin supply created at deployment and owned by no address, so that
    // totalSupply() — and therefore L() — can never return to zero. See the
    // constructor for why this is tracked rather than minted.
    uint256 public immutable seedSupply;

    /// Includes the unowned seed, so the sum of balances is less than
    /// totalSupply() by exactly seedSupply.
    function totalSupply() public view override returns (uint256) {
        return super.totalSupply() + seedSupply;
    }

    constructor(address oracleAddress, address _treasury, uint256 _treasuryFee, uint256 _fee, uint256 _superCriticalReserveRatio, uint256 _criticalReserveRatio, uint256 _safeReserveRatio) ERC20("StableCoin", "SC") payable {
        require(D < _superCriticalReserveRatio && _superCriticalReserveRatio < _criticalReserveRatio && _criticalReserveRatio < _safeReserveRatio, "Tectonic: reserve ratios must satisfy 1 < superCritical < critical < safe");
        require(_treasury != address(0), "Tectonic: treasury cannot be the zero address"); // fees sent there would be burned
        treasury = _treasury; treasuryFee = _treasuryFee; fee = _fee;
        superCriticalReserveRatio = _superCriticalReserveRatio;
        criticalReserveRatio = _criticalReserveRatio;
        safeReserveRatio = _safeReserveRatio;
        oracle = IOracle(oracleAddress);

        // The deployment payment seeds both supplies. Nobody owns the seeded
        // coins, so nobody can redeem them, so the reserve and both supplies
        // are permanently non-zero and every quantity used as a denominator
        // stays well defined without per-call guards.
        //
        // Split evenly: half the payment backs stablecoins and the remainder
        // becomes equity. The split matters — backing the whole payment with
        // stablecoins would put L == R and leave equity at zero from the first
        // block, which is the very state this is meant to avoid. An even split
        // starts the protocol at a reserve ratio of exactly 2.
        require(msg.value > 0, "Tectonic: deployment must seed the reserve");
        uint256 scSeedValue = msg.value / 2;
        uint256 scPrice = oracle.readData();
        require(scPrice > 0, "Tectonic: oracle price must be positive");
        seedSupply = (msg.value * D) / (2 * scPrice); // multiply before dividing; equals (scSeedValue * D) / scPrice up to rounding
        require(seedSupply > 0, "Tectonic: seed too small to back a stablecoin");

        // No equity coins exist yet, so their price is 1 and the remaining
        // value maps one-to-one onto equity coin supply.
        equityCoin = new Coin("EquityCoin", "RC", msg.value - scSeedValue);

        holders.push(address(0)); // reserve 0 index for non-holders
    }

    // Reserve, Liabilities, Equity (in weis) and Reserve Ratio
    function R() public view returns (uint256) { return address(this).balance; }
    function L() public view returns (uint256) { return (totalSupply() * scPriceRedeem()) / D; }
    function E() public view returns (uint256) { return R() - L();}
    function ratio() public view returns (uint256) { return D * R() / L(); } // never below superCriticalReserveRatio, because of how scPriceRedeem() is defined
    function leverage() public view returns (uint256) { return D * L() / E(); }
    function cushion() public view returns (uint256) { return D * E() / L(); } // TODO
    function yieldFromStabilityFeeDaily() public view returns (uint256) { 
        return (stabilityFee() * totalSupply() * scPriceRedeem()) / (equityCoin.totalSupply() * ecPrice() * D);
    }    

    function mint(address receiver) external payable nonReentrant {
        if (ratio() < criticalReserveRatio) { _forceRedemptions(numRedemptionIterations); }
        uint256 scP = scPriceMint();
        uint256 amountBC = deductFees(msg.value);
        uint256 amountSC = (amountBC * D) / scP;
        _mint(receiver, amountSC);
        emit Minted(msg.sender, receiver, amountSC, msg.value);
    }

    function redeem(uint256 amountSC, address receiver) external nonReentrant {
        _redeem(amountSC, msg.sender, receiver);
    }
    // No `nonReentrant` here: every caller already holds the guard, and taking it
    // again reverts (OpenZeppelin's ReentrancyGuard rejects nested acquisition).
    function _redeem(uint256 amountSC, address from, address receiver) internal {
        uint256 scP = scPriceRedeem();
        uint256 value = (amountSC * scP) / D;
        uint256 amountBC = deductFees(value);
        _burn(from, amountSC);
        send(receiver, amountBC);
        emit Redeemed(from, receiver, amountSC, amountBC);
    }

    // Guarded entry point for external callers. The logic lives in
    // `_forceRedemptions` so that mint/mintEquityCoins/redeemEquityCoins, which
    // already hold the guard, can reuse it without re-entering it.
    function forceRedemptions(uint256 maxIterations) public nonReentrant {
        _forceRedemptions(maxIterations);
    }

    function _forceRedemptions(uint256 maxIterations) internal {
        // Nothing to redeem from. Required by the seeded supply: the seed is
        // owned by no address, so the protocol now starts with a positive
        // stablecoin supply and an empty holder set, and the index arithmetic
        // below would compute `% 0` and panic.
        if (holders.length <= 1) return;

        uint256 gasStart = gasleft();
        uint256 iterations = 0;
        uint256 totalRedeemedAmountSC = 0;
        uint256 initialRatio = ratio();
        // Only the starting index for fairness among holders; which holders get redeemed is not a
        // secret worth protecting, so a predictable source is acceptable.
        // slither-disable-next-line weak-prng
        uint256 i = 1 + (uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender))) % (holders.length - 1)); // choose a pseudo-random starting index to ensure fairness among holders
        while (ratio() < criticalReserveRatio && iterations < maxIterations && gasleft() > gasStart / 2) {
            address h = holders[i];
            uint256 b = balanceOf(h);
            _redeem(b, h, h);
            totalRedeemedAmountSC += b;
            iterations++;
            i++; if (i >= holders.length) { i = 1; }
        }
        uint256 finalRatio = ratio();
        uint256 refund = Math.min((gasStart - gasleft()) * block.basefee, totalRedeemedAmountSC * scPriceRedeem() / 1000 / D); // cap refund to 0.1% of the total amount redeemed
        emit ForcedRedemptions(totalRedeemedAmountSC, initialRatio, finalRatio, tx.origin, refund);
        if (refund > 0 && iterations > 0) { send(tx.origin, refund);}
    }

    function balanceOfAfterStabilityFee(address a) public view returns (uint256) {
        return balanceOf(a) - stabilityFeeAmount(a);
    }

    function stabilityFee() public view returns (uint256) { 
        uint256 r = ratio(); // r is always greater than or equal to superCriticalReserveRatio, because of how scPriceRedeem() is defined.
        if (r > safeReserveRatio) return 0; // no stability fee when reserve ratio is above the safe threshold, to avoid penalizing users when the system has sufficient reserves
        else return ((safeReserveRatio - r) * maxDailyStabilityFee) / (safeReserveRatio - superCriticalReserveRatio); // fee approaches maxDailyStabilityFee as the reserve ratio approaches its floor (superCriticalReserveRatio), to strongly incentivize redeeming stablecoins to increase the reserve ratio during times of low reserve.
    }

    function stabilityFeeAmount(address a) public view returns (uint256) {
        uint256 t = block.timestamp - timestamp[a];
        uint256 f = stabilityFee();
        // slither-disable-next-line incorrect-equality
        if (f == 0) return 0; // shortcut only: the formula below also yields 0 when f == 0
        else return (balanceOf(a) * f * t) / (D * 1 days);
    }

    function chargeStabilityFee(address a) public returns (uint256) {
        uint256 feeAmount = stabilityFeeAmount(a);
        // The timestamp is recorded before the burn, not after. `_burn` triggers
        // `_update`, which calls this function again; if the timestamp had not
        // moved yet the fee would recompute as non-zero and burn again, decaying
        // the balance geometrically until the transaction runs out of gas. It
        // fires whenever a fee is owed, i.e. once the reserve ratio reaches
        // safeReserveRatio, so it would revert every transfer, mint and redeem.
        // Recording first makes the re-entrant call see zero elapsed time.
        timestamp[a] = block.timestamp;
        if (feeAmount > 0) _burn(a, feeAmount);
        emit ChargedStabilityFee(a, feeAmount);
        return feeAmount;
    }

    function chargeStabilityFeeForManyHolders(uint256 start, uint256 maxIterations) public {
        uint256 gasStart = gasleft();
        uint256 l = holders.length - 1; // exclude 0 index which is reserved for non-holders
        uint256 iterations = 0;
        uint256 i = 1 + start; if (i >= holders.length) { i = 1; }
        uint256 totalFeeCharged = 0;
        while (iterations < maxIterations && iterations < l && gasleft() > gasStart / 2) { // stop if we've iterated through all holders or if we've used more than half of the remaining gas to avoid out-of-gas errors
            uint256 f = chargeStabilityFee(holders[i]);
            totalFeeCharged += f;
            iterations++;
            i++; if (i >= holders.length) { i = 1; }
        }
        uint256 refund = Math.min((gasStart - gasleft()) * block.basefee, totalFeeCharged / 1000); // cap refund to 0.1% of the total fee charged to avoid draining the contract in extreme cases
        emit BatchChargedStabilityFee(start, iterations, totalFeeCharged, tx.origin, refund);
        if (refund > 0) send(tx.origin, refund);
    }

    function mintEquityCoins(address receiver) external payable nonReentrant {
        if (ratio() < criticalReserveRatio) { _forceRedemptions(numRedemptionIterations); }
        uint256 rcBP = ecPrice();
        uint256 amountBC = deductFees(msg.value);
        uint256 amountRC = (amountBC * D) / rcBP;
        equityCoin.mint(receiver, amountRC);
        emit MintedEquityCoins(msg.sender, receiver, amountRC, msg.value);
    }

    function redeemEquityCoins(uint256 amountRC, address receiver) external nonReentrant {
        require(equityCoin.balanceOf(msg.sender) >= amountRC, "redeemEquityCoin: insufficient balance");
        uint256 value = (amountRC * ecPrice()) / D;
        uint256 amountBC = deductFees(value);
        equityCoin.burn(msg.sender, amountRC);
        send(receiver, amountBC);
        emit RedeemedEquityCoins(msg.sender, receiver, amountRC, amountBC);
        if (ratio() < criticalReserveRatio) { _forceRedemptions(numRedemptionIterations); }
    }

    function deductFees(uint256 value) internal returns (uint256) {
        uint256 f = (value * fee) / D;
        uint256 fT = (value * treasuryFee) / D;
        send(treasury, fT); // transfer(address(this), f); // this happens implicitly, and thus `f` is effectively transfered to the reserve.
        return value - f - fT; // amountBC
    }

    function scPriceMint() public view returns (uint256) { // price in weis for 1 whole coin.
        return oracle.readData();
    }

    // Let q = R / (N_SC * P_target_SC) and r_supcrit = superCriticalReserveRatio. Then:
    //   P_redeem_SC = P_target_SC                 if q >= r_supcrit
    //   P_redeem_SC = (1 / r_supcrit) * R / N_SC  if q <  r_supcrit
    // q < r_supcrit is equivalent to R / (r_supcrit * N_SC) < P_target_SC, so this is
    // the minimum of the two. Below the threshold, L = R / r_supcrit and the reserve
    // ratio is pinned at r_supcrit instead of falling to 100%, so equity never reaches 0.
    function scPriceRedeem() public view returns (uint256) { // price in weis for 1 whole coin.
        // slither-disable-next-line calls-loop
        uint256 scTargetPrice = oracle.readData(); // reached in a loop via chargeStabilityFeeForManyHolders, bounded by maxIterations and gas
        uint256 sSC = totalSupply();
        return sSC == 0 ? scTargetPrice : Math.min(scTargetPrice, (R() * D * D) / (superCriticalReserveRatio * sSC));
    }

    // P_EC = E / N_EC for any q. Since E = R - L, this gives N_SC * P_redeem_SC + N_EC * P_EC = R,
    // and when q < r_supcrit it equals ((r_supcrit - 1) / r_supcrit) * R / N_EC.
    // Hence E >= ((r_supcrit - 1) / r_supcrit) * R > 0 whenever R > 0.
    function ecPrice() public view returns (uint256){ // price in weis for 1 whole coin.
        uint256 sRC = equityCoin.totalSupply();
        return equityCoin.totalSupply() == 0 ? D : (E() * D) / sRC;
    }

    function send(address receiver, uint256 amount) internal {
        // slither-disable-next-line calls-loop
        (bool success, ) = payable(receiver).call{value: amount}(""); // reached in a loop via _forceRedemptions, bounded by maxIterations and gas
        require(success, "Transfer failed.");
    }

    // Override _update to charge stability fee before all token transfers, mints, and burns
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0)) chargeStabilityFee(from);
        if (to != address(0)) chargeStabilityFee(to);
        super._update(from, to, amount);
        if (from != address(0)) updateHolder(from);
        if (to != address(0)) updateHolder(to);
    }
}
