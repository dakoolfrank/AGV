// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/rGGP.sol";

contract rGGPTest is Test {
    rGGP public rggp;

    address public admin = address(1);
    address public minter = address(2);
    address public user1 = address(3);
    address public revoker = address(4);

    event OutputMinted(
        bytes32 indexed mintId, address indexed recipient, uint256 amount, rGGP.AssetType assetType, bytes32 sourceId
    );

    event MintRevoked(bytes32 indexed mintId, string reason);
    event EpochAdvanced(uint256 newEpoch, uint256 timestamp);

    function setUp() public {
        vm.prank(admin);
        rggp = new rGGP(admin);

        bytes32 minterRole = rggp.MINTER_ROLE();
        bytes32 revokerRole = rggp.REVOKER_ROLE();

        vm.startPrank(admin);
        rggp.grantRole(minterRole, minter);
        rggp.grantRole(revokerRole, revoker);
        vm.stopPrank();
    }

    function testInitialState() public {
        assertEq(rggp.name(), "Rewarded Green Garden Points");
        assertEq(rggp.symbol(), "rGGP");
        assertEq(rggp.decimals(), 18);
        assertEq(rggp.totalSupply(), 0);
        assertEq(rggp.getCurrentEpoch(), 1);
    }

    function testDefaultMintRates() public {
        (uint256 solarRate, bool solarActive) = rggp.mintRates(rGGP.AssetType.SOLAR);
        (uint256 orchardRate, bool orchardActive) = rggp.mintRates(rGGP.AssetType.ORCHARD);
        (uint256 computeRate, bool computeActive) = rggp.mintRates(rGGP.AssetType.COMPUTE);

        assertEq(solarRate, 10 * 10 ** 18);
        assertEq(orchardRate, 25 * 10 ** 18);
        assertEq(computeRate, 15 * 10 ** 18);
        assertTrue(solarActive);
        assertTrue(orchardActive);
        assertTrue(computeActive);
    }

    function testMintFromOutput() public {
        uint256 outputAmount = 100 * 10 ** 18; // 100 kWh
        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.prank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        // 100 kWh * 10 rGGP/kWh = 1000 rGGP
        uint256 expectedMint = 1000 * 10 ** 18;
        assertEq(rggp.balanceOf(user1), expectedMint);
    }

    function testMintOrchardOutput() public {
        uint256 outputAmount = 50 * 10 ** 18; // 50 kg
        rGGP.AssetType assetType = rGGP.AssetType.ORCHARD;
        bytes32 sourceId = keccak256("orchard-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.prank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        // 50 kg * 25 rGGP/kg = 1250 rGGP
        uint256 expectedMint = 1250 * 10 ** 18;
        assertEq(rggp.balanceOf(user1), expectedMint);
    }

    function testMintComputeOutput() public {
        uint256 outputAmount = 20 * 10 ** 18; // 20 hours
        rGGP.AssetType assetType = rGGP.AssetType.COMPUTE;
        bytes32 sourceId = keccak256("compute-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.prank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        // 20 hours * 15 rGGP/hour = 300 rGGP
        uint256 expectedMint = 300 * 10 ** 18;
        assertEq(rggp.balanceOf(user1), expectedMint);
    }

    function testCannotMintDuplicate() public {
        uint256 outputAmount = 100 * 10 ** 18;
        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.startPrank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        // Try to mint again with same parameters
        vm.expectRevert("Mint already processed");
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);
        vm.stopPrank();
    }

    function testCannotMintFutureTimestamp() public {
        uint256 outputAmount = 100 * 10 ** 18;
        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");
        uint256 timestamp = block.timestamp + 1 days;
        bytes memory signature = hex"00";

        vm.prank(minter);
        vm.expectRevert("Future timestamp");
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);
    }

    function testCannotMintStaleData() public {
        uint256 outputAmount = 100 * 10 ** 18;
        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");

        vm.warp(block.timestamp + 10 days);
        uint256 timestamp = block.timestamp - 8 days; // Too old
        bytes memory signature = hex"00";

        vm.prank(minter);
        vm.expectRevert("Stale data");
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);
    }

    function testEpochCap() public {
        uint256 epochCap = rggp.epochCap(rGGP.AssetType.SOLAR);

        // Try to mint more than epoch cap
        uint256 outputAmount = 1_000_001 * 10 ** 18; // Exceed cap

        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.prank(minter);
        vm.expectRevert("Epoch cap exceeded");
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);
    }

    function testGetRemainingCap() public {
        uint256 initialCap = rggp.getRemainingCap(rGGP.AssetType.SOLAR);

        // Mint some tokens
        uint256 outputAmount = 1000 * 10 ** 18; // 1000 kWh
        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.prank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        uint256 newCap = rggp.getRemainingCap(rGGP.AssetType.SOLAR);
        uint256 minted = 10000 * 10 ** 18; // 1000 kWh * 10 rGGP/kWh

        assertEq(newCap, initialCap - minted);
    }

    function testRevokeMint() public {
        uint256 outputAmount = 100 * 10 ** 18;
        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.prank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        bytes32 mintId = keccak256(abi.encodePacked(user1, outputAmount, assetType, sourceId, timestamp));

        uint256 balanceBefore = rggp.balanceOf(user1);

        vm.prank(revoker);
        rggp.revokeMint(mintId, "Fraudulent data");

        uint256 balanceAfter = rggp.balanceOf(user1);
        assertLt(balanceAfter, balanceBefore);
    }

    function testCannotRevokeNonexistentMint() public {
        bytes32 fakeMintId = keccak256("fake");

        vm.prank(revoker);
        vm.expectRevert("Mint does not exist");
        rggp.revokeMint(fakeMintId, "Test");
    }

    function testUpdateMintRate() public {
        uint256 newRate = 20 * 10 ** 18; // 20 rGGP per kWh

        vm.prank(admin);
        rggp.setMintRate(rGGP.AssetType.SOLAR, newRate);

        (uint256 rate,) = rggp.mintRates(rGGP.AssetType.SOLAR);
        assertEq(rate, newRate);
    }

    function testUpdateEpochCap() public {
        uint256 newCap = 20_000_000 * 10 ** 18;

        vm.prank(admin);
        rggp.setEpochCap(rGGP.AssetType.SOLAR, newCap);

        assertEq(rggp.epochCap(rGGP.AssetType.SOLAR), newCap);
    }

    function testAdvanceEpoch() public {
        uint256 initialEpoch = rggp.getCurrentEpoch();

        // Fast forward past epoch duration (90 days)
        vm.warp(block.timestamp + 91 days);

        // Trigger epoch advance by minting
        uint256 outputAmount = 10 * 10 ** 18;
        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.prank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        uint256 newEpoch = rggp.getCurrentEpoch();
        assertEq(newEpoch, initialEpoch + 1);
    }

    function testManualEpochAdvance() public {
        uint256 initialEpoch = rggp.getCurrentEpoch();

        vm.prank(admin);
        rggp.advanceEpoch();

        assertEq(rggp.getCurrentEpoch(), initialEpoch + 1);
    }

    function testPauseUnpause() public {
        vm.prank(admin);
        rggp.pause();

        uint256 outputAmount = 100 * 10 ** 18;
        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.prank(minter);
        vm.expectRevert();
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        vm.prank(admin);
        rggp.unpause();

        // Should work now
        vm.prank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);
        assertGt(rggp.balanceOf(user1), 0);
    }

    function testBurnTokens() public {
        // Mint some tokens first
        uint256 outputAmount = 100 * 10 ** 18;
        rGGP.AssetType assetType = rGGP.AssetType.SOLAR;
        bytes32 sourceId = keccak256("solar-panel-001");
        uint256 timestamp = block.timestamp;
        bytes memory signature = hex"00";

        vm.prank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        uint256 balance = rggp.balanceOf(user1);
        uint256 burnAmount = balance / 2;

        vm.prank(user1);
        rggp.burn(burnAmount);

        assertEq(rggp.balanceOf(user1), balance - burnAmount);
    }

    function testFuzzMintFromOutput(uint96 outputAmount, uint8 assetTypeInt, uint32 timeDelta) public {
        vm.assume(outputAmount > 0 && outputAmount < 1000 * 10 ** 18);
        vm.assume(assetTypeInt <= 2); // Only 3 asset types
        vm.assume(timeDelta < 6 days); // Within acceptable range

        vm.warp(block.timestamp + 7 days);

        rGGP.AssetType assetType = rGGP.AssetType(assetTypeInt);
        bytes32 sourceId = keccak256(abi.encodePacked(outputAmount, assetTypeInt));
        uint256 timestamp = block.timestamp - timeDelta;
        bytes memory signature = hex"00";

        vm.prank(minter);
        rggp.mintFromOutput(user1, outputAmount, assetType, sourceId, timestamp, signature);

        assertGt(rggp.balanceOf(user1), 0);
    }
}
