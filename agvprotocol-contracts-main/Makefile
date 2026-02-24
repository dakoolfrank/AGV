# Load environment variables
include .env
export

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

##@ Installation
install: ## Install dependencies
	@echo "$(CYAN)Installing Foundry dependencies...$(RESET)"
	forge install OpenZeppelin/openzeppelin-contracts@v5.0.0 --no-commit
	forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.0.0 --no-commit
	forge install chiru-labs/ERC721A-Upgradeable --no-commit
	forge install foundry-rs/forge-std --no-commit

update: ## Update dependencies
	@echo "$(CYAN)Updating dependencies...$(RESET)"
	forge update

##@ Building
build: ## Build the project
	@echo "$(CYAN)Building project...$(RESET)"
	forge build

clean: ## Clean build artifacts
	@echo "$(CYAN)Cleaning build artifacts...$(RESET)"
	forge clean

fmt: ## Format code
	@echo "$(CYAN)Formatting code...$(RESET)"
	forge fmt

##@ Testing
test: ## Run tests
	@echo "$(CYAN)Running tests...$(RESET)"
	forge test -vv

test-gas: ## Run tests with gas reporting
	@echo "$(CYAN)Running tests with gas reporting...$(RESET)"
	forge test --gas-report

test-coverage: ## Run test coverage
	@echo "$(CYAN)Running test coverage...$(RESET)"
	forge coverage



##@ Deployment of SeedPass

deploy-sp-local: ## Deploy Seedpass to local network (Anvil)
	@echo "$(CYAN)Deploying SeedPass to local network...$(RESET)"
	@mkdir -p deployments
	forge script script/SeedPass.s.sol:DeploySeedPass --rpc-url local --broadcast -vvvv

deploy-sp-sepolia: ## Deploy SeedPass to Sepolia testnet
	@echo "$(CYAN)Deploying SeedPass to Sepolia...$(RESET)"
	@mkdir -p deployments
	forge script script/SeedPass.s.sol:DeploySeedPass --rpc-url sepolia --broadcast --verify -vvvv

deploy-sp-polygon: ## Deploy SeedPass to Polygon mainnet
	@echo "$(YELLOW)⚠️  WARNING: Deploying SeedPass to POLYGON MAINNET! ⚠️$(RESET)"
	@mkdir -p deployments
	@read -p "Are you sure? [y/N] " -n 1 -r; echo; if [[ $REPLY =~ ^[Yy]$ ]]; then \
		forge script script/SeedPass.s.sol:DeploySeedPass --rpc-url polygon --broadcast --verify -vvvv; \
	fi


##@ Deployment of TreePass

deploy-tp-local: ## Deploy TreePass to local network (Anvil)
	@echo "$(CYAN)Deploying TreePass to local network...$(RESET)"
	@mkdir -p deployments
	forge script script/TreePass.s.sol:DeployTreePass --rpc-url local --broadcast -vvvv

deploy-tp-sepolia: ## Deploy TreePass to Sepolia testnet
	@echo "$(CYAN)Deploying TreePass to Sepolia...$(RESET)"
	@mkdir -p deployments
	forge script script/TreePass.s.sol:DeployTreePass --rpc-url sepolia --broadcast --verify -vvvv

deploy-tp-polygon: ## Deploy TreePass to Polygon mainnet
	@echo "$(YELLOW)⚠️  WARNING: Deploying TreePass to POLYGON MAINNET! ⚠️$(RESET)"
	@mkdir -p deployments
	@read -p "Are you sure? [y/N] " -n 1 -r; echo; if [[ $REPLY =~ ^[Yy]$ ]]; then \
		forge script script/TreePass.s.sol:DeployTreePass --rpc-url polygon --broadcast --verify -vvvv; \
	fi

##@ Deployment of SolarPass

deploy-slp-local: ## Deploy SolarPass to local network (Anvil)
	@echo "$(CYAN)Deploying SolarPass to local network...$(RESET)"
	@mkdir -p deployments
	forge script script/SolarPass.s.sol:DeploySolarPass --rpc-url local --broadcast -vvvv

