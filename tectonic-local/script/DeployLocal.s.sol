// SPDX-License-Identifier: AEL
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Tectonic} from "../src/Tectonic.sol";
import {MockOracle} from "../src/MockOracle.sol";

/// @notice Deploys a MockOracle + Tectonic pair to a local anvil chain and
///         seeds the reserve so the widget has something to interact with.
///
/// Usage (anvil default account #0 key):
///   anvil
///   forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 \
///     --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
///
/// Writes deployments/local.json for the SDK to consume.
contract DeployLocal is Script {
    // Protocol parameters, all scaled by D = 1e18.
    uint256 constant D = 1e18;
    uint256 constant FEE = 15 * 1e15; // 1.5% protocol fee (stays in reserve)
    uint256 constant TREASURY_FEE = 5 * 1e15; // 0.5% treasury fee (leaves the protocol)
    uint256 constant CRITICAL_RATIO = 12 * 1e17; // 1.2  (rcrit)
    uint256 constant SAFE_RATIO = 15 * 1e17; // 1.5  (rsafe), must satisfy 1 < rcrit < rsafe < 2

    // 1 stablecoin costs 0.0005 BC, i.e. 1 BC ~ 2000 stablecoins.
    // Pick whatever makes your test invoice amounts readable.
    uint256 constant INITIAL_PRICE = 5 * 1e14;

    // Equity seed: minting equity coins first builds a reserve cushion, so the
    // first stablecoin mint does not immediately sit at ratio == 1.
    uint256 constant EQUITY_SEED = 10 ether;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(pk);
        address treasury = vm.envOr("TREASURY", deployer);

        vm.startBroadcast(pk);

        MockOracle oracle = new MockOracle(INITIAL_PRICE);
        Tectonic tectonic =
            new Tectonic(address(oracle), treasury, TREASURY_FEE, FEE, CRITICAL_RATIO, SAFE_RATIO);

        // Seed equity so the protocol starts over-reserved.
        tectonic.mintEquityCoins{value: EQUITY_SEED}(deployer);

        vm.stopBroadcast();

        console2.log("=== Tectonic local deployment ===");
        console2.log("MockOracle      :", address(oracle));
        console2.log("Tectonic (=SC)  :", address(tectonic));
        console2.log("EquityCoin      :", address(tectonic.equityCoin()));
        console2.log("Treasury        :", treasury);
        console2.log("scPriceMint     :", tectonic.scPriceMint());
        console2.log("Reserve (wei)   :", tectonic.R());
        console2.log("Equity  (wei)   :", tectonic.E());

        string memory json = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid),
            ',\n  "oracle": "', vm.toString(address(oracle)),
            '",\n  "tectonic": "', vm.toString(address(tectonic)),
            '",\n  "equityCoin": "', vm.toString(address(tectonic.equityCoin())),
            '",\n  "treasury": "', vm.toString(treasury),
            '",\n  "fee": "', vm.toString(FEE),
            '",\n  "treasuryFee": "', vm.toString(TREASURY_FEE),
            '",\n  "criticalReserveRatio": "', vm.toString(CRITICAL_RATIO),
            '",\n  "safeReserveRatio": "', vm.toString(SAFE_RATIO),
            '"\n}\n'
        );
        // Writing the manifest is bookkeeping, not part of the deployment. If
        // it fails (missing fs_permissions, read-only checkout), say so and
        // carry on — the addresses are already printed above, and failing here
        // would abort the script and prevent the broadcast of a deployment
        // that otherwise succeeded.
        //
        // createDir must sit inside the guard too: vm.writeFile does not create
        // parent directories, and createDir is itself subject to fs_permissions,
        // so leaving it outside would revert on exactly the failure this
        // try/catch exists to absorb.
        try vm.createDir("deployments", true) {
            // directory ready
        } catch {
            console2.log("WARNING: could not create deployments/ directory.");
        }

        try vm.writeFile("deployments/local.json", json) {
            console2.log("Wrote deployments/local.json");
        } catch {
            console2.log("WARNING: could not write deployments/local.json.");
            console2.log("The deployment succeeded; copy the addresses above by hand.");
            console2.log("Check that foundry.toml grants fs_permissions for ./deployments");
        }
    }
}
