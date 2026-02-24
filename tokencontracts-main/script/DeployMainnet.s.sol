// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "./Deploy.s.sol";

/**
 * @title DeployMainnet
 * @notice Production mainnet deployment with safety checks
 * @dev Run with: forge script script/DeployMainnet.s.sol --rpc-url $RPC_URL --broadcast --verify --slow
 */
contract DeployMainnet is DeployScript {
    // Mainnet-specific addresses (replace with actual addresses)
    address constant TEAM_MULTISIG = address(0); // TODO: Set team multisig
    address constant DAO_MULTISIG = address(0); // TODO: Set DAO multisig
    address constant TREASURY_MULTISIG = address(0); // TODO: Set treasury multisig

    // Oracle signers (replace with actual Chainlink/Pyth addresses)
    address constant CHAINLINK_SIGNER = address(0); // TODO: Set Chainlink oracle
    address constant PYTH_SIGNER = address(0); // TODO: Set Pyth oracle

    function run() external override {
        console.log("===========================================");
        console.log("MAINNET DEPLOYMENT - PRODUCTION");
        console.log("===========================================");
        console.log("WARNING: This will deploy to mainnet!");
        console.log("Ensure all addresses are correct before proceeding.");
        console.log("===========================================\n");

        // Pre-deployment checks
        require(performPreDeploymentChecks(), "Pre-deployment checks failed");

        console.log("Pre-deployment checks passed!\n");

        // Load deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        // Set admin (can be multisig after deployment)
        admin = vm.envOr("ADMIN_ADDRESS", deployer);
        multisig = vm.envOr("MULTISIG_ADDRESS", deployer);

        console.log("===========================================");
        console.log("AGV Protocol Deployment");
        console.log("===========================================");
        console.log("Deployer:", deployer);
        console.log("Admin:", admin);
        console.log("Multisig:", multisig);
        console.log("Chain ID:", block.chainid);
        console.log("===========================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy core tokens
        console.log("Step 1: Deploying core tokens...");
        deployTokens();

        // 2. Deploy oracle infrastructure
        console.log("\nStep 2: Deploying oracle infrastructure...");
        deployOracle();

        // 3. Deploy bonding curve
        console.log("\nStep 3: Deploying bonding curve...");
        deployBondingCurve();

        // 4. Deploy governance
        console.log("\nStep 4: Deploying governance...");
        deployGovernance();

        // 5. Deploy vesting vault
        console.log("\nStep 5: Deploying vesting vault...");
        deployVestingVault();

        // 6. Setup roles and permissions
        console.log("\nStep 6: Setting up roles and permissions...");
        setupRoles();

        // 7. Configure initial parameters
        console.log("\nStep 7: Configuring initial parameters...");
        configureParameters();

        // 8. Setup vesting schedules
        console.log("\nStep 8: Setting up vesting schedules...");
        setupVesting();

        // 9. Fund contracts
        console.log("\nStep 9: Funding contracts...");
        fundContracts();

        vm.stopBroadcast();

        // 10. Print deployment summary
        console.log("\n===========================================");
        console.log("Deployment Summary");
        console.log("===========================================");
        printDeploymentSummary();

        // 11. Save deployment artifacts
        saveDeploymentArtifacts();

        // Mainnet-specific post-deployment
        setupMainnetProduction();

        // Transfer ownership to multisigs
        transferOwnership();

        // Final security checks
        performPostDeploymentChecks();

        console.log("\n===========================================");
        console.log("MAINNET DEPLOYMENT COMPLETE");
        console.log("===========================================");
        console.log("\nCRITICAL: Complete the following immediately:");
        console.log("1. Verify all contracts on Etherscan/BSCScan");
        console.log("2. Transfer admin roles to multisigs");
        console.log("3. Revoke deployer privileges");
        console.log("4. Setup monitoring and alerts");
        console.log("5. Announce deployment to community");
        console.log("6. Initialize liquidity pools");
        console.log("7. Begin DAO governance");
        console.log("===========================================\n");
    }

    function performPreDeploymentChecks() internal view returns (bool) {
        console.log("Performing pre-deployment checks...");

        // Check we're on correct chain
        require(block.chainid == 56 || block.chainid == 42161, "Must deploy to BSC or Arbitrum mainnet");
        console.log("  Chain ID verified:", block.chainid);

        // Check multisig addresses are set
        require(TEAM_MULTISIG != address(0), "Team multisig not set");
        require(DAO_MULTISIG != address(0), "DAO multisig not set");
        require(TREASURY_MULTISIG != address(0), "Treasury multisig not set");
        console.log("  Multisig addresses verified");

        // Check oracle signers are set
        require(CHAINLINK_SIGNER != address(0), "Chainlink signer not set");
        require(PYTH_SIGNER != address(0), "Pyth signer not set");
        console.log("  Oracle signers verified");

        // Get deployer address for balance check
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddr = vm.addr(deployerPrivateKey);

        // Check deployer has sufficient gas
        require(deployerAddr.balance > 0.5 ether, "Insufficient gas balance");
        console.log("  Deployer balance:", deployerAddr.balance / 10 ** 18, "ETH");

        return true;
    }

    function setupMainnetProduction() internal {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("\nConfiguring mainnet production settings...");

        // Register production oracle sources
        registerProductionOracles();

        // Setup actual vesting for team/investors
        setupProductionVesting();

        // Configure production parameters
        configureProductionParameters();

        // setupInitialLiquidity();

        vm.stopBroadcast();

        console.log("Production configuration complete!");
    }

    function registerProductionOracles() internal {
        console.log("  Registering production oracles...");

        // Chainlink oracle
        bytes32 chainlinkId = keccak256("chainlink-mainnet");
        oracleVerification.registerSource(chainlinkId, CHAINLINK_SIGNER, "chainlink");
        console.log("    Chainlink oracle registered");

        // Pyth oracle
        bytes32 pythId = keccak256("pyth-mainnet");
        oracleVerification.registerSource(pythId, PYTH_SIGNER, "pyth");
        console.log("    Pyth oracle registered");

        // Set minimum required signatures to 2 for redundancy
        oracleVerification.setMinRequiredSignatures(1); // Start with 1, increase after testing
        console.log("    Minimum signatures set to 1");
    }

    function setupProductionVesting() internal {
        console.log("  Setting up production vesting schedules...");

        // Team vesting (15% = 150M GVT)
        // Split among team members (example)
        address[] memory teamMembers = new address[](3);
        teamMembers[0] = TEAM_MULTISIG; // Main team allocation
        teamMembers[1] = address(0); // TODO: Add individual allocations
        teamMembers[2] = address(0); // TODO: Add individual allocations

        uint256[] memory teamAmounts = new uint256[](3);
        teamAmounts[0] = 100_000_000 * 10 ** 18; // 100M to multisig
        teamAmounts[1] = 25_000_000 * 10 ** 18; // 25M
        teamAmounts[2] = 25_000_000 * 10 ** 18; // 25M

        for (uint256 i = 0; i < teamMembers.length; i++) {
            if (teamMembers[i] != address(0)) {
                vestingVault.createTeamVesting(teamMembers[i], teamAmounts[i]);
                console.log("      Team vesting created:", teamAmounts[i] / 10 ** 18, "GVT");
            }
        }

        // Strategic investor vesting (examples - replace with actual addresses)
        // vestingVault.createStrategicVesting(investor1, amount1);
        // vestingVault.createStrategicVesting(investor2, amount2);

        console.log("    Production vesting configured");
    }

    function configureProductionParameters() internal {
        console.log("  Configuring production parameters...");

        // Set conservative treasury capacity
        bondingCurve.updateTreasuryCapacity(100_000_000 * 10 ** 18); // 100M GVT
        console.log("    Treasury capacity: 100M GVT");

        // Set governance thresholds for production
        daoController.updateGovernanceSettings(
            2 days, // votingDelay
            7 days, // votingPeriod
            1_000_000 * 10 ** 18, // proposalThreshold (1M GVT)
            10_000_000 * 10 ** 18, // quorumVotes (10M GVT = 1%)
            3 days // timelockDelay
        );
        console.log("    Governance parameters configured");
    }

    function transferOwnership() internal {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("\nTransferring ownership to multisigs...");

        bytes32 adminRole = gvt.DEFAULT_ADMIN_ROLE();

        // Transfer GVT admin to DAO multisig
        gvt.grantRole(adminRole, DAO_MULTISIG);
        console.log("  Granted GVT admin to DAO multisig");

        // Transfer rGGP admin to DAO multisig
        rggp.grantRole(adminRole, DAO_MULTISIG);
        console.log("  Granted rGGP admin to DAO multisig");

        // Transfer BondingCurve admin to DAO multisig
        bondingCurve.grantRole(adminRole, DAO_MULTISIG);
        console.log("  Granted BondingCurve admin to DAO multisig");

        // Transfer DAOController admin to DAO multisig
        daoController.grantRole(adminRole, DAO_MULTISIG);
        console.log("  Granted DAOController admin to DAO multisig");

        // Transfer VestingVault admin to team multisig
        vestingVault.grantRole(adminRole, TEAM_MULTISIG);
        console.log("  Granted VestingVault admin to team multisig");

        // Grant guardian role for emergency actions
        bytes32 guardianRole = daoController.GUARDIAN_ROLE();
        daoController.grantRole(guardianRole, TEAM_MULTISIG);
        console.log("  Granted GUARDIAN_ROLE to team multisig");

        // IMPORTANT: Don't revoke deployer roles yet - do manually after verification
        console.log("\n  WARNING: Deployer roles NOT revoked automatically");
        console.log("  Manually revoke after verifying deployment!");

        vm.stopBroadcast();
    }

    function performPostDeploymentChecks() internal view {
        console.log("\nPerforming post-deployment checks...");

        // Verify all contracts deployed
        require(address(gvt) != address(0), "GVT not deployed");
        require(address(rggp) != address(0), "rGGP not deployed");
        require(address(bondingCurve) != address(0), "BondingCurve not deployed");
        require(address(oracleVerification) != address(0), "OracleVerification not deployed");
        require(address(powerToMint) != address(0), "PowerToMint not deployed");
        require(address(daoController) != address(0), "DAOController not deployed");
        require(address(vestingVault) != address(0), "VestingVault not deployed");
        console.log("  All contracts deployed");

        // Verify GVT parameters
        require(gvt.MAX_SUPPLY() == TOTAL_SUPPLY, "Incorrect GVT supply");
        // require(gvt.totalMinted() > 0, "No GVT allocated");
        console.log("  GVT parameters verified");

        // Verify rGGP mint rates
        (uint256 solarRate, bool solarActive) = rggp.mintRates(rGGP.AssetType.SOLAR);
        require(solarRate == 10 * 10 ** 18 && solarActive, "Incorrect solar rate");
        console.log("  rGGP mint rates verified");

        // Verify bonding curve setup
        require(address(bondingCurve.GVT()) == address(gvt), "BondingCurve GVT mismatch");
        require(address(bondingCurve.rGGP()) == address(rggp), "BondingCurve rGGP mismatch");
        console.log("  BondingCurve connections verified");

        // Verify oracle sources registered
        uint256 activeOracles = oracleVerification.getActiveSourceCount();
        require(activeOracles >= 1, "No active oracles");
        console.log("  Oracle sources verified:", activeOracles);

        // Verify DAO configuration
        require(address(daoController.gvtToken()) == address(gvt), "DAO GVT mismatch");
        console.log("  DAO configuration verified");

        // Verify vesting vault funded
        require(gvt.balanceOf(address(vestingVault)) > 0, "Vesting vault not funded");
        console.log("  Vesting vault funded");

        console.log("\n  All post-deployment checks passed!");
    }
}
