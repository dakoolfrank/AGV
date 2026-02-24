// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/rGGP.sol";
import "../contracts/core/OracleVerification.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract OracleVerificationTest is Test {
    rGGP public rggp;
    OracleVerification public oracleVerification;

    address public admin = address(1);
    address public oracle = address(2);
    uint256 public signer1PrivateKey = 0x1234;
    uint256 public signer2PrivateKey = 0x5678;
    address public signer1;
    address public signer2;
    address public user1 = address(5);

    bytes32 public sourceId1 = keccak256("chainlink-solar-001");
    bytes32 public sourceId2 = keccak256("pyth-orchard-001");

    function setUp() public {
        // Set a reasonable timestamp
        vm.warp(1700000000);

        // Derive addresses from private keys
        signer1 = vm.addr(signer1PrivateKey);
        signer2 = vm.addr(signer2PrivateKey);

        vm.startPrank(admin);

        rggp = new rGGP(admin);
        oracleVerification = new OracleVerification(address(rggp), admin);

        bytes32 oracleRole = oracleVerification.ORACLE_ROLE();
        oracleVerification.grantRole(oracleRole, oracle);

        bytes32 rggpMinterRole = rggp.MINTER_ROLE();
        rggp.grantRole(rggpMinterRole, address(oracleVerification));

        vm.stopPrank();
    }

    function testInitialState() public {
        assertEq(address(oracleVerification.rGGP()), address(rggp));
        assertEq(oracleVerification.minRequiredSignatures(), 1);
    }

    function testRegisterSource() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        (address signer, bool active,, uint256 totalSubmissions,, string memory sourceType) =
            oracleVerification.oracleSources(sourceId1);

        assertEq(signer, signer1);
        assertTrue(active);
        assertEq(totalSubmissions, 0);
        assertEq(sourceType, "chainlink");
    }

    function testCannotRegisterDuplicateSource() public {
        vm.startPrank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        vm.expectRevert("Source exists");
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");
        vm.stopPrank();
    }

    function testCannotRegisterSourceWithInvalidSigner() public {
        vm.prank(admin);
        vm.expectRevert("Invalid signer");
        oracleVerification.registerSource(sourceId1, address(0), "chainlink");
    }

    function testSubmitData() public {
        // Register source
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        // Create signature
        uint256 outputAmount = 100 * 10 ** 18;
        IrGGP.AssetType assetType = IrGGP.AssetType.SOLAR;
        uint256 timestamp = block.timestamp;

        bytes32 messageHash = keccak256(abi.encodePacked(user1, outputAmount, assetType, sourceId1, timestamp));

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer1PrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(oracle);
        oracleVerification.submitData(user1, outputAmount, assetType, sourceId1, timestamp, signature);

        // Check rGGP was minted
        assertGt(rggp.balanceOf(user1), 0);
    }

    function testCannotSubmitDataFromInactiveSource() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        // Deactivate source
        vm.prank(admin);
        oracleVerification.deactivateSource(sourceId1, "Testing");

        uint256 outputAmount = 100 * 10 ** 18;
        bytes32 messageHash =
            keccak256(abi.encodePacked(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, block.timestamp));

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer1PrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(oracle);
        vm.expectRevert("Source inactive");
        oracleVerification.submitData(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, block.timestamp, signature);
    }

    function testCannotSubmitDataWithFutureTimestamp() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        uint256 futureTimestamp = block.timestamp + 1 days;
        uint256 outputAmount = 100 * 10 ** 18;

        bytes32 messageHash =
            keccak256(abi.encodePacked(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, futureTimestamp));

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer1PrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(oracle);
        vm.expectRevert("Future timestamp");
        oracleVerification.submitData(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, futureTimestamp, signature);
    }

    function testCannotSubmitStaleData() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        uint256 oldTimestamp = block.timestamp - 8 days;
        uint256 outputAmount = 100 * 10 ** 18;

        bytes32 messageHash =
            keccak256(abi.encodePacked(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, oldTimestamp));

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer1PrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(oracle);
        vm.expectRevert("Stale data");
        oracleVerification.submitData(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, oldTimestamp, signature);
    }

    function testCannotSubmitWithInvalidSignature() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        uint256 outputAmount = 100 * 10 ** 18;

        // Create signature with wrong signer
        bytes32 messageHash =
            keccak256(abi.encodePacked(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, block.timestamp));

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer2PrivateKey, ethSignedHash); // Wrong signer
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(oracle);
        vm.expectRevert("Invalid signature");
        oracleVerification.submitData(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, block.timestamp, signature);
    }

    function testDeactivateSource() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        vm.prank(admin);
        oracleVerification.deactivateSource(sourceId1, "Maintenance");

        (, bool active,,,,) = oracleVerification.oracleSources(sourceId1);
        assertFalse(active);
    }

    function testReactivateSource() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        vm.startPrank(admin);
        oracleVerification.deactivateSource(sourceId1, "Maintenance");
        oracleVerification.reactivateSource(sourceId1);
        vm.stopPrank();

        (, bool active,,,,) = oracleVerification.oracleSources(sourceId1);
        assertTrue(active);
    }

    function testUpdateSourceSigner() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        address newSigner = address(100);

        vm.prank(admin);
        oracleVerification.updateSourceSigner(sourceId1, newSigner);

        (address signer,,,,,) = oracleVerification.oracleSources(sourceId1);
        assertEq(signer, newSigner);
    }

    function testGetSourceHealth() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        (bool active, uint256 daysSinceUpdate, uint256 successRate, string memory sourceType) =
            oracleVerification.getSourceHealth(sourceId1);

        assertTrue(active);
        assertEq(daysSinceUpdate, 0);
        assertEq(successRate, 0); // No submissions yet
        assertEq(sourceType, "chainlink");
    }

    function testGetAllSources() public {
        vm.startPrank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");
        oracleVerification.registerSource(sourceId2, signer2, "pyth");
        vm.stopPrank();

        bytes32[] memory sources = oracleVerification.getAllSources();
        assertEq(sources.length, 2);
        assertEq(sources[0], sourceId1);
        assertEq(sources[1], sourceId2);
    }

    function testGetActiveSourceCount() public {
        vm.startPrank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");
        oracleVerification.registerSource(sourceId2, signer2, "pyth");

        oracleVerification.deactivateSource(sourceId1, "Testing");
        vm.stopPrank();

        uint256 activeCount = oracleVerification.getActiveSourceCount();
        assertEq(activeCount, 1);
    }

    function testCheckStaleSources() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        // Fast forward past stale threshold (30 days)
        vm.warp(block.timestamp + 31 days);

        oracleVerification.checkStaleSources();

        (, bool active,,,,) = oracleVerification.oracleSources(sourceId1);
        assertFalse(active); // Should be auto-deactivated
    }

    function testSetMinRequiredSignatures() public {
        vm.prank(admin);
        oracleVerification.setMinRequiredSignatures(3);

        assertEq(oracleVerification.minRequiredSignatures(), 3);
    }

    function testPauseUnpause() public {
        vm.prank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");

        vm.prank(admin);
        oracleVerification.pause();

        uint256 outputAmount = 100 * 10 ** 18;

        bytes32 messageHash =
            keccak256(abi.encodePacked(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, block.timestamp));

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer1PrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(oracle);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        oracleVerification.submitData(user1, outputAmount, IrGGP.AssetType.SOLAR, sourceId1, block.timestamp, signature);

        // Unpause
        vm.prank(admin);
        oracleVerification.unpause();
    }

    function testMultipleSources() public {
        vm.startPrank(admin);
        oracleVerification.registerSource(sourceId1, signer1, "chainlink");
        oracleVerification.registerSource(sourceId2, signer2, "pyth");
        vm.stopPrank();

        uint256 outputAmount1 = 100 * 10 ** 18;

        // Submit from source 1
        bytes32 messageHash1 =
            keccak256(abi.encodePacked(user1, outputAmount1, IrGGP.AssetType.SOLAR, sourceId1, block.timestamp));

        bytes32 ethSignedHash1 = MessageHashUtils.toEthSignedMessageHash(messageHash1);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(signer1PrivateKey, ethSignedHash1);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);

        vm.prank(oracle);
        oracleVerification.submitData(
            user1, outputAmount1, IrGGP.AssetType.SOLAR, sourceId1, block.timestamp, signature1
        );

        uint256 balance1 = rggp.balanceOf(user1);

        // Submit from source 2
        vm.warp(block.timestamp + 1);

        uint256 outputAmount2 = 50 * 10 ** 18;

        bytes32 messageHash2 =
            keccak256(abi.encodePacked(user1, outputAmount2, IrGGP.AssetType.ORCHARD, sourceId2, block.timestamp));

        bytes32 ethSignedHash2 = MessageHashUtils.toEthSignedMessageHash(messageHash2);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(signer2PrivateKey, ethSignedHash2);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);

        vm.prank(oracle);
        oracleVerification.submitData(
            user1, outputAmount2, IrGGP.AssetType.ORCHARD, sourceId2, block.timestamp, signature2
        );

        uint256 balance2 = rggp.balanceOf(user1);
        assertGt(balance2, balance1);
    }
}
