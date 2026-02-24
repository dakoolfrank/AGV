#!/bin/bash

# AGV Protocol - Deployment Script
# Usage: ./script/deploy.sh [network] [options]
# Example: ./script/deploy.sh bscTestnet --verify

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if network argument provided
if [ -z "$1" ]; then
    print_error "Network argument required"
    echo ""
    echo "Usage: ./script/deploy.sh [network] [options]"
    echo ""
    echo "Available networks:"
    echo "  localhost       - Local Anvil/Hardhat network"
    echo "  sepolia         - Ethereum Sepolia testnet"
    echo "  bscTestnet      - BSC testnet"
    echo "  arbitrumSepolia - Arbitrum Sepolia testnet"
    echo "  bsc             - BSC mainnet (PRODUCTION)"
    echo "  arbitrum        - Arbitrum mainnet (PRODUCTION)"
    echo ""
    echo "Options:"
    echo "  --verify        - Verify contracts on block explorer"
    echo "  --broadcast     - Broadcast transactions (required)"
    echo "  --slow          - Use slower deployment for mainnet"
    echo ""
    echo "Example:"
    echo "  ./script/deploy.sh bscTestnet --verify --broadcast"
    exit 1
fi

NETWORK=$1
shift # Remove network from arguments

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    print_success "Loaded .env file"
else
    print_error ".env file not found"
    exit 1
fi

# Set RPC URL based on network
case $NETWORK in
    localhost)
        RPC_URL="http://127.0.0.1:8545"
        SCRIPT="script/Deploy.s.sol"
        ;;
    sepolia)
        RPC_URL=$SEPOLIA_RPC_URL
        SCRIPT="script/DeployTestnet.s.sol"
        ;;
    bscTestnet)
        RPC_URL=$BSC_TESTNET_RPC_URL
        SCRIPT="script/DeployTestnet.s.sol"
        ;;
    arbitrumSepolia)
        RPC_URL=$ARBITRUM_SEPOLIA_RPC_URL
        SCRIPT="script/DeployTestnet.s.sol"
        ;;
    bsc)
        RPC_URL=$BSC_RPC_URL
        SCRIPT="script/DeployMainnet.s.sol"
        print_warning "MAINNET DEPLOYMENT - PRODUCTION NETWORK"
        ;;
    arbitrum)
        RPC_URL=$ARBITRUM_RPC_URL
        SCRIPT="script/DeployMainnet.s.sol"
        print_warning "MAINNET DEPLOYMENT - PRODUCTION NETWORK"
        ;;
    *)
        print_error "Unknown network: $NETWORK"
        exit 1
        ;;
esac

# Validate RPC URL
if [ -z "$RPC_URL" ]; then
    print_error "RPC URL not set for network: $NETWORK"
    print_info "Please set the appropriate RPC URL in .env file"
    exit 1
fi

# Validate private key
if [ -z "$PRIVATE_KEY" ]; then
    print_error "PRIVATE_KEY not set in .env file"
    exit 1
fi

echo ""
echo "=========================================="
echo "AGV Protocol Deployment"
echo "=========================================="
echo "Network:      $NETWORK"
echo "RPC URL:      $RPC_URL"
echo "Script:       $SCRIPT"
echo "=========================================="
echo ""

# Confirmation for mainnet
if [[ "$NETWORK" == "bsc" ]] || [[ "$NETWORK" == "arbitrum" ]]; then
    print_warning "You are about to deploy to MAINNET!"
    print_warning "This will use real funds and deploy production contracts."
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_info "Deployment cancelled"
        exit 0
    fi
    echo ""
fi

# Build contracts
print_info "Building contracts..."
forge build
if [ $? -ne 0 ]; then
    print_error "Build failed"
    exit 1
fi
print_success "Build successful"
echo ""

# Run deployment
print_info "Starting deployment..."
echo ""

DEPLOY_CMD="forge script $SCRIPT --rpc-url $RPC_URL $@"

echo "Running command:"
echo "$DEPLOY_CMD"
echo ""

$DEPLOY_CMD

if [ $? -ne 0 ]; then
    print_error "Deployment failed"
    exit 1
fi

echo ""
print_success "Deployment completed!"
echo ""

# Check if verification is needed
if [[ "$@" == *"--verify"* ]]; then
    print_info "Contracts will be verified automatically"
else
    print_info "To verify contracts later, run:"
    echo "  forge script script/Verify.s.sol --rpc-url $RPC_URL"
fi

echo ""
print_info "Next steps:"
echo "  1. Check deployment logs above"
echo "  2. Verify contracts on block explorer"
echo "  3. Save deployment addresses"
echo "  4. Update frontend configuration"
if [[ "$NETWORK" == "bsc" ]] || [[ "$NETWORK" == "arbitrum" ]]; then
    echo "  5. Transfer admin roles to multisig"
    echo "  6. Revoke deployer privileges"
    echo "  7. Initialize liquidity pools"
    echo "  8. Announce deployment"
fi
echo ""