// SPDX-License-Identifier: AEL
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {Tectonic} from "../src/Tectonic.sol";
import {MockOracle} from "../src/MockOracle.sol";

/// @notice Tests for tectonic-local, StablePay's copy of the Tectonic contracts.
///
/// tectonic-local/src is synced verbatim from
/// DeveloperAmrit/Tectonic-EVM-Contracts @ fix-4-6-fresh (cd459dd). These tests
/// exercise that code as StablePay uses it; they do not patch it.
///
/// Tests tagged SDK pin the arithmetic that tectonic-sdk reimplements in JS.
/// If one of these changes, the SDK's cost calculation must change with it.
///
/// Tests tagged UPSTREAM BUG pin a known defect of the synced contract with
/// vm.expectRevert, so they double as an executable bug report. When the fix
/// lands upstream and is synced here, the test fails: replace it with a test of
/// the fixed behaviour.
contract TectonicTest is Test {
    Tectonic tectonic;
    MockOracle oracle;

    address treasury = makeAddr("treasury");
    address merchant = makeAddr("merchant");
    address consumer = makeAddr("consumer");
    address lp = makeAddr("equityProvider");

    uint256 constant D = 1e18;
    uint256 constant FEE = 15 * 1e15; // 1.5%
    uint256 constant TREASURY_FEE = 5 * 1e15; // 0.5%
    uint256 constant SUPER_CRITICAL_RATIO = 11 * 1e17; // 1.1
    uint256 constant CRITICAL_RATIO = 12 * 1e17; // 1.2
    uint256 constant SAFE_RATIO = 15 * 1e17; // 1.5
    uint256 constant INITIAL_PRICE = 5 * 1e14; // 0.0005 BC per SC
    uint256 constant SEED = 10 ether; // sent with the deployment, as DeployLocal does

    function setUp() public {
        oracle = new MockOracle(INITIAL_PRICE);
        tectonic = _deploy(SEED);
        vm.deal(consumer, 1000 ether);
        vm.deal(lp, 1000 ether);
        vm.deal(merchant, 1 ether);
    }

    function _deploy(uint256 seed) internal returns (Tectonic) {
        return new Tectonic{value: seed}(
            address(oracle), treasury, TREASURY_FEE, FEE, SUPER_CRITICAL_RATIO, CRITICAL_RATIO, SAFE_RATIO
        );
    }

    // -----------------------------------------------------------------
    // Deployment and bootstrap
    // -----------------------------------------------------------------

    /// The deployment payment is split evenly into an unowned stablecoin seed
    /// and an unowned equity seed, so both supplies start non-zero and the
    /// protocol starts at a reserve ratio of exactly 2.
    function test_DeploymentSeedsBothSuppliesAtRatioTwo() public view {
        assertEq(tectonic.R(), SEED, "the whole payment is reserve");
        assertEq(tectonic.seedSupply(), (SEED * D) / (2 * INITIAL_PRICE), "stablecoin seed backs half the payment");
        assertEq(tectonic.totalSupply(), tectonic.seedSupply(), "only the unowned seed exists");
        assertEq(tectonic.equityCoin().totalSupply(), SEED - SEED / 2, "equity seed is the other half at price 1");
        assertEq(tectonic.ratio(), 2 * D, "starts at ratio 2");
        assertEq(_holderCount(), 0, "nobody owns the seed");
    }

    function test_FirstMintSucceedsOnFreshDeployment() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);
        assertGt(tectonic.balanceOf(consumer), 0, "stablecoins were minted");
        assertEq(_holderCount(), 1);
    }

    function test_FirstEquityMintSucceedsOnFreshDeployment() public {
        uint256 before = tectonic.equityCoin().totalSupply();
        vm.prank(lp);
        tectonic.mintEquityCoins{value: 10 ether}(lp);
        assertGt(tectonic.equityCoin().balanceOf(lp), 0);
        assertGt(tectonic.equityCoin().totalSupply(), before);
    }

    /// The seed is owned by no address, so the holder set starts empty while
    /// the supply is positive. The sweep must return instead of computing `% 0`.
    function test_ForceRedemptionsWithNoHoldersIsANoop() public {
        assertEq(_holderCount(), 0);
        tectonic.forceRedemptions(10); // must not revert
    }

    // -----------------------------------------------------------------
    // Constructor validation
    // -----------------------------------------------------------------

    string constant RATIO_ORDER = "Tectonic: reserve ratios must satisfy 1 < superCritical < critical < safe";

    function test_ConstructorRejectsSuperCriticalRatioAtOrBelowOne() public {
        vm.expectRevert(bytes(RATIO_ORDER));
        new Tectonic{value: SEED}(address(oracle), treasury, TREASURY_FEE, FEE, D, CRITICAL_RATIO, SAFE_RATIO);
    }

    function test_ConstructorRejectsSuperCriticalRatioAtOrAboveCritical() public {
        vm.expectRevert(bytes(RATIO_ORDER));
        new Tectonic{value: SEED}(
            address(oracle), treasury, TREASURY_FEE, FEE, CRITICAL_RATIO, CRITICAL_RATIO, SAFE_RATIO
        );
    }

    function test_ConstructorRejectsCriticalRatioAtOrAboveSafe() public {
        vm.expectRevert(bytes(RATIO_ORDER));
        new Tectonic{value: SEED}(
            address(oracle), treasury, TREASURY_FEE, FEE, SUPER_CRITICAL_RATIO, SAFE_RATIO, SAFE_RATIO
        );
    }

    function test_ConstructorRejectsZeroTreasury() public {
        vm.expectRevert("Tectonic: treasury cannot be the zero address");
        new Tectonic{value: SEED}(
            address(oracle), address(0), TREASURY_FEE, FEE, SUPER_CRITICAL_RATIO, CRITICAL_RATIO, SAFE_RATIO
        );
    }

    function test_ConstructorRejectsAnUnseededDeployment() public {
        vm.expectRevert("Tectonic: deployment must seed the reserve");
        _deploy(0);
    }

    function test_ConstructorRejectsASeedTooSmallToBackAStablecoin() public {
        // seedSupply = seed * D / (2 * price) floors to 0 once 2 * price > seed * D.
        oracle.setPrice(D);
        vm.expectRevert("Tectonic: seed too small to back a stablecoin");
        _deploy(1);
    }

    function test_ConstructorAcceptsValidParameters() public view {
        assertEq(tectonic.superCriticalReserveRatio(), SUPER_CRITICAL_RATIO);
        assertEq(tectonic.criticalReserveRatio(), CRITICAL_RATIO);
        assertEq(tectonic.safeReserveRatio(), SAFE_RATIO);
        assertEq(tectonic.fee(), FEE);
        assertEq(tectonic.treasuryFee(), TREASURY_FEE);
    }

    // -----------------------------------------------------------------
    // Core operations
    // -----------------------------------------------------------------

    function test_RedeemSucceeds() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);

        uint256 balance = tectonic.balanceOf(consumer);
        uint256 bcBefore = consumer.balance;

        vm.prank(consumer);
        tectonic.redeem(balance, consumer);

        assertEq(tectonic.balanceOf(consumer), 0, "stablecoins burned");
        assertGt(consumer.balance, bcBefore, "basecoin returned");
    }

    /// This is StablePay's native-payment flow: the consumer pays, the merchant
    /// receives the stablecoins, in a single transaction.
    function test_MintCreditsAThirdPartyReceiver() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(merchant);

        assertGt(tectonic.balanceOf(merchant), 0, "merchant holds the stablecoins");
        assertEq(tectonic.balanceOf(consumer), 0, "consumer holds none");
    }

    function test_TreasuryReceivesItsFee() public {
        uint256 before = treasury.balance;
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(merchant);
        assertEq(treasury.balance - before, 1 ether * TREASURY_FEE / D, "treasury fee transferred out");
    }

    function test_ProtocolFeeStaysInTheReserve() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(merchant);
        // Everything except the treasury fee remains in the contract.
        assertEq(tectonic.R(), SEED + 1 ether - (1 ether * TREASURY_FEE / D), "protocol fee retained");
    }

    /// Direct stablecoin payment: the merchant is paid by ERC-20 transfer.
    function test_DirectTransferPath() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);
        uint256 amount = tectonic.balanceOf(consumer) / 2;

        vm.prank(consumer);
        assertTrue(tectonic.transfer(merchant, amount), "transfer reported success");

        assertEq(tectonic.balanceOf(merchant), amount, "merchant paid in full");
    }

    // -----------------------------------------------------------------
    // SDK arithmetic — these pin what tectonic-sdk computes off-chain
    // -----------------------------------------------------------------

    /// SDK: the cost formula. required = ceil(amountSC * scPrice / (D - fee - treasuryFee))
    /// The merchant must never be short-changed, so the SDK rounds up.
    function test_SDK_CostFormulaNeverUnderpaysTheMerchant() public {
        uint256 amountSC = 100 * 1e18; // invoice: 100 stablecoins
        uint256 required = _requiredBC(amountSC);

        vm.prank(consumer);
        tectonic.mint{value: required}(merchant);

        assertGe(tectonic.balanceOf(merchant), amountSC, "merchant received at least the invoiced amount");
    }

    /// SDK: same property across a wide range of invoice sizes and prices.
    function testFuzz_SDK_CostFormulaNeverUnderpaysTheMerchant(uint96 rawAmount, uint96 rawPrice) public {
        uint256 amountSC = uint256(rawAmount);
        uint256 price = uint256(rawPrice);
        vm.assume(amountSC > 1e12 && amountSC < 1e24);
        vm.assume(price > 1e8 && price < 1e20);

        oracle.setPrice(price);
        uint256 required = _requiredBC(amountSC);
        vm.assume(required < 500 ether); // keep the funded consumer solvent

        vm.deal(consumer, 1000 ether);
        vm.prank(consumer);
        tectonic.mint{value: required}(merchant);

        assertGe(tectonic.balanceOf(merchant), amountSC, "merchant never short-changed");
    }

    /// SDK: the overpayment introduced by rounding up stays negligible — the
    /// consumer should not be visibly overcharged to protect the merchant.
    function test_SDK_RoundingOverpaymentIsNegligible() public {
        uint256 amountSC = 100 * 1e18;
        uint256 required = _requiredBC(amountSC);

        vm.prank(consumer);
        tectonic.mint{value: required}(merchant);

        uint256 received = tectonic.balanceOf(merchant);
        // Within one part in 10^12 of the invoice.
        assertLe(received - amountSC, amountSC / 1e12 + 1, "overpayment is dust");
    }

    /// Mirrors tectonic-sdk's calculateRequiredBC(). Keep the two in sync.
    function _requiredBC(uint256 amountSC) internal view returns (uint256) {
        uint256 scP = tectonic.scPriceMint();
        uint256 netFactor = D - FEE - TREASURY_FEE;
        uint256 numerator = amountSC * scP;
        uint256 required = (numerator + netFactor - 1) / netFactor; // ceil
        return required + 1; // 1 wei safety margin against downstream flooring
    }

    // -----------------------------------------------------------------
    // Stability fees
    // -----------------------------------------------------------------

    function test_NoStabilityFeeWhenWellReserved() public {
        vm.prank(lp);
        tectonic.mintEquityCoins{value: 100 ether}(lp);
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);

        assertGt(tectonic.ratio(), SAFE_RATIO, "ratio is above the safe threshold");
        assertEq(tectonic.stabilityFee(), 0, "no fee charged");

        vm.warp(block.timestamp + 30 days);
        assertEq(tectonic.stabilityFeeAmount(consumer), 0, "nothing accrues");
    }

    /// _update charges the receiver before crediting them, at a zero balance,
    /// which opens their accrual window on receipt rather than at the epoch.
    function test_NewHolderIsNotChargedForTimeBeforeTheyHeldCoins() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);
        _depressRatioBelowSafe();

        uint256 balance = tectonic.balanceOf(consumer);
        assertGt(tectonic.stabilityFee(), 0, "we are below the safe threshold");
        assertEq(tectonic.stabilityFeeAmount(consumer), 0, "no retroactive accrual");
        assertEq(tectonic.balanceOfAfterStabilityFee(consumer), balance);
    }

    function test_StabilityFeeAccruesOverTimeWhenUnderReserved() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);
        _depressRatioBelowSafe();

        uint256 balance = tectonic.balanceOf(consumer);
        vm.warp(block.timestamp + 10 days);

        uint256 accrued = tectonic.stabilityFeeAmount(consumer);
        assertGt(accrued, 0, "fee accrued");
        assertLt(accrued, balance, "fee never exceeds the balance");
        assertEq(tectonic.balanceOfAfterStabilityFee(consumer), balance - accrued);
    }

    /// chargeStabilityFee records the timestamp before burning, so the
    /// re-entrant charge from _burn -> _update sees zero elapsed time.
    function test_ChargingAFeeDoesNotRecurseUntilOutOfGas() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);
        _depressRatioBelowSafe();
        vm.warp(block.timestamp + 10 days);

        assertGt(tectonic.stabilityFeeAmount(consumer), 0, "a fee is genuinely owed");

        uint256 gasBefore = gasleft();
        tectonic.chargeStabilityFee(consumer);
        uint256 gasUsed = gasBefore - gasleft();

        assertLt(gasUsed, 200_000, "charging a fee is a bounded operation");
        assertEq(tectonic.stabilityFeeAmount(consumer), 0, "the accrual window reset");
    }

    /// A StablePay direct payment with a fee owed: the sender must pay from
    /// their post-fee balance.
    function test_TransferWithAFeeOwedDoesNotRunOutOfGas() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);
        _depressRatioBelowSafe();
        vm.warp(block.timestamp + 10 days);

        uint256 amount = tectonic.balanceOfAfterStabilityFee(consumer) / 2;
        vm.prank(consumer);
        assertTrue(tectonic.transfer(merchant, amount), "transfer succeeded");
        assertEq(tectonic.balanceOf(merchant), amount, "merchant received the full amount");
    }

    function test_StabilityFeeIsBurnedWhenCharged() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);
        _depressRatioBelowSafe();
        vm.warp(block.timestamp + 10 days);

        uint256 supplyBefore = tectonic.totalSupply();
        tectonic.chargeStabilityFee(consumer);
        assertLt(tectonic.totalSupply(), supplyBefore, "supply shrank");
    }

    // -----------------------------------------------------------------
    // Triggered redemptions
    // -----------------------------------------------------------------

    /// A mint that finds the protocol below critical runs the sweep first,
    /// inside the same guarded call, instead of reverting.
    function test_MintBelowCriticalRatioTriggersRedemptionsInsteadOfReverting() public {
        _twoHoldersBelowCritical();

        // Kept small relative to the reserve: msg.value is in R() before the
        // threshold is tested, so a large payment lifts the ratio by itself
        // and no redemption is triggered.
        address newBuyer = makeAddr("newBuyer");
        vm.deal(newBuyer, 10 ether);
        vm.prank(newBuyer);
        tectonic.mint{value: 0.01 ether}(newBuyer);

        assertTrue(
            tectonic.balanceOf(consumer) == 0 || tectonic.balanceOf(merchant) == 0,
            "a prior holder was force-redeemed"
        );
        assertGt(tectonic.balanceOf(newBuyer), 0, "new buyer still received their coins");
    }

    function test_ForcedRedemptionPaysTheHolderInBasecoin() public {
        _twoHoldersBelowCritical();
        uint256 consumerBC = consumer.balance;
        uint256 merchantBC = merchant.balance;

        tectonic.forceRedemptions(10);

        assertGe(tectonic.ratio(), CRITICAL_RATIO, "the sweep restored the ratio");
        assertTrue(consumer.balance > consumerBC || merchant.balance > merchantBC, "a redeemed holder was paid out");
    }

    /// FINDING: a mint can pass the critical-ratio check and still leave the
    /// protocol below the critical ratio afterwards. msg.value is in the
    /// reserve before the check, then the coins are issued at the target price,
    /// pulling the ratio back down. "After a mint, r >= rcrit" is therefore not
    /// an invariant, and the next operation will trigger redemptions —
    /// possibly against the merchant who just received these coins.
    function test_MintPassesTheCheckYetLeavesTheRatioBelowCritical() public {
        vm.prank(consumer);
        tectonic.mint{value: 5 ether}(consumer);
        _depressRatioBelowCritical();
        uint256 heldBefore = tectonic.balanceOf(consumer);

        address whale = makeAddr("whale");
        vm.deal(whale, 100 ether);
        vm.prank(whale);
        tectonic.mint{value: 10 ether}(whale);

        assertEq(tectonic.balanceOf(consumer), heldBefore, "no redemption was triggered");
        assertLt(tectonic.ratio(), CRITICAL_RATIO, "issuance diluted the ratio below critical");
        assertGe(tectonic.ratio(), SUPER_CRITICAL_RATIO, "but never below the super-critical floor");
    }

    /// UPSTREAM BUG: the sweep reads balanceOf(h) and redeems exactly that, but
    /// _burn's _update charges the stability fee first, so the burn runs
    /// against `balance - fee` and reverts. Below rcrit a fee is always owed
    /// once any time has passed, so forced redemption — and every mint that
    /// triggers it — reverts exactly when the protocol is under-reserved.
    function test_UPSTREAM_BUG_SweepRevertsWhenAStabilityFeeIsOwed() public {
        _twoHoldersBelowCritical();
        vm.warp(block.timestamp + 1 days);
        assertGt(tectonic.stabilityFeeAmount(consumer), 0, "a fee is owed");

        vm.expectRevert(); // ERC20InsufficientBalance
        tectonic.forceRedemptions(10);
    }

    /// UPSTREAM BUG: forced payouts use send(), which reverts when the holder
    /// rejects basecoin, so one such holder blocks every sweep.
    function test_UPSTREAM_BUG_AHolderThatRejectsBasecoinBlocksTheSweep() public {
        RejectsBasecoin hostile = new RejectsBasecoin();
        vm.prank(consumer);
        tectonic.mint{value: 5 ether}(address(hostile));
        _depressRatioBelowCritical();

        vm.expectRevert("Transfer failed.");
        tectonic.forceRedemptions(10);
    }

    /// UPSTREAM BUG (Bruno's point on PR 24): once every holder is redeemed,
    /// only the unowned seed is left, the ratio can still be below critical,
    /// and the loop indexes past the end of `holders` (panic 0x32). The seed
    /// "belongs to no address", so nothing in the sweep can redeem it.
    function test_UPSTREAM_BUG_SweepPanicsWhenHoldersRunOutBelowCritical() public {
        vm.prank(consumer);
        tectonic.mint{value: 0.1 ether}(consumer); // small next to the seed
        _depressRatioBelowCritical();

        vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", 0x32));
        tectonic.forceRedemptions(10);
    }

    // -----------------------------------------------------------------
    // Invariants
    // -----------------------------------------------------------------

    /// scPriceRedeem() caps liabilities at R / r_supcrit, so the ratio never
    /// falls below the super-critical floor, equity never reaches zero, and
    /// the two coins' claims never exceed the reserve.
    function testFuzz_RatioNeverFallsBelowTheSuperCriticalFloor(uint96 rawMint, uint96 rawPrice) public {
        uint256 amount = uint256(rawMint);
        vm.assume(amount > 1e12 && amount < 100 ether);
        vm.assume(rawPrice > 1e8);

        vm.prank(consumer);
        tectonic.mint{value: amount}(consumer);
        oracle.setPrice(uint256(rawPrice));

        uint256 r = tectonic.R();
        assertLe(tectonic.L(), r, "L <= R");
        assertGe(tectonic.ratio(), SUPER_CRITICAL_RATIO - 1, "ratio >= r_supcrit (up to flooring)");
        assertGe(tectonic.E() + 1, ((SUPER_CRITICAL_RATIO - D) * r) / SUPER_CRITICAL_RATIO, "equity floor");
        assertGt(tectonic.ecPrice(), 0, "equity coins always have a price");
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /// Owned holders: `holders` is 1-based with address(0) at index 0.
    function _holderCount() internal view returns (uint256 n) {
        while (true) {
            try tectonic.holders(n + 1) returns (address) {
                n++;
            } catch {
                return n;
            }
        }
    }

    /// Two holders, ratio between r_supcrit and rcrit, no time elapsed (so no
    /// stability fee is owed yet). Two are needed because redeeming one
    /// restores the ratio: with one, the sweep would run out of holders
    /// (see test_UPSTREAM_BUG_SweepPanicsWhenHoldersRunOutBelowCritical).
    function _twoHoldersBelowCritical() internal {
        vm.prank(consumer);
        tectonic.mint{value: 5 ether}(consumer);
        vm.prank(consumer);
        tectonic.mint{value: 5 ether}(merchant);
        _depressRatioBelowCritical();
    }

    /// Raise the oracle price so liabilities grow and the ratio falls between
    /// the critical and safe thresholds.
    function _depressRatioBelowSafe() internal {
        _setRatioTarget((CRITICAL_RATIO + SAFE_RATIO) / 2);
        require(tectonic.ratio() <= SAFE_RATIO, "helper: expected ratio <= safe");
        require(tectonic.ratio() >= CRITICAL_RATIO, "helper: expected ratio >= critical");
    }

    /// Raise the oracle price so the ratio falls between r_supcrit and rcrit.
    function _depressRatioBelowCritical() internal {
        _setRatioTarget((SUPER_CRITICAL_RATIO + CRITICAL_RATIO) / 2);
        require(tectonic.ratio() < CRITICAL_RATIO, "helper: expected ratio < critical");
    }

    /// Solve for the oracle price that puts the reserve ratio at `target`.
    /// While the target price binds (target >= r_supcrit),
    /// ratio = R*D / L = R*D*D / (supply*price).
    function _setRatioTarget(uint256 target) internal {
        uint256 supply = tectonic.totalSupply();
        uint256 price = (tectonic.R() * D * D) / (supply * target);
        oracle.setPrice(price);
    }
}

/// A holder whose receive() reverts, e.g. a contract wallet that cannot
/// accept basecoin.
contract RejectsBasecoin {
    receive() external payable {
        revert("no basecoin");
    }
}
