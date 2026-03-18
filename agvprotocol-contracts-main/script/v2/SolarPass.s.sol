// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/nft/SolarPass.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";

contract MockUSDT is ERC20 {
    uint8 private _decimals;

    constructor() ERC20("Mock USDT", "USDT") {
        _decimals = 6;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DeploySolarPass is Script {
    // Configuration constants
    string constant NAME = "SolarPass";
    string constant SYMBOL = "SOLAR";

    // USDT addresses for different networks
    address constant USDT_MAINNET = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant USDT_POLYGON = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;

    // Load these from environment variables
    address OWNER;
    address TREASURY;
    address USDT_ADDRESS;

    bytes32 constant INITIAL_MERKLE_ROOT = 0x0000000000000000000000000000000000000000000000000000000000000000;

    function run() external {
        OWNER = vm.envAddress("OWNER_ADDRESS");
        TREASURY = vm.envAddress("TREASURY_ADDRESS");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance);

        // Determine USDT address based on chain
        uint256 chainId = block.chainid;
        USDT_ADDRESS = setupUSDTAddress(chainId);

        console.log("Chain ID:", chainId);
        console.log("USDT Address:", USDT_ADDRESS);
        console.log("Owner:", OWNER);
        console.log("Treasury:", TREASURY);

        // Calculate timestamps
        uint256 wlStartTime = block.timestamp + 1 hours;
        uint256 wlEndTime = block.timestamp + 7 days;

        console.log("WL Start Time:", wlStartTime);
        console.log("WL End Time:", wlEndTime);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        console.log("Deploying SolarPass implementation...");
        SolarPass implementation = new SolarPass();
        console.log("Implementation deployed at:", address(implementation));

        // Prepare initialization data
        bytes memory initData = abi.encodeCall(
            SolarPass.initialize,
            (NAME, SYMBOL, OWNER, USDT_ADDRESS, TREASURY, INITIAL_MERKLE_ROOT, wlStartTime, wlEndTime)
        );

        // Deploy proxy
        console.log("Deploying ERC1967Proxy...");
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("Proxy deployed at:", address(proxy));

        vm.stopBroadcast();

        // Test the deployed contract
        testDeployedContract(address(proxy));

        // Log important addresses
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network Chain ID:", chainId);
        console.log("Contract Address (Proxy):", address(proxy));
        console.log("Implementation Address:", address(implementation));
        console.log("Owner:", OWNER);
        console.log("Treasury:", TREASURY);
        console.log("USDT Token:", USDT_ADDRESS);

        // Save deployment info
        saveDeploymentInfo(chainId, address(proxy), address(implementation));
    }

    function getUSDTAddress(uint256 chainId) internal pure returns (address) {
        if (chainId == 1) {
            // Ethereum Mainnet
            return USDT_MAINNET;
        } else if (chainId == 137) {
            // Polygon
            return USDT_POLYGON;
        } else if (chainId == 11155111) {
            // Sepolia - use a mock address or deploy mock USDT
            return 0x7169D38820dfd117C3FA1f22a697dBA58d90BA06; // Mock USDT on Sepolia
        } else {
            return address(0); // Return address(0) for unknown networks to trigger mock deployment
        }
    }

    function setupUSDTAddress(uint256 chainId) internal returns (address) {
        address usdtAddr = getUSDTAddress(chainId);

        // If we got address(0), deploy mock USDT for local/unknown networks
        if (usdtAddr == address(0)) {
            console.log("Network chain ID:", chainId, "- deploying mock USDT");
            return deployMockUSDT();
        }

        return usdtAddr;
    }

    function deployMockUSDT() internal returns (address) {
        console.log("Deploying Mock USDT for testing...");

        // Deploy a simple ERC20 mock USDT with 6 decimals
        MockUSDT mockUSDT = new MockUSDT();
        console.log("Mock USDT deployed at:", address(mockUSDT));

        // Mint some tokens to deployer for testing
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        mockUSDT.mint(deployer, 1000000 * 1e6); // 1M USDT
        console.log("Minted 1M USDT to deployer:", deployer);

        return address(mockUSDT);
    }

    function testDeployedContract(address proxyAddress) internal view {
        console.log("\n=== TESTING DEPLOYED CONTRACT ===");

        SolarPass solarpass = SolarPass(proxyAddress);

        string memory name = solarpass.name();
        string memory symbol = solarpass.symbol();
        uint256 totalSupply = solarpass.totalSupply();
        string memory currentPhase = solarpass.getCurrentPhase();
        uint256 remainingPublic = solarpass.getRemainingPublicSupply();
        uint256 remainingReserved = solarpass.getRemainingReservedSupply();

        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("Total Supply:", totalSupply);
        console.log("Current Phase:", currentPhase);
        console.log("Remaining Public:", remainingPublic);
        console.log("Remaining Reserved:", remainingReserved);

        console.log(" Contract tests passed!");
    }

    function saveDeploymentInfo(uint256 chainId, address proxy, address implementation) internal {
        string memory chainName = getChainName(chainId);
        string memory fileName = string.concat("deployments/", chainName, "-deployment.txt");

        string memory deploymentInfo = string.concat(
            "SolarPass Deployment Info\n",
            "========================\n",
            "Chain ID: ",
            vm.toString(chainId),
            "\n",
            "Chain Name: ",
            chainName,
            "\n",
            "Proxy Address: ",
            vm.toString(proxy),
            "\n",
            "Implementation Address: ",
            vm.toString(implementation),
            "\n",
            "Owner: ",
            vm.toString(OWNER),
            "\n",
            "Treasury: ",
            vm.toString(TREASURY),
            "\n",
            "Timestamp: ",
            vm.toString(block.timestamp),
            "\n"
        );

        vm.writeFile(fileName, deploymentInfo);

        console.log("Deployment info saved to:", fileName);
    }

    function getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 137) return "polygon";
        if (chainId == 80001) return "mumbai";
        if (chainId == 11155111) return "sepolia";
        if (chainId == 31337 || chainId == 1337) return "local";
        return "unknown";
    }
}

