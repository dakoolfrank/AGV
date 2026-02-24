// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/rGGP.sol";
import "../contracts/core/PowerToMint.sol";
import "../contracts/core/OracleVerification.sol";
import "../contracts/interfaces/IrGGP.sol";

contract PowerToMintTest is Test {
    rGGP public rggp;
    OracleVerification public oracleVerification;
    PowerToMint public powerToMint;

    address public admin = address(1);
    address public operator = address(2);
    address public minter = address(3);
    address public nftOwner = address(4);
    address public oracleSigner = address(5);

    function setUp() public {
        vm.warp(1700000000);
        vm.startPrank(admin);

        rggp = new rGGP(admin);
        oracleVerification = new OracleVerification(address(rggp), admin);
        powerToMint = new PowerToMint(address(rggp), address(oracleVerification), admin);

        // Setup roles
        bytes32 minterRole = powerToMint.MINTER_ROLE();
        bytes32 operatorRole = powerToMint.OPERATOR_ROLE();
        powerToMint.grantRole(minterRole, minter);
        powerToMint.grantRole(operatorRole, operator);

        bytes32 oracleRole = oracleVerification.ORACLE_ROLE();
        oracleVerification.grantRole(oracleRole, address(powerToMint));

        // Register oracle sources that will be used in tests
        bytes32 solarSourceId = keccak256("solar-001");
        bytes32 orchardSourceId = keccak256("orchard-001");
        bytes32 computeSourceId = keccak256("compute-001");
        bytes32 testSourceId = keccak256("test");

        oracleVerification.registerSource(solarSourceId, oracleSigner, "custom");
        oracleVerification.registerSource(orchardSourceId, oracleSigner, "custom");
        oracleVerification.registerSource(computeSourceId, oracleSigner, "custom");
        oracleVerification.registerSource(testSourceId, oracleSigner, "custom");

        vm.stopPrank();
    }

    function testInitialState() public {
        assertEq(address(powerToMint.rGGP()), address(rggp));
        assertEq(address(powerToMint.oracleVerification()), address(oracleVerification));
    }

    function testDefaultAssetConfigs() public {
        (uint256 solarRate, uint256 solarMin, uint256 solarMax, bool solarActive) =
            powerToMint.assetConfigs(IrGGP.AssetType.SOLAR);

        assertEq(solarRate, 10 * 10 ** 18);
        assertEq(solarMin, 1 * 10 ** 18);
        assertEq(solarMax, 100000 * 10 ** 18);
        assertTrue(solarActive);
    }

    function testRegisterNFTAsset() public {
        uint256 tokenId = 1;
        IrGGP.AssetType assetType = IrGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-001");

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, assetType, sourceId, nftOwner);

        (
            IrGGP.AssetType assetTypeRet,
            bytes32 sourceIdRet,
            address owner,
            bool active,
            uint256 totalOutput,
            uint256 totalRGGP,
            uint256 lastMint
        ) = powerToMint.getAssetDetails(tokenId);

        assertEq(uint256(assetTypeRet), uint256(assetType));
        assertEq(sourceIdRet, sourceId);
        assertEq(owner, nftOwner);
        assertTrue(active);
        assertEq(totalOutput, 0);
        assertEq(totalRGGP, 0);
    }

    function testCannotRegisterDuplicateNFT() public {
        uint256 tokenId = 1;
        IrGGP.AssetType assetType = IrGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-001");

        vm.startPrank(operator);
        powerToMint.registerNFTAsset(tokenId, assetType, sourceId, nftOwner);

        vm.expectRevert("NFT already registered");
        powerToMint.registerNFTAsset(tokenId, assetType, sourceId, nftOwner);
        vm.stopPrank();
    }

    function testCannotRegisterDuplicateSource() public {
        bytes32 sourceId = keccak256("solar-001");

        vm.startPrank(operator);
        powerToMint.registerNFTAsset(1, IrGGP.AssetType.SOLAR, sourceId, nftOwner);

        vm.expectRevert("Source already mapped");
        powerToMint.registerNFTAsset(2, IrGGP.AssetType.SOLAR, sourceId, nftOwner);
        vm.stopPrank();
    }

    function testCannotProcessInactiveAsset() public {
        uint256 tokenId = 1;
        bytes32 sourceId = keccak256("solar-001");

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, IrGGP.AssetType.SOLAR, sourceId, nftOwner);

        // Deactivate
        vm.prank(operator);
        powerToMint.deactivateAsset(tokenId, "Testing");

        // Try to process
        vm.prank(minter);
        vm.expectRevert("Asset inactive");
        powerToMint.processOutput(tokenId, 100 * 10 ** 18, block.timestamp, hex"00");
    }

    function testCannotProcessUnregisteredAsset() public {
        vm.prank(minter);
        vm.expectRevert("Asset inactive");
        powerToMint.processOutput(999, 100 * 10 ** 18, block.timestamp, hex"00");
    }

    function testCannotProcessOutputTooSmall() public {
        uint256 tokenId = 1;
        bytes32 sourceId = keccak256("solar-001");

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, IrGGP.AssetType.SOLAR, sourceId, nftOwner);

        vm.prank(minter);
        vm.expectRevert("Output too small");
        powerToMint.processOutput(tokenId, 0, block.timestamp, hex"00");
    }

    function testCannotProcessOutputTooLarge() public {
        uint256 tokenId = 1;
        bytes32 sourceId = keccak256("solar-001");

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, IrGGP.AssetType.SOLAR, sourceId, nftOwner);

        uint256 tooLarge = 200000 * 10 ** 18; // Exceeds max

        vm.prank(minter);
        vm.expectRevert("Output too large");
        powerToMint.processOutput(tokenId, tooLarge, block.timestamp, hex"00");
    }

    function testCannotProcessFutureTimestamp() public {
        uint256 tokenId = 1;
        bytes32 sourceId = keccak256("solar-001");

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, IrGGP.AssetType.SOLAR, sourceId, nftOwner);

        uint256 futureTimestamp = block.timestamp + 1 days;

        vm.prank(minter);
        vm.expectRevert("Future timestamp");
        powerToMint.processOutput(tokenId, 100 * 10 ** 18, futureTimestamp, hex"00");
    }

    function testCannotProcessOldData() public {
        uint256 tokenId = 1;
        bytes32 sourceId = keccak256("solar-001");

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, IrGGP.AssetType.SOLAR, sourceId, nftOwner);

        uint256 oldTimestamp = block.timestamp - 8 days;

        vm.prank(minter);
        vm.expectRevert("Data too old");
        powerToMint.processOutput(tokenId, 100 * 10 ** 18, oldTimestamp, hex"00");
    }

    function testDeactivateAsset() public {
        uint256 tokenId = 1;
        bytes32 sourceId = keccak256("solar-001");

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, IrGGP.AssetType.SOLAR, sourceId, nftOwner);

        vm.prank(operator);
        powerToMint.deactivateAsset(tokenId, "Maintenance");

        (,,, bool active,,,) = powerToMint.getAssetDetails(tokenId);
        assertFalse(active);
    }

    function testReactivateAsset() public {
        uint256 tokenId = 1;
        bytes32 sourceId = keccak256("solar-001");

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, IrGGP.AssetType.SOLAR, sourceId, nftOwner);

        vm.prank(operator);
        powerToMint.deactivateAsset(tokenId, "Maintenance");

        vm.prank(admin);
        powerToMint.reactivateAsset(tokenId);

        (,,, bool active,,,) = powerToMint.getAssetDetails(tokenId);
        assertTrue(active);
    }

    function testUpdateAssetOwner() public {
        uint256 tokenId = 1;
        bytes32 sourceId = keccak256("solar-001");
        address newOwner = address(10);

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, IrGGP.AssetType.SOLAR, sourceId, nftOwner);

        vm.prank(operator);
        powerToMint.updateAssetOwner(tokenId, newOwner);

        (,, address owner,,,,) = powerToMint.getAssetDetails(tokenId);
        assertEq(owner, newOwner);
    }

    function testCalculateRGGP() public {
        uint256 outputAmount = 100 * 10 ** 18; // 100 kWh

        uint256 rggpAmount = powerToMint.calculateRGGP(IrGGP.AssetType.SOLAR, outputAmount);
        assertEq(rggpAmount, 1000 * 10 ** 18); // 100 * 10

        rggpAmount = powerToMint.calculateRGGP(IrGGP.AssetType.ORCHARD, outputAmount);
        assertEq(rggpAmount, 2500 * 10 ** 18); // 100 * 25

        rggpAmount = powerToMint.calculateRGGP(IrGGP.AssetType.COMPUTE, outputAmount);
        assertEq(rggpAmount, 1500 * 10 ** 18); // 100 * 15
    }

    function testConfigureAsset() public {
        uint256 newRate = 20 * 10 ** 18;
        uint256 newMin = 10;
        uint256 newMax = 50000;

        vm.prank(admin);
        powerToMint.configureAsset(IrGGP.AssetType.SOLAR, newRate, newMin, newMax);

        (uint256 rate, uint256 minOutput, uint256 maxOutput, bool active) =
            powerToMint.assetConfigs(IrGGP.AssetType.SOLAR);

        assertEq(rate, newRate);
        assertEq(minOutput, newMin);
        assertEq(maxOutput, newMax);
        assertTrue(active);
    }

    function testUpdateOracleVerification() public {
        address newOracle = address(100);

        vm.prank(admin);
        powerToMint.updateOracleVerification(newOracle);

        assertEq(address(powerToMint.oracleVerification()), newOracle);
    }

    function testFuzzRegisterNFT(uint256 tokenId, uint8 assetTypeInt) public {
        vm.assume(tokenId > 0 && tokenId < 1000000);
        vm.assume(assetTypeInt <= 2);

        IrGGP.AssetType assetType = IrGGP.AssetType(assetTypeInt);
        bytes32 sourceId = keccak256(abi.encodePacked(tokenId));

        vm.prank(operator);
        powerToMint.registerNFTAsset(tokenId, assetType, sourceId, nftOwner);

        (,, address owner, bool active,,,) = powerToMint.getAssetDetails(tokenId);
        assertEq(owner, nftOwner);
        assertTrue(active);
    }
}