deploy-slp-sepolia: ## Deploy SolarPass to Sepolia testnet
	@echo "$(CYAN)Deploying SolarPass to Sepolia...$(RESET)"
	@mkdir -p deployments
	forge script script/SolarPass.s.sol:DeploySolarPass --rpc-url sepolia --broadcast --verify -vvvv

deploy-slp-polygon: ## Deploy SolarPass to Polygon mainnet
	@echo "$(YELLOW)⚠️  WARNING: Deploying SolarPass to POLYGON MAINNET! ⚠️$(RESET)"
	@mkdir -p deployments
	@read -p "Are you sure? [y/N] " -n 1 -r; echo; if [[ $REPLY =~ ^[Yy]$ ]]; then \
		forge script script/SolarPass.s.sol:DeploySolarPass --rpc-url polygon --broadcast --verify -vvvv; \
	fi


##@ Deployment of ComputePass

deploy-cp-local: ## Deploy ComputePass to local network (Anvil)
	@echo "$(CYAN)Deploying ComputePass to local network...$(RESET)"
	@mkdir -p deployments
	forge script script/ComputePass.s.sol:DeployComputePass --rpc-url local --broadcast -vvvv

deploy-cp-sepolia: ## Deploy ComputePass to Sepolia testnet
	@echo "$(CYAN)Deploying ComputePass to Sepolia...$(RESET)"
	@mkdir -p deployments
	forge script script/ComputePass.s.sol:DeployComputePass --rpc-url sepolia --broadcast --verify -vvvv

deploy-cp-polygon: ## Deploy ComputePass to Polygon mainnet
	@echo "$(YELLOW)⚠️  WARNING: Deploying ComputePass to POLYGON MAINNET! ⚠️$(RESET)"
	@mkdir -p deployments
	@read -p "Are you sure? [y/N] " -n 1 -r; echo; if [[ $REPLY =~ ^[Yy]$ ]]; then \
		forge script script/ComputePass.s.sol:DeployComputePass --rpc-url polygon --broadcast --verify -vvvv; \
	fi




##@ Upgrading SeedPass
upgrade-sp-local: ## Upgrade seedpass contract on local network
	@echo "$(CYAN)Upgrading SeedPass on local network...$(RESET)"
	forge script script/SeedPass.s.sol:UpgradeSeedPass --rpc-url local --broadcast -vvvv

upgrade-sp-sepolia: ## Upgrade contract on Sepolia
	@echo "$(CYAN)Upgrading SeedPass on Sepolia...$(RESET)"
	forge script script/SeedPass.s.sol:UpgradeSeedPass --rpc-url sepolia --broadcast -vvvv

upgrade-sp-polygon: ## Upgrade contract on Polygon
	@echo "$(YELLOW)⚠️  WARNING: Upgrading SeedPass contract on POLYGON MAINNET! ⚠️$(RESET)"
	@read -p "Are you sure? [y/N] " -n 1 -r; echo; if [[ $REPLY =~ ^[Yy]$ ]]; then \
		forge script script/SeedPass.s.sol:UpgradeSeedPass --rpc-url polygon --broadcast -vvvv; \
	fi


##@ Upgrading TreePass
upgrade-tp-local: ## Upgrade treepass contract on local network
	@echo "$(CYAN)Upgrading TreePass on local network...$(RESET)"
	forge script script/TreePass.s.sol:UpgradeTreePass --rpc-url local --broadcast -vvvv

upgrade-tp-sepolia: ## Upgrade contract on Sepolia
	@echo "$(CYAN)Upgrading TreePass on Sepolia...$(RESET)"
	forge script script/TreePass.s.sol:UpgradeTreePass --rpc-url sepolia --broadcast -vvvv

upgrade-tp-polygon: ## Upgrade contract on Polygon
	@echo "$(YELLOW)⚠️  WARNING: Upgrading SeedPass contract on POLYGON MAINNET! ⚠️$(RESET)"
	@read -p "Are you sure? [y/N] " -n 1 -r; echo; if [[ $REPLY =~ ^[Yy]$ ]]; then \
		forge script script/SeedPass.s.sol:UpgradeSeedPass --rpc-url polygon --broadcast -vvvv; \
	fi


