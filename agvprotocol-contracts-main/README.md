
###  Getting Started

#### Prerequisites

- **[Foundry](https://book.getfoundry.sh/getting-started/installation)**: You need Foundry to compile, test, and deploy the contracts.
    
- **`.env` file**: Create a `.env` file based on the `env.example` to configure your private key, contract addresses, and API keys.
    

#### Installation

1. Clone the repository and navigate into the project directory.
    
    
    ```
    git clone https://github.com/AGV-Protocol/agvprotocol-contracts.git
    cd agvprotocol-contracts
    ```
    
2. Install the project dependencies using the provided `Makefile`.
    
    
    ```
    make install
    ```
    

---

### Testing

The `Makefile` provides several commands for testing.

- Run all tests:
    
    
    ```
    make test
    ```
    
- Run tests and get a gas usage report:
    
    
    
    ```
    make test-gas
    ```
    
- Run test coverage analysis:
    
    
    
    ```
    make test-coverage
    ```
    

---

### 🚀 Deployment & Management Commands

The `Makefile` simplifies deployment to different networks. You must have your `.env` file configured with the required variables (`PRIVATE_KEY`, `RPC_URL`, etc.) for these commands to work.

#### SeedPass Contract

| Action                  | Command                     |
| ----------------------- | --------------------------- |
| **Deploy (Local)**      | `make deploy-sp-local`      |
| **Deploy (Sepolia)**    | `make deploy-sp-sepolia`    |
| **Deploy (Polygon)**    | `make deploy-sp-polygon`    |
| **Upgrade (Local)**     | `make upgrade-sp-local`     |
| **Upgrade (Sepolia)**   | `make upgrade-sp-sepolia`   |
| **Upgrade (Polygon)**   | `make upgrade-sp-polygon`   |
| **Verify (Sepolia)**    | `make verify-sp-sepolia`    |
| **Verify (Polygon)**    | `make verify-sp-polygon`    |
| **Configure (Sepolia)** | `make configure-sp-sepolia` |
| **Configure (Polygon)** | `make configure-sp-polygon` |

#### TreePass Contract

|Action|Command|
|---|---|
|**Deploy (Local)**|`make deploy-tp-local`|
|**Deploy (Sepolia)**|`make deploy-tp-sepolia`|
|**Deploy (Polygon)**|`make deploy-tp-polygon`|
|**Upgrade (Local)**|`make upgrade-tp-local`|
|**Upgrade (Sepolia)**|`make upgrade-tp-sepolia`|
|**Upgrade (Polygon)**|`make upgrade-tp-polygon`|
|**Verify (Sepolia)**|`make verify-tp-sepolia`|
|**Verify (Polygon)**|`make verify-tp-polygon`|
|**Configure (Sepolia)**|`make configure-tp-sepolia`|
|**Configure (Polygon)**|`make configure-tp-polygon`|


#### SolarPass Contract

|Action|Command|
|---|---|
|**Deploy (Local)**|`make deploy-slp-local`|
|**Deploy (Sepolia)**|`make deploy-slp-sepolia`|
|**Deploy (Polygon)**|`make deploy-slp-polygon`|
|**Upgrade (Local)**|`make upgrade-slp-local`|
|**Upgrade (Sepolia)**|`make upgrade-slp-sepolia`|
|**Upgrade (Polygon)**|`make upgrade-slp-polygon`|
|**Verify (Sepolia)**|`make verify-slp-sepolia`|
|**Verify (Polygon)**|`make verify-slp-polygon`|
|**Configure (Sepolia)**|`make configure-slp-sepolia`|
|**Configure (Polygon)**|`make configure-slp-polygon`|

#### ComputePass Contract

|Action|Command|
|---|---|
|**Deploy (Local)**|`make deploy-cp-local`|
|**Deploy (Sepolia)**|`make deploy-cp-sepolia`|
|**Deploy (Polygon)**|`make deploy-cp-polygon`|
|**Upgrade (Local)**|`make upgrade-cp-local`|
|**Upgrade (Sepolia)**|`make upgrade-cp-sepolia`|
|**Upgrade (Polygon)**|`make upgrade-cp-polygon`|
|**Verify (Sepolia)**|`make verify-cp-sepolia`|
|**Verify (Polygon)**|`make verify-cp-polygon`|
|**Configure (Sepolia)**|`make configure-cp-sepolia`|
|**Configure (Polygon)**|`make configure-cp-polygon`|


---

### ⚙️ Other Utilities

- **Start Local Node**: Start a local Anvil node with a Polygon fork.
    
    
    
    ```
    make node
    ```
    
- **Check Balances**: Check the balance of your deployer wallet.
    
    
    
    ```
    make check-balance
    ```
    
- **Help**: For a full list of all available commands and their descriptions, run:
    
    
    
    ```
    make help
    ```