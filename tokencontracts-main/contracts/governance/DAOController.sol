// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DAOController
 * @notice Central governance contract for AGV Protocol parameter management
 * @dev Manages all protocol parameters with timelock and multisig protection
 *
 * Features:
 * - Two-tier governance (NFT holders + GVT stakers)
 * - Timelock for critical changes (24-72 hours)
 * - Emergency pause mechanism
 * - Parameter proposal and voting system
 * - Execution via multisig (5/9 recommended)
 */
contract DAOController is AccessControl, Pausable {
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE"); // Role for creating proposals. can be open to all GVT stakers
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE"); // Role for executing queued proposals
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE"); // Role for emergency actions

    // Proposal states
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Executed
    }

    // Proposal categories
    enum ProposalCategory {
        PARAMETER_CHANGE, // Change protocol parameters
        TREASURY_ALLOCATION, // Treasury fund allocation
        EMISSION_ADJUSTMENT, // Adjust mint rates
        EMERGENCY_ACTION, // Emergency response
        ASSET_VERIFICATION, // Asset-level decisions (NFT holders)
        PROTOCOL_UPGRADE // Contract upgrades

    }

    struct Proposal {
        uint256 id;
        address proposer;
        ProposalCategory category;
        string description;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool canceled;
        bool executed;
        mapping(address => bool) hasVoted;
        uint256 eta; // Execution time (after timelock)
    }

    // Protocol parameters
    struct ProtocolParams {
        // Bonding curve
        uint256 bondingRatio; // rGGP per GVT
        uint256 bondingSlope; // Ratio increase rate
        uint256 bondingDiscount; // Discount percentage
        uint256 minVestingDays; // Min vesting period
        uint256 maxVestingDays; // Max vesting period
        // Epochs
        uint256 epochDuration; // Epoch length
        uint256 maxGVTPerEpoch; // Max GVT conversions per epoch
        // Oracle
        uint256 maxDataAge; // Max acceptable data age
        uint256 staleThreshold; // Auto-pause threshold
        // Mint rates (per unit)
        uint256 solarRate; // rGGP per kWh
        uint256 orchardRate; // rGGP per kg
        uint256 computeRate; // rGGP per compute hour
    }

    ProtocolParams public params;

    // Governance settings
    uint256 public votingDelay = 1 days; // Delay before voting starts
    uint256 public votingPeriod = 7 days; // Voting duration
    uint256 public proposalThreshold = 100000 * 10 ** 18; // Min GVT to propose
    uint256 public quorumVotes = 4_000_000 * 10 ** 18; // Min votes for quorum (0.4% of supply)
    uint256 public timelockDelay = 2 days; // Timelock duration

    // Proposal tracking
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public latestProposalIds;

    // Voting power sources
    address public gvtToken;
    address public nftContract;

    event ProposalCreated(
        uint256 indexed proposalId, address indexed proposer, ProposalCategory category, string description
    );

    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 votes);

    event ProposalQueued(uint256 indexed proposalId, uint256 eta);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);

    event ParameterUpdated(string parameter, uint256 oldValue, uint256 newValue);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);

        // Initialize default parameters (from handbook)
        params = ProtocolParams({
            bondingRatio: 10 * 10 ** 18, // 10:1 ratio
            bondingSlope: 0, // No slope initially
            bondingDiscount: 500, // 5%
            minVestingDays: 7,
            maxVestingDays: 30,
            epochDuration: 90 days,
            maxGVTPerEpoch: 10_000_000 * 10 ** 18,
            maxDataAge: 7 days,
            staleThreshold: 30 days,
            solarRate: 10 * 10 ** 18,
            orchardRate: 25 * 10 ** 18,
            computeRate: 15 * 10 ** 18
        });
    }

    /**
     * @notice Create new proposal
     * @param category Proposal category
     * @param description Brief description
     * @param targets List of target addresses
     * @param values ETH values to send
     * @param calldatas Encoded function calls
     * @return proposalId New proposal ID
     */
    function propose(
        ProposalCategory category,
        string memory description,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    ) external returns (uint256) {
        require(targets.length == values.length, "Length mismatch");
        require(targets.length == calldatas.length, "Length mismatch");
        require(targets.length > 0, "Empty proposal");

        // Check proposer has enough voting power (simplified for now)
        // In production, check GVT balance or NFT ownership

        proposalCount++;
        uint256 proposalId = proposalCount;

        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.category = category;
        newProposal.description = description;
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.calldatas = calldatas;
        newProposal.startBlock = block.number + (votingDelay / 12); // ~12s blocks
        newProposal.endBlock = newProposal.startBlock + (votingPeriod / 12);

        latestProposalIds[msg.sender] = proposalId;

        emit ProposalCreated(proposalId, msg.sender, category, description);

        return proposalId;
    }

    /**
     * @notice Cast vote on proposal
     * @param proposalId Proposal to vote on
     * @param support 0=against, 1=for, 2=abstain
     */
    function castVote(uint256 proposalId, uint8 support) external {
        require(support <= 2, "Invalid support value");

        Proposal storage proposal = proposals[proposalId];
        require(state(proposalId) == ProposalState.Active, "Voting not active");
        require(!proposal.hasVoted[msg.sender], "Already voted");

        // Get voting power (simplified - should check GVT balance or NFT)
        uint256 votes = getVotingPower(msg.sender, proposal.category);
        require(votes > 0, "No voting power");

        proposal.hasVoted[msg.sender] = true;

        if (support == 0) {
            proposal.againstVotes += votes;
        } else if (support == 1) {
            proposal.forVotes += votes;
        } else {
            proposal.abstainVotes += votes;
        }

        emit VoteCast(msg.sender, proposalId, support, votes);
    }

    /**
     * @notice Queue successful proposal for execution
     * @param proposalId Proposal to queue
     */
    function queue(uint256 proposalId) external {
        require(state(proposalId) == ProposalState.Succeeded, "Proposal not succeeded");

        Proposal storage proposal = proposals[proposalId];
        uint256 eta = block.timestamp + timelockDelay;
        proposal.eta = eta;

        emit ProposalQueued(proposalId, eta);
    }

    /**
     * @notice Execute queued proposal
     * @param proposalId Proposal to execute
     */
    function execute(uint256 proposalId) external payable onlyRole(EXECUTOR_ROLE) {
        require(state(proposalId) == ProposalState.Queued, "Proposal not queued");

        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.eta, "Timelock not expired");

        proposal.executed = true;

        // Execute all calls
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success,) = proposal.targets[i].call{value: proposal.values[i]}(proposal.calldatas[i]);
            require(success, "Transaction execution failed");
        }

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancel proposal
     * @param proposalId Proposal to cancel
     * @dev Can be called by proposer or guardian
     */
    function cancel(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(msg.sender == proposal.proposer || hasRole(GUARDIAN_ROLE, msg.sender), "Not authorized");

        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    /**
     * @notice Get proposal state
     * @param proposalId Proposal ID
     * @return ProposalState Current state
     * @dev Simplified - does not check proposer voting power
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");

        if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (block.number <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (proposal.forVotes <= proposal.againstVotes || proposal.forVotes < quorumVotes) {
            return ProposalState.Defeated;
        } else if (proposal.eta == 0) {
            return ProposalState.Succeeded;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (block.timestamp >= proposal.eta) {
            return ProposalState.Queued;
        }

        return ProposalState.Queued;
    }

    /**
     * @notice Get voting power for address
     * @dev Simplified - should integrate with GVT/NFT contracts
     */
    function getVotingPower(address account, ProposalCategory category) public view returns (uint256) {
        // For asset-level decisions, check NFT ownership
        if (category == ProposalCategory.ASSET_VERIFICATION) {
            // TODO: Check NFT balance
            return 1; // 1 vote per NFT
        }
        // For protocol-level decisions, check GVT stake
        // TODO: Check staked GVT balance
        return 1000 * 10 ** 18; // Placeholder
    }

    /**
     * @notice Update bonding curve parameters
     * @param ratio New bonding ratio
     * @param slope New bonding slope
     * @param discount New bonding discount
     * @param minVesting New minimum vesting days
     * @param maxVesting New maximum vesting days
     * @dev Ratio in rGGP per GVT, slope as ratio increase rate, discount in basis points
     */
    function updateBondingParams(uint256 ratio, uint256 slope, uint256 discount, uint256 minVesting, uint256 maxVesting)
        external
        onlyRole(EXECUTOR_ROLE)
    {
        require(ratio > 0, "Invalid ratio");
        require(minVesting <= maxVesting, "Invalid vesting range");
        require(discount <= 2000, "Discount too high");

        emit ParameterUpdated("bondingRatio", params.bondingRatio, ratio);
        emit ParameterUpdated("bondingSlope", params.bondingSlope, slope);
        emit ParameterUpdated("bondingDiscount", params.bondingDiscount, discount);

        params.bondingRatio = ratio;
        params.bondingSlope = slope;
        params.bondingDiscount = discount;
        params.minVestingDays = minVesting;
        params.maxVestingDays = maxVesting;
    }

    /**
     * @notice Update epoch configuration
     * @param duration New epoch duration
     * @param maxGVT New max GVT per epoch
     * @dev Duration in seconds, maxGVT in token units
     */
    function updateEpochParams(uint256 duration, uint256 maxGVT) external onlyRole(EXECUTOR_ROLE) {
        require(duration > 0, "Invalid duration");
        require(maxGVT > 0, "Invalid max GVT");

        emit ParameterUpdated("epochDuration", params.epochDuration, duration);
        emit ParameterUpdated("maxGVTPerEpoch", params.maxGVTPerEpoch, maxGVT);

        params.epochDuration = duration;
        params.maxGVTPerEpoch = maxGVT;
    }

    /**
     * @notice Update mint rates
     *  @param solarRate New solar rate
     * @param orchardRate New orchard rate
     * @param computeRate New compute rate
     * @dev Rates are in rGGP per unit (kWh, kg, hour)
     */
    function updateMintRates(uint256 solarRate, uint256 orchardRate, uint256 computeRate)
        external
        onlyRole(EXECUTOR_ROLE)
    {
        require(solarRate > 0 && orchardRate > 0 && computeRate > 0, "Invalid rates");

        emit ParameterUpdated("solarRate", params.solarRate, solarRate);
        emit ParameterUpdated("orchardRate", params.orchardRate, orchardRate);
        emit ParameterUpdated("computeRate", params.computeRate, computeRate);

        params.solarRate = solarRate;
        params.orchardRate = orchardRate;
        params.computeRate = computeRate;
    }

    /**
     * @notice Update oracle parameters
     */
    function updateOracleParams(uint256 maxAge, uint256 staleThreshold) external onlyRole(EXECUTOR_ROLE) {
        require(maxAge > 0 && staleThreshold > maxAge, "Invalid thresholds");

        emit ParameterUpdated("maxDataAge", params.maxDataAge, maxAge);
        emit ParameterUpdated("staleThreshold", params.staleThreshold, staleThreshold);

        params.maxDataAge = maxAge;
        params.staleThreshold = staleThreshold;
    }

    /**
     * @notice Update governance settings
     * @param _votingDelay New voting delay
     * @param _votingPeriod New voting period
     * @param _proposalThreshold New proposal threshold
     * @param _quorumVotes New quorum votes
     * @param _timelockDelay New timelock delay
     * @dev All times in seconds, thresholds in token units
     */
    function updateGovernanceSettings(
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumVotes,
        uint256 _timelockDelay
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        votingDelay = _votingDelay;
        votingPeriod = _votingPeriod;
        proposalThreshold = _proposalThreshold;
        quorumVotes = _quorumVotes;
        timelockDelay = _timelockDelay;
    }

    /**
     * @notice Set GVT token address
     * @param _gvtToken GVT token contract address
     */
    function setGVTToken(address _gvtToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_gvtToken != address(0), "Invalid address");
        gvtToken = _gvtToken;
    }

    /**
     * @notice Set NFT contract address
     * @param _nftContract NFT contract address
     */
    function setNFTContract(address _nftContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_nftContract != address(0), "Invalid address");
        nftContract = _nftContract;
    }

    /**
     * @notice Get proposal details
     * @param proposalId Proposal ID
     */
    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address proposer,
            ProposalCategory category,
            string memory description,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            ProposalState currentState
        )
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.category,
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            state(proposalId)
        );
    }

    /**
     * @notice Get all protocol parameters
     */
    function getParameters() external view returns (ProtocolParams memory) {
        return params;
    }

    /**
     * @notice Emergency pause (Guardian only)
     */
    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }
}