##@ Upgrading SolarPass
upgrade-slp-local: ## Upgrade Solarpass contract on local network
	@echo "$(CYAN)Upgrading SolarPass on local network...$(RESET)"
	forge script script/SolarPass.s.sol:UpgradeSolarPass --rpc-url local --broadcast -vvvv

upgrade-slp-sepolia: ## Upgrade contract on Sepolia
	@echo "$(CYAN)Upgrading SolarPass on Sepolia...$(RESET)"
	forge script script/SolarPass.s.sol:UpgradeSolarPass --rpc-url sepolia --broadcast -vvvv

upgrade-slp-polygon: ## Upgrade contract on Polygon
	@echo "$(YELLOW)⚠️  WARNING: Upgrading SolarPass contract on POLYGON MAINNET! ⚠️$(RESET)"
	@read -p "Are you sure? [y/N] " -n 1 -r; echo; if [[ $REPLY =~ ^[Yy]$ ]]; then \
		forge script script/SolarPass.s.sol:UpgradeSolarPass --rpc-url polygon --broadcast -vvvv; \
	fi


##@ Upgrading ComputePass
upgrade-cp-local: ## Upgrade Computepass contract on local network
	@echo "$(CYAN)Upgrading ComputePass on local network...$(RESET)"
	forge script script/ComputePass.s.sol:UpgradeComputePass --rpc-url local --broadcast -vvvv

upgrade-cp-sepolia: ## Upgrade contract on Sepolia
	@echo "$(CYAN)Upgrading ComputePass on Sepolia...$(RESET)"
	forge script script/ComputePass.s.sol:UpgradeComputePass --rpc-url sepolia --broadcast -vvvv

upgrade-cp-polygon: ## Upgrade contract on Polygon
	@echo "$(YELLOW)⚠️  WARNING: Upgrading ComputePass contract on POLYGON MAINNET! ⚠️$(RESET)"
	@read -p "Are you sure? [y/N] " -n 1 -r; echo; if [[ $REPLY =~ ^[Yy]$ ]]; then \
		forge script script/ComputePass.s.sol:UpgradeComputePass --rpc-url polygon --broadcast -vvvv; \
	fi



##@ Configuration SeedPass
configure-sp-sepolia: ## Configure seedPass contract on Sepolia
	@echo "$(CYAN)Configuring SeedPass on Sepolia...$(RESET)"
	forge script script/SeedPass.s.sol:ConfigureSeedPass --rpc-url sepolia --broadcast -vvvv

configure-sp-polygon: ## Configure seedPass contract on Polygon
	@echo "$(CYAN)Configuring SeedPass on Polygon...$(RESET)"
	forge script script/SeedPass.s.sol:ConfigureSeedPass --rpc-url polygon --broadcast -vvvv


##@ Configuration TreePass
configure-tp-sepolia: ## Configure TreePass contract on Sepolia
	@echo "$(CYAN)Configuring TreePass on Sepolia...$(RESET)"
	forge script script/TreePass.s.sol:ConfigureTreePass --rpc-url sepolia --broadcast -vvvv

configure-tp-polygon: ## Configure TreePass contract on Polygon
	@echo "$(CYAN)Configuring TreePass on Polygon...$(RESET)"
	forge script script/TreePass.s.sol:ConfigureTreePass --rpc-url polygon --broadcast -vvvv


##@ Configuration SolarPass
configure-slp-sepolia: ## Configure SolarPass contract on Sepolia
	@echo "$(CYAN)Configuring SolarPass on Sepolia...$(RESET)"
	forge script script/SolarPass.s.sol:ConfigureSolarPass --rpc-url sepolia --broadcast -vvvv

configure-slp-polygon: ## Configure SolarPass contract on Polygon
	@echo "$(CYAN)Configuring SolarPass on Polygon...$(RESET)"
	forge script script/TreePass.s.sol:ConfigureSolarPass --rpc-url polygon --broadcast -vvvv


