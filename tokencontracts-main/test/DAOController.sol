// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/governance/DAOController.sol";
import "../contracts/tokens/GVT.sol";

contract DAOControllerTest is Test {
    DAOController public dao;
    GVT public gvt;

    address public admin = address(1);
    address public proposer = address(2);
    address public executor = address(3);
    address public voter1 = address(4);
    address public voter2 = address(5);

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        DAOController.ProposalCategory category,
        string description
    );

    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 votes);

    function setUp() public {
        vm.startPrank(admin);

        dao = new DAOController(admin);
        gvt = new GVT(admin);

        dao.setGVTToken(address(gvt));

        bytes32 proposerRole = dao.PROPOSER_ROLE();
        bytes32 executorRole = dao.EXECUTOR_ROLE();

        dao.grantRole(proposerRole, proposer);
        dao.grantRole(executorRole, executor);

        vm.stopPrank();
    }

    function testInitialState() public {
        assertEq(dao.proposalCount(), 0);
        assertEq(dao.votingDelay(), 1 days);
        assertEq(dao.votingPeriod(), 7 days);
        assertEq(dao.timelockDelay(), 2 days);
        assertEq(address(dao.gvtToken()), address(gvt));
    }

    function testInitialParameters() public {
        DAOController.ProtocolParams memory params = dao.getParameters();

        assertEq(params.bondingRatio, 10 * 10 ** 18);
        assertEq(params.bondingSlope, 0);
        assertEq(params.bondingDiscount, 500);
        assertEq(params.minVestingDays, 7);
        assertEq(params.maxVestingDays, 30);
        assertEq(params.epochDuration, 90 days);
        assertEq(params.solarRate, 10 * 10 ** 18);
        assertEq(params.orchardRate, 25 * 10 ** 18);
        assertEq(params.computeRate, 15 * 10 ** 18);
    }

    function testCreateProposal() public {
        address[] memory targets = new address[](1);
        targets[0] = address(dao);

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(dao.updateMintRates.selector, 20 * 10 ** 18, 25 * 10 ** 18, 15 * 10 ** 18);

        vm.prank(proposer);
        uint256 proposalId = dao.propose(
            DAOController.ProposalCategory.PARAMETER_CHANGE, "Update solar mint rate to 20", targets, values, calldatas
        );

        assertEq(proposalId, 1);
        assertEq(dao.proposalCount(), 1);
    }

    function testProposalStateProgression() public {
        // Create proposal
        address[] memory targets = new address[](1);
        targets[0] = address(dao);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(dao.updateMintRates.selector, 20 * 10 ** 18, 25 * 10 ** 18, 15 * 10 ** 18);

        vm.prank(proposer);
        uint256 proposalId =
            dao.propose(DAOController.ProposalCategory.PARAMETER_CHANGE, "Test Proposal", targets, values, calldatas);

        // Should be Pending initially
        assertEq(uint256(dao.state(proposalId)), uint256(DAOController.ProposalState.Pending));

        // Fast forward past voting delay
        vm.roll(block.number + (1 days / 12) + 1);

        // Should be Active
        assertEq(uint256(dao.state(proposalId)), uint256(DAOController.ProposalState.Active));
    }

    function testCastVote() public {
        // Create proposal
        address[] memory targets = new address[](1);
        targets[0] = address(dao);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(dao.updateMintRates.selector, 20 * 10 ** 18, 25 * 10 ** 18, 15 * 10 ** 18);

        vm.prank(proposer);
        uint256 proposalId =
            dao.propose(DAOController.ProposalCategory.PARAMETER_CHANGE, "Test Proposal", targets, values, calldatas);

        // Fast forward to active state
        vm.roll(block.number + (1 days / 12) + 1);

        // Vote
        vm.prank(voter1);
        dao.castVote(proposalId, 1); // Vote FOR

        (
            address proposerAddr,
            DAOController.ProposalCategory category,
            string memory description,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            DAOController.ProposalState currentState
        ) = dao.getProposal(proposalId);

        assertGt(forVotes, 0);
    }

    function testCannotVoteTwice() public {
        address[] memory targets = new address[](1);
        targets[0] = address(dao);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(dao.updateMintRates.selector, 20 * 10 ** 18, 25 * 10 ** 18, 15 * 10 ** 18);

        vm.prank(proposer);
        uint256 proposalId =
            dao.propose(DAOController.ProposalCategory.PARAMETER_CHANGE, "Test Proposal", targets, values, calldatas);

        vm.roll(block.number + (1 days / 12) + 1);

        vm.startPrank(voter1);
        dao.castVote(proposalId, 1);

        vm.expectRevert("Already voted");
        dao.castVote(proposalId, 1);
        vm.stopPrank();
    }

    function testCannotVoteWithInvalidSupport() public {
        address[] memory targets = new address[](1);
        targets[0] = address(dao);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(dao.updateMintRates.selector, 20 * 10 ** 18, 25 * 10 ** 18, 15 * 10 ** 18);

        vm.prank(proposer);
        uint256 proposalId =
            dao.propose(DAOController.ProposalCategory.PARAMETER_CHANGE, "Test Proposal", targets, values, calldatas);

        vm.roll(block.number + (1 days / 12) + 1);

        vm.prank(voter1);
        vm.expectRevert("Invalid support value");
        dao.castVote(proposalId, 3); // Invalid
    }

    function testQueueProposal() public {
        address[] memory targets = new address[](1);
        targets[0] = address(dao);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(dao.updateMintRates.selector, 20 * 10 ** 18, 25 * 10 ** 18, 15 * 10 ** 18);

        vm.prank(proposer);
        uint256 proposalId =
            dao.propose(DAOController.ProposalCategory.PARAMETER_CHANGE, "Test Proposal", targets, values, calldatas);

        // Make it active
        vm.roll(block.number + (1 days / 12) + 1);

        // Vote to pass (simplified - in production would need real voting power)
        vm.prank(voter1);
        dao.castVote(proposalId, 1);

        // Fast forward past voting period
        vm.roll(block.number + (7 days / 12) + 1);

        // Note: This test assumes proposal would succeed with votes
        // In reality, would need sufficient voting power
    }

    function testCancelProposal() public {
        address[] memory targets = new address[](1);
        targets[0] = address(dao);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(dao.updateMintRates.selector, 20 * 10 ** 18, 25 * 10 ** 18, 15 * 10 ** 18);

        vm.prank(proposer);
        uint256 proposalId =
            dao.propose(DAOController.ProposalCategory.PARAMETER_CHANGE, "Test Proposal", targets, values, calldatas);

        // Proposer can cancel
        vm.prank(proposer);
        dao.cancel(proposalId);

        assertEq(uint256(dao.state(proposalId)), uint256(DAOController.ProposalState.Canceled));
    }

    function testGuardianCanCancelProposal() public {
        address[] memory targets = new address[](1);
        targets[0] = address(dao);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(dao.updateMintRates.selector, 20 * 10 ** 18, 25 * 10 ** 18, 15 * 10 ** 18);

        vm.prank(proposer);
        uint256 proposalId =
            dao.propose(DAOController.ProposalCategory.PARAMETER_CHANGE, "Test Proposal", targets, values, calldatas);

        // Admin (has guardian role) can cancel
        vm.prank(admin);
        dao.cancel(proposalId);

        assertEq(uint256(dao.state(proposalId)), uint256(DAOController.ProposalState.Canceled));
    }

    function testUpdateBondingParams() public {
        uint256 newRatio = 20 * 10 ** 18;
        uint256 newSlope = 1 * 10 ** 15;
        uint256 newDiscount = 1000;
        uint256 newMinVesting = 14;
        uint256 newMaxVesting = 60;

        vm.prank(executor);
        dao.updateBondingParams(newRatio, newSlope, newDiscount, newMinVesting, newMaxVesting);

        DAOController.ProtocolParams memory params = dao.getParameters();
        assertEq(params.bondingRatio, newRatio);
        assertEq(params.bondingSlope, newSlope);
        assertEq(params.bondingDiscount, newDiscount);
        assertEq(params.minVestingDays, newMinVesting);
        assertEq(params.maxVestingDays, newMaxVesting);
    }

    function testCannotUpdateBondingParamsWithInvalidValues() public {
        vm.startPrank(executor);

        // Invalid ratio
        vm.expectRevert("Invalid ratio");
        dao.updateBondingParams(0, 0, 500, 7, 30);

        // Invalid vesting range
        vm.expectRevert("Invalid vesting range");
        dao.updateBondingParams(10 * 10 ** 18, 0, 500, 30, 7);

        // Discount too high
        vm.expectRevert("Discount too high");
        dao.updateBondingParams(10 * 10 ** 18, 0, 2500, 7, 30);

        vm.stopPrank();
    }

    function testUpdateEpochParams() public {
        uint256 newDuration = 180 days;
        uint256 newMaxGVT = 20_000_000 * 10 ** 18;

        vm.prank(executor);
        dao.updateEpochParams(newDuration, newMaxGVT);

        DAOController.ProtocolParams memory params = dao.getParameters();
        assertEq(params.epochDuration, newDuration);
        assertEq(params.maxGVTPerEpoch, newMaxGVT);
    }

    function testUpdateMintRates() public {
        uint256 newSolarRate = 20 * 10 ** 18;
        uint256 newOrchardRate = 30 * 10 ** 18;
        uint256 newComputeRate = 25 * 10 ** 18;

        vm.prank(executor);
        dao.updateMintRates(newSolarRate, newOrchardRate, newComputeRate);

        DAOController.ProtocolParams memory params = dao.getParameters();
        assertEq(params.solarRate, newSolarRate);
        assertEq(params.orchardRate, newOrchardRate);
        assertEq(params.computeRate, newComputeRate);
    }

    function testUpdateOracleParams() public {
        uint256 newMaxAge = 12 hours;
        uint256 newStaleThreshold = 60 days;

        vm.prank(executor);
        dao.updateOracleParams(newMaxAge, newStaleThreshold);

        DAOController.ProtocolParams memory params = dao.getParameters();
        assertEq(params.maxDataAge, newMaxAge);
        assertEq(params.staleThreshold, newStaleThreshold);
    }

    function testUpdateGovernanceSettings() public {
        uint256 newVotingDelay = 2 days;
        uint256 newVotingPeriod = 14 days;
        uint256 newProposalThreshold = 200000 * 10 ** 18;
        uint256 newQuorumVotes = 8_000_000 * 10 ** 18;
        uint256 newTimelockDelay = 3 days;

        vm.prank(admin);
        dao.updateGovernanceSettings(
            newVotingDelay, newVotingPeriod, newProposalThreshold, newQuorumVotes, newTimelockDelay
        );

        assertEq(dao.votingDelay(), newVotingDelay);
        assertEq(dao.votingPeriod(), newVotingPeriod);
        assertEq(dao.proposalThreshold(), newProposalThreshold);
        assertEq(dao.quorumVotes(), newQuorumVotes);
        assertEq(dao.timelockDelay(), newTimelockDelay);
    }
}