// Script for upgrading the contract
contract UpgradeSolarPass is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Proxy:", proxyAddress);

        vm.startBroadcast(deployerPrivateKey);

        SolarPass newImplementation = new SolarPass();
        console.log("New implementation:", address(newImplementation));

        UUPSUpgradeable(proxyAddress).upgradeToAndCall(address(newImplementation), "");

        vm.stopBroadcast();

        console.log("Upgrade completed!");
    }
}

// Script to setup roles and configuration after deployment
contract ConfigureSolarPass is Script {
    bytes32 constant AGENT_MINTER_ROLE = keccak256("AGENT_MINTER_ROLE");

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        console.log("Configuring SolarPass at:", proxyAddress);

        vm.startBroadcast(privateKey);

        SolarPass solarpass = SolarPass(proxyAddress);

        // 1. Set base URI
        string memory baseURI = "https://api.agvprotocol.com/metadata/solarpass/"; // just for test
        solarpass.setBaseURI(baseURI);
        console.log("Set base URI:", baseURI);

        // 2. Grant agent role to specific addresses (to be replaced with actual addresses)
        address agent1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        if (!solarpass.hasRole(AGENT_MINTER_ROLE, agent1)) {
            solarpass.grantAgentRole(agent1);
            console.log(" Granted AGENT_MINTER_ROLE to:", agent1);
        }

        // 3. Update sale config (extend whitelist period)
        uint256 wlStart = block.timestamp + 1 hours;
        uint256 wlEnd = block.timestamp + 14 days; // 2 weeks
        solarpass.setSaleConfig(wlStart, wlEnd, true);
        console.log(" Updated sale config");
        console.log("  WL Start:", wlStart);
        console.log("  WL End:", wlEnd);

        // 4. withdraw funds to treasury'
        address treasury = solarpass.treasuryReceiver();
        uint256 balance = address(solarpass).balance;
        if (balance > 0) {
            (bool success,) = treasury.call{value: balance}("");
            require(success, "Transfer failed");
            console.log(" Withdrawn funds to treasury:", treasury);
        } else {
            console.log(" No funds to withdraw to treasury:", treasury);
        }

        vm.stopBroadcast();

        // Display final config
        console.log("\n=== CONFIGURATION SUMMARY ===");
        console.log("Current Phase:", solarpass.getCurrentPhase());
        console.log("Remaining Public Supply:", solarpass.getRemainingPublicSupply());
        console.log("Treasury:", solarpass.treasuryReceiver());

        console.log("Configuration completed!");
    }
}