##@ Configuration ComputePass
configure-cp-sepolia: ## Configure ComputePass contract on Sepolia
	@echo "$(CYAN)Configuring ComputePass on Sepolia...$(RESET)"
	forge script script/ComputePass.s.sol:ConfigureComputePass --rpc-url sepolia --broadcast -vvvv

configure-cp-polygon: ## Configure ComputePass contract on Polygon
	@echo "$(CYAN)Configuring ComputePass on Polygon...$(RESET)"
	forge script script/ComputePass.s.sol:ConfigureComputePass --rpc-url polygon --broadcast -vvvv

	

##@ Verification seedpass

verify-sp-sepolia: ## Verify Seedpass contract on Sepolia
	@echo "$(CYAN)Verifying Seedpass contract on Sepolia...$(RESET)"
	forge verify-contract $(PROXY_ADDRESS) contracts/nft/SeedPass.sol:SeedPass --chain sepolia

verify-sp-polygon: ## Verify Seedpass contract on Polygon
	@echo "$(CYAN)Verifying Seedpass contract on Polygon...$(RESET)"
	forge verify-contract $(PROXY_ADDRESS) contracts/nft/SeedPass.sol:SeedPass --chain polygon


##@ Verification treepass

verify-tp-sepolia: ## Verify Treepass contract on Sepolia
	@echo "$(CYAN)Verifying Treepass contract on Sepolia...$(RESET)"
	forge verify-contract $(PROXY_ADDRESS) contracts/nft/TreePass.sol:TreePass --chain sepolia

verify-tp-polygon: ## Verify Treepass contract on Polygon
	@echo "$(CYAN)Verifying Treepass contract on Polygon...$(RESET)"
	forge verify-contract $(PROXY_ADDRESS) contracts/nft/TreePass.sol:TreePass --chain polygon

##@ Verification Solarpass

verify-slp-sepolia: ## Verify Solarpass contract on Sepolia
	@echo "$(CYAN)Verifying Solarpass contract on Sepolia...$(RESET)"
	forge verify-contract $(PROXY_ADDRESS) contracts/nft/SolarPass.sol:SolarPass --chain sepolia

verify-slp-polygon: ## Verify Solarpass contract on Polygon
	@echo "$(CYAN)Verifying Solarpass contract on Polygon...$(RESET)"
	forge verify-contract $(PROXY_ADDRESS) contracts/nft/SolarPass.sol:SolarPass --chain polygon


##@ Verification Computepass

verify-cp-sepolia: ## Verify Computepass contract on Sepolia
	@echo "$(CYAN)Verifying Computepass contract on Sepolia...$(RESET)"
	forge verify-contract $(PROXY_ADDRESS) contracts/nft/ComputePass.sol:ComputePass --chain sepolia

verify-cp-polygon: ## Verify Computepass contract on Polygon
	@echo "$(CYAN)Verifying Computepass contract on Polygon...$(RESET)"
	forge verify-contract $(PROXY_ADDRESS) contracts/nft/ComputePass.sol:ComputePass --chain polygon






##@ Utilities
node: ## Start local Anvil node with Polygon fork
	@echo "$(CYAN)Starting local Anvil node with Polygon fork...$(RESET)"
	anvil --fork-url $(POLYGON_RPC_URL) --fork-block-number 50000000 --chain-id 1337

console-sepolia: ## Open Forge console on Sepolia
	@echo "$(CYAN)Opening Forge console on Sepolia...$(RESET)"
	forge console --rpc-url sepolia

console-polygon: ## Open Forge console on Polygon
	@echo "$(CYAN)Opening Forge console on Polygon...$(RESET)"
	forge console --rpc-url polygon

console-local: ## Open Forge console on local network
	@echo "$(CYAN)Opening Forge console on local network...$(RESET)"
	forge console --rpc-url local

gas-snapshot: ## Create gas snapshot
	@echo "$(CYAN)Creating gas snapshot...$(RESET)"
	forge snapshot

##@ Information
contract-info: ## Get deployed contract information
ifndef PROXY_ADDRESS
	@echo "$(RED)Error: PROXY_ADDRESS environment variable not set$(RESET)"
	@exit 1
