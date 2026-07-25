// SPDX-License-Identifier: AEL
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {Tectonic} from "../src/Tectonic.sol";
import {MockOracle} from "../src/MockOracle.sol";

/// @notice Tests for the local Tectonic dev fork.
///
/// Tests tagged REGRESSION document a bug in the upstream draft: each of them
/// fails against StabilityNexus/Tectonic-EVM-Contracts (commit e657330) and
/// passes here. They double as an executable bug report.
///
/// Tests tagged SDK pin the arithmetic that tectonic-sdk reimplements in JS.
/// If one of these changes, the SDK's cost calculation must change with it.
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
    uint256 constant CRITICAL_RATIO = 12 * 1e17; // 1.2
    uint256 constant SAFE_RATIO = 15 * 1e17; // 1.5
    uint256 constant INITIAL_PRICE = 5 * 1e14; // 0.0005 BC per SC

    function setUp() public {
        oracle = new MockOracle(INITIAL_PRICE);
        tectonic = new Tectonic(address(oracle), treasury, TREASURY_FEE, FEE, CRITICAL_RATIO, SAFE_RATIO);
        vm.deal(consumer, 1000 ether);
        vm.deal(lp, 1000 ether);
        vm.deal(merchant, 1 ether);
    }

    // -----------------------------------------------------------------
    // Bootstrap
    // -----------------------------------------------------------------

    /// REGRESSION (patch 1): upstream ratio() divided by zero at zero supply,
    /// and mint() reads ratio() before doing anything, so a fresh deployment
    /// could never accept its first mint.
    function test_FirstMintSucceedsOnFreshDeployment() public {
        assertEq(tectonic.totalSupply(), 0);
        assertEq(tectonic.ratio(), type(uint256).max, "empty protocol is infinitely reserved");

        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);

        assertGt(tectonic.totalSupply(), 0, "stablecoins were minted");
        assertGt(tectonic.R(), 0, "reserve received the basecoin");
    }

    /// REGRESSION (patch 1): same for the equity coin path.
    function test_FirstEquityMintSucceedsOnFreshDeployment() public {
        vm.prank(lp);
        tectonic.mintEquityCoins{value: 10 ether}(lp);
        assertGt(tectonic.equityCoin().totalSupply(), 0);
    }

    /// REGRESSION (patch 3): upstream computed `% (holders.length - 1)`, which
    /// panics when there are no holders.
    function test_ForceRedemptionsWithNoHoldersIsANoop() public {
        assertEq(tectonic.holderCount(), 0);
        tectonic.forceRedemptions(10); // must not revert
    }

    // -----------------------------------------------------------------
    // Core operations
    // -----------------------------------------------------------------

    /// REGRESSION (patch 2): upstream's `_redeem` was `internal nonReentrant`
    /// and its caller `redeem` was also nonReentrant, so redeem() always
    /// reverted with ReentrancyGuardReentrantCall.
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
        assertEq(tectonic.R(), 1 ether - (1 ether * TREASURY_FEE / D), "protocol fee retained");
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

    /// REGRESSION (patch 7): with timestamp[a] defaulting to 0, a new holder's
    /// accrual window started at the UNIX epoch and the first charge could burn
    /// their entire balance.
    function test_NewHolderIsNotChargedForTimeBeforeTheyHeldCoins() public {
        vm.prank(consumer);
        tectonic.mint{value: 1 ether}(consumer);
        _depressRatioBelowSafe();

        uint256 balance = tectonic.balanceOf(consumer);
        assertGt(tectonic.stabilityFee(), 0, "we are below the safe threshold");
        // No time has passed since the holder was first charged on receipt.
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

    /// REGRESSION (patch 8): upstream wrote timestamp[a] AFTER the burn, so
    /// _burn -> _update -> chargeStabilityFee recursed until it ran out of gas.
    /// Any transfer, mint or redeem with a fee owed consumed the whole block
    /// gas limit and reverted. This test costs ~1e9 gas against upstream.
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

    /// The same recursion, reached through an ordinary transfer — which is how
    /// a StablePay direct payment would have hit it.
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

    /// REGRESSION (patch 2): upstream, any mint that tripped the critical
    /// threshold reverted, because mint() (nonReentrant) called
    /// forceRedemptions() (also nonReentrant).
    function test_MintBelowCriticalRatioTriggersRedemptionsInsteadOfReverting() public {
        vm.prank(consumer);
        tectonic.mint{value: 5 ether}(consumer);
        _depressRatioBelowCritical();

        assertLt(tectonic.ratio(), CRITICAL_RATIO, "we are below critical");
        assertGt(tectonic.balanceOf(consumer), 0, "consumer holds a position");

        // The incoming payment must be small relative to the reserve.
        //
        // `msg.value` is credited to the contract balance BEFORE the function
        // body runs, so R() inside mint() already includes it and the ratio is
        // partly self-healed before the threshold is even tested. A large
        // enough mint lifts the ratio back above rcrit on its own and no
        // redemption is triggered — correct behaviour, and the reason an
        // earlier version of this test failed with a 1 ether mint.
        address newBuyer = makeAddr("newBuyer");
        vm.deal(newBuyer, 10 ether);
        vm.prank(newBuyer);
        tectonic.mint{value: 0.01 ether}(newBuyer);

        assertEq(tectonic.balanceOf(consumer), 0, "prior holder was force-redeemed");
        assertGt(tectonic.balanceOf(newBuyer), 0, "new buyer still received their coins");
    }

    /// FINDING: a mint can pass the critical-ratio check and still leave the
    /// protocol below the critical ratio afterwards.
    ///
    /// Two effects compose. `msg.value` lands in the reserve before the check,
    /// so the ratio tested is the *post-payment, pre-issuance* one — here that
    /// is ~2.2, comfortably above rcrit, so no redemption is triggered. The
    /// coins are then issued at the oracle target price, which adds almost as
    /// much to liabilities as the payment added to the reserve, pulling the
    /// ratio back toward 1 — here to ~1.056, below rcrit.
    ///
    /// Minting diluting the ratio toward 1 is inherent to the design (Tectonic
    /// deliberately has no minimum reserve ratio for minting). The consequence
    /// worth knowing is that "after a mint, r >= rcrit" is NOT an invariant,
    /// and the *next* operation will trigger redemptions — potentially against
    /// the merchant who just received these coins.
    function test_MintPassesTheCheckYetLeavesTheRatioBelowCritical() public {
        vm.prank(consumer);
        tectonic.mint{value: 5 ether}(consumer);
        _depressRatioBelowCritical();

        uint256 heldBefore = tectonic.balanceOf(consumer);

        address whale = makeAddr("whale");
        vm.deal(whale, 100 ether);
        vm.prank(whale);
        tectonic.mint{value: 5 ether}(whale);

        // The payment lifted the ratio above rcrit before the check, so nobody
        // was redeemed on the way in.
        assertEq(tectonic.balanceOf(consumer), heldBefore, "no redemption was triggered");

        // But issuing the coins diluted it straight back below rcrit.
        assertLt(tectonic.ratio(), CRITICAL_RATIO, "issuance diluted the ratio below critical");
        assertGe(tectonic.ratio(), D, "the ratio still cannot fall below 1");
    }

    function test_ForcedRedemptionPaysTheHolderInBasecoin() public {
        vm.prank(consumer);
        tectonic.mint{value: 5 ether}(consumer);
        _depressRatioBelowCritical();

        uint256 bcBefore = consumer.balance;
        tectonic.forceRedemptions(10);

        assertGt(consumer.balance, bcBefore, "redeemed holder was paid out");
        assertEq(tectonic.balanceOf(consumer), 0, "position was fully redeemed");
    }

    // -----------------------------------------------------------------
    // Invariants
    // -----------------------------------------------------------------

    /// Paper eq. 3: liabilities are bounded by the reserve, so the protocol is
    /// never accounting-insolvent and the ratio never drops below 1.
    function testFuzz_LiabilitiesNeverExceedReserve(uint96 rawMint, uint96 rawPrice) public {
        uint256 amount = uint256(rawMint);
        vm.assume(amount > 1e12 && amount < 100 ether);
        vm.assume(rawPrice > 1e8);

        vm.prank(consumer);
        tectonic.mint{value: amount}(consumer);
        oracle.setPrice(uint256(rawPrice));

        assertLe(tectonic.L(), tectonic.R(), "L <= R");
        if (tectonic.L() > 0) assertGe(tectonic.ratio(), D, "ratio >= 1");
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /// Raise the oracle price so liabilities grow and the ratio falls between
    /// the critical and safe thresholds.
    function _depressRatioBelowSafe() internal {
        _setRatioTarget((CRITICAL_RATIO + SAFE_RATIO) / 2);
        require(tectonic.ratio() <= SAFE_RATIO, "helper: expected ratio <= safe");
        require(tectonic.ratio() >= CRITICAL_RATIO, "helper: expected ratio >= critical");
    }

    /// Raise the oracle price far enough that the ratio falls below critical.
    function _depressRatioBelowCritical() internal {
        _setRatioTarget(D + (CRITICAL_RATIO - D) / 2);
        require(tectonic.ratio() < CRITICAL_RATIO, "helper: expected ratio < critical");
    }

    /// Solve for the oracle price that puts the reserve ratio at `target`.
    /// ratio = R*D / L and L = supply * min(price, R*D/supply) / D,
    /// so while the target price binds: ratio = R*D*D / (supply*price).
    function _setRatioTarget(uint256 target) internal {
        uint256 supply = tectonic.totalSupply();
        require(supply > 0, "helper: need outstanding supply");
        uint256 price = (tectonic.R() * D * D) / (supply * target);
        oracle.setPrice(price);
    }
}
