// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/tokens/GVT.sol";
import "../contracts/tokens/rGGP.sol";
import "../contracts/core/BondingCurve.sol";
import "../contracts/core/OracleVerification.sol";
import "../contracts/core/PowerToMint.sol";
import "../contracts/governance/DAOController.sol";
import "../contracts/utils/VestingVault.sol";

contract DeployScript is Script {
    // Deployed contract instances
    GVT public gvt;
    rGGP public rggp;
    BondingCurve public bondingCurve;
    OracleVerification public oracleVerification;
    PowerToMint public powerToMint;
    DAOController public daoController;
    VestingVault public vestingVault;

    // Deployment addresses
    address public deployer;
    address public admin;
    address public multisig;

    // Allocation amounts
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;
    uint256 constant SEED_ALLOCATION = 150_000_000 * 10 ** 18; // 15%
    uint256 constant PUBLIC_ALLOCATION = 100_000_000 * 10 ** 18; // 10%
    uint256 constant ECOSYSTEM_ALLOCATION = 200_000_000 * 10 ** 18; // 20%
    uint256 constant DAO_ALLOCATION = 250_000_000 * 10 ** 18; // 25%
    uint256 constant TEAM_ALLOCATION = 150_000_000 * 10 ** 18; // 15%
    uint256 constant STAKING_ALLOCATION = 150_000_000 * 10 ** 18; // 15%

    // FIXED: Added 'virtual' keyword so child contracts can override
    function run() external virtual {
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

        console.log("Step 1: Deploying core tokens...");
        deployTokens();

        console.log("\nStep 2: Deploying oracle infrastructure...");
        deployOracle();

        console.log("\nStep 3: Deploying bonding curve...");
        deployBondingCurve();

        console.log("\nStep 4: Deploying governance...");
        deployGovernance();

        console.log("\nStep 5: Deploying vesting vault...");
        deployVestingVault();

        console.log("\nStep 6: Setting up roles and permissions...");
        setupRoles();

        console.log("\nStep 7: Configuring initial parameters...");
        configureParameters();

        console.log("\nStep 8: Setting up vesting schedules...");
        setupVesting();

        console.log("\nStep 9: Funding contracts...");
        fundContracts();

        vm.stopBroadcast();

        console.log("\n===========================================");
        console.log("Deployment Summary");
        console.log("===========================================");
        printDeploymentSummary();

        saveDeploymentArtifacts();

        console.log("\n===========================================");
        console.log("Deployment Complete!");
        console.log("===========================================\n");
    }

    function deployTokens() internal {
        console.log("  Deploying GVT...");
        gvt = new GVT(admin);
        console.log("  GVT deployed at:", address(gvt));

        console.log("  Deploying rGGP...");
        rggp = new rGGP(admin);
        console.log("  rGGP deployed at:", address(rggp));
    }

    function deployOracle() internal {
        console.log("  Deploying OracleVerification...");
        oracleVerification = new OracleVerification(address(rggp), admin);
        console.log("  OracleVerification deployed at:", address(oracleVerification));

        console.log("  Deploying PowerToMint...");
        powerToMint = new PowerToMint(address(rggp), address(oracleVerification), admin);
        console.log("  PowerToMint deployed at:", address(powerToMint));
    }

    function deployBondingCurve() internal {
        console.log("  Deploying BondingCurve...");
        bondingCurve = new BondingCurve(address(rggp), address(gvt), admin);
        console.log("  BondingCurve deployed at:", address(bondingCurve));
    }

    function deployGovernance() internal {
        console.log("  Deploying DAOController...");
        daoController = new DAOController(admin);
        console.log("  DAOController deployed at:", address(daoController));

        // Link GVT token to DAO
        daoController.setGVTToken(address(gvt));
        console.log("  GVT token linked to DAO");
    }

    function deployVestingVault() internal {
        console.log("  Deploying VestingVault...");
        vestingVault = new VestingVault(address(gvt), admin);
        console.log("  VestingVault deployed at:", address(vestingVault));
    }

    function setupRoles() internal {
        // GVT: Grant MINTER_ROLE to BondingCurve
        bytes32 gvtMinterRole = gvt.MINTER_ROLE();
        gvt.grantRole(gvtMinterRole, address(bondingCurve));
        console.log("  Granted GVT MINTER_ROLE to BondingCurve");

        // rGGP: Grant MINTER_ROLE to OracleVerification
        bytes32 rggpMinterRole = rggp.MINTER_ROLE();
        rggp.grantRole(rggpMinterRole, address(oracleVerification));
        console.log("  Granted rGGP MINTER_ROLE to OracleVerification");

        // OracleVerification: Grant ORACLE_ROLE
        bytes32 oracleRole = oracleVerification.ORACLE_ROLE();
        oracleVerification.grantRole(oracleRole, admin); // Admin can act as oracle initially
        console.log("  Granted ORACLE_ROLE to admin");

        // PowerToMint: Grant MINTER_ROLE
        bytes32 ptmMinterRole = powerToMint.MINTER_ROLE();
        powerToMint.grantRole(ptmMinterRole, admin);
        console.log("  Granted PowerToMint MINTER_ROLE to admin");

        // DAOController: Grant EXECUTOR_ROLE to multisig
        bytes32 executorRole = daoController.EXECUTOR_ROLE();
        daoController.grantRole(executorRole, multisig);
        console.log("  Granted EXECUTOR_ROLE to multisig");

        // VestingVault: Grant OPERATOR_ROLE
        bytes32 vaultOperatorRole = vestingVault.OPERATOR_ROLE();
        vestingVault.grantRole(vaultOperatorRole, admin);
        console.log("  Granted VestingVault OPERATOR_ROLE to admin");
    }

    function configureParameters() internal {
        // Register default oracle sources (examples)
        bytes32 chainlinkSourceId = keccak256("chainlink-mainnet");
        oracleVerification.registerSource(
            chainlinkSourceId,
            admin, // Replace with actual Chainlink oracle address
            "chainlink"
        );
        console.log("  Registered Chainlink oracle source");

        // Configure PowerToMint rates
        console.log("  PowerToMint configured with default rates");

        // Set initial treasury capacity for bonding curve
        bondingCurve.updateTreasuryCapacity(50_000_000 * 10 ** 18); // 50M GVT
        console.log("  Set BondingCurve treasury capacity: 50M GVT");
    }

    function setupVesting() internal {
        console.log("  Creating vesting schedules...");

        // Team & Advisors: 15% with 6mo cliff, 36mo vesting
        if (TEAM_ALLOCATION > 0) {
            vestingVault.createVestingSchedule(
                admin, // Replace with actual team multisig
                TEAM_ALLOCATION,
                6, // 6 month cliff
                36, // 36 month vesting
                true, // revocable
                "Team"
            );
            console.log("    Team allocation created:", TEAM_ALLOCATION / 10 ** 18, "GVT");
        }

        // Strategic/Private: 15% with 6mo cliff, 24mo vesting
        if (SEED_ALLOCATION > 0) {
            vestingVault.createVestingSchedule(
                admin, // Replace with actual investor address
                SEED_ALLOCATION,
                6, // 6 month cliff
                24, // 24 month vesting
                false, // not revocable
                "Strategic"
            );
            console.log("    Seed/Strategic allocation created:", SEED_ALLOCATION / 10 ** 18, "GVT");
        }

        // Ecosystem: 20% with DAO-gated release
        if (ECOSYSTEM_ALLOCATION > 0) {
            vestingVault.createVestingSchedule(
                address(daoController), // Controlled by DAO
                ECOSYSTEM_ALLOCATION,
                0, // No cliff
                48, // 48 month vesting
                false,
                "Ecosystem"
            );
            console.log("    Ecosystem allocation created:", ECOSYSTEM_ALLOCATION / 10 ** 18, "GVT");
        }
    }

    function fundContracts() internal {
        // Calculate total vesting allocations
        uint256 totalVesting = TEAM_ALLOCATION + SEED_ALLOCATION + ECOSYSTEM_ALLOCATION;

        // Mint tokens for vesting vault
        bytes32 minterRole = gvt.MINTER_ROLE();
        gvt.grantRole(minterRole, address(this));
        gvt.mint(address(this), totalVesting);

        // Approve and deposit to vesting vault
        gvt.approve(address(vestingVault), totalVesting);
        vestingVault.deposit(totalVesting);

        console.log("  Funded VestingVault with", totalVesting / 10 ** 18, "GVT");

        // Revoke temporary minter role
        gvt.revokeRole(minterRole, address(this));
    }

    function printDeploymentSummary() internal view {
        console.log("Contract Addresses:");
        console.log("  GVT:", address(gvt));
        console.log("  rGGP:", address(rggp));
        console.log("  BondingCurve:", address(bondingCurve));
        console.log("  OracleVerification:", address(oracleVerification));
        console.log("  PowerToMint:", address(powerToMint));
        console.log("  DAOController:", address(daoController));
        console.log("  VestingVault:", address(vestingVault));
        console.log("");
        console.log("Configuration:");
        console.log("  Total GVT Supply:", TOTAL_SUPPLY / 10 ** 18);
        console.log("  Team Allocation:", TEAM_ALLOCATION / 10 ** 18);
        console.log("  Seed Allocation:", SEED_ALLOCATION / 10 ** 18);
        console.log("  Ecosystem Allocation:", ECOSYSTEM_ALLOCATION / 10 ** 18);
        console.log("  Initial Bonding Ratio: 10:1 (rGGP:GVT)");
        console.log("  Vesting Period: 7-30 days");
        console.log("  Epoch Duration: 90 days");
    }

    function saveDeploymentArtifacts() internal {
        string memory chainName = getChainName(block.chainid);
        string memory fileName = string.concat("deployments/", chainName, "-", vm.toString(block.timestamp), ".json");

        string memory json = string.concat(
            "{\n",
            '  "network": "',
            chainName,
            '",\n',
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "deployer": "',
            vm.toString(deployer),
            '",\n',
            '  "timestamp": ',
            vm.toString(block.timestamp),
            ",\n",
            '  "contracts": {\n',
            '    "GVT": "',
            vm.toString(address(gvt)),
            '",\n',
            '    "rGGP": "',
            vm.toString(address(rggp)),
            '",\n',
            '    "BondingCurve": "',
            vm.toString(address(bondingCurve)),
            '",\n',
            '    "OracleVerification": "',
            vm.toString(address(oracleVerification)),
            '",\n',
            '    "PowerToMint": "',
            vm.toString(address(powerToMint)),
            '",\n',
            '    "DAOController": "',
            vm.toString(address(daoController)),
            '",\n',
            '    "VestingVault": "',
            vm.toString(address(vestingVault)),
            '"\n',
            "  }\n",
            "}"
        );

        vm.writeFile(fileName, json);
        console.log("\nDeployment artifacts saved to:", fileName);
    }

    function getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 1) return "mainnet";
        if (chainId == 5) return "goerli";
        if (chainId == 11155111) return "sepolia";
        if (chainId == 56) return "bsc";
        if (chainId == 97) return "bscTestnet";
        if (chainId == 42161) return "arbitrum";
        if (chainId == 421614) return "arbitrumSepolia";
        if (chainId == 31337) return "localhost";
        return "unknown";
    }
}