endif
ifndef NETWORK
	@echo "$(RED)Error: NETWORK environment variable not set (mumbai, sepolia, polygon, local)$(RESET)"
	@exit 1
endif
	@echo "$(CYAN)Getting contract information on $(NETWORK)...$(RESET)"
	@cast call $(PROXY_ADDRESS) "name()(string)" --rpc-url $(NETWORK)
	@cast call $(PROXY_ADDRESS) "symbol()(string)" --rpc-url $(NETWORK)
	@cast call $(PROXY_ADDRESS) "totalSupply()(uint256)" --rpc-url $(NETWORK)
	@cast call $(PROXY_ADDRESS) "getCurrentPhase()(string)" --rpc-url $(NETWORK)

check-balance: ## Check deployer balance
ifndef NETWORK
	@echo "$(RED)Error: NETWORK environment variable not set (mumbai, sepolia, polygon, local)$(RESET)"
	@exit 1
endif
	@echo "$(CYAN)Checking deployer balance on $(NETWORK)...$(RESET)"
	@cast balance $(shell cast wallet address --private-key $(PRIVATE_KEY)) --rpc-url $(NETWORK)

##@ Security
slither-sp: ## Run Slither static analysis
	@echo "$(CYAN)Running Slither analysis for SeedPass...$(RESET)"
	slither contracts/nft/SeedPass.sol

mythril-sp: ## Run Mythril security analysis
	@echo "$(CYAN)Running Mythril analysis for SeedPass...$(RESET)"
	myth analyze contracts/nft/SeedPass.sol --solv 0.8.20

##@ Documentation
docs: ## Generate documentation
	@echo "$(CYAN)Generating documentation...$(RESET)"
	forge doc --build

serve-docs: ## Serve documentation locally
	@echo "$(CYAN)Serving documentation at http://localhost:3000$(RESET)"
	forge doc --serve --port 3000

##@ Helpers
help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\n$(CYAN)SeedPass Deployment Makefile$(RESET)\n\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

env-check: ## Check environment variables
	@echo "$(CYAN)Checking environment variables...$(RESET)"
	@if [ -z "$(PRIVATE_KEY)" ]; then echo "$(RED)❌ PRIVATE_KEY not set$(RESET)"; else echo "$(GREEN)✅ PRIVATE_KEY set$(RESET)"; fi
	@if [ -z "$(OWNER_ADDRESS)" ]; then echo "$(RED)❌ OWNER_ADDRESS not set$(RESET)"; else echo "$(GREEN)✅ OWNER_ADDRESS: $(OWNER_ADDRESS)$(RESET)"; fi
	@if [ -z "$(TREASURY_ADDRESS)" ]; then echo "$(RED)❌ TREASURY_ADDRESS not set$(RESET)"; else echo "$(GREEN)✅ TREASURY_ADDRESS: $(TREASURY_ADDRESS)$(RESET)"; fi
	@if [ -z "$(POLYGON_RPC_URL)" ]; then echo "$(RED)❌ POLYGON_RPC_URL not set$(RESET)"; else echo "$(GREEN)✅ POLYGON_RPC_URL set$(RESET)"; fi
	@if [ -z "$(MUMBAI_RPC_URL)" ]; then echo "$(RED)❌ MUMBAI_RPC_URL not set$(RESET)"; else echo "$(GREEN)✅ MUMBAI_RPC_URL set$(RESET)"; fi
	@if [ -z "$(SEPOLIA_RPC_URL)" ]; then echo "$(RED)❌ SEPOLIA_RPC_URL not set$(RESET)"; else echo "$(GREEN)✅ SEPOLIA_RPC_URL set$(RESET)"; fi

.PHONY: install update build clean fmt test test-gas test-coverage deploy-local deploy-mumbai deploy-sepolia deploy-polygon upgrade-local upgrade-mumbai upgrade-sepolia upgrade-polygon configure-mumbai configure-sepolia configure-polygon verify-mumbai verify-sepolia verify-polygon node node-mumbai console-mumbai console-sepolia console-polygon console-local gas-snapshot contract-info check-balance slither mythril docs serve-docs help env-check