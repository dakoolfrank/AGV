// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BatchAirdrop
 * @notice 从 JSON 文件读取收件人名单，批量转 pGVT / sGVT
 *
 * @dev Prerequisites:
 *   - pGVT and sGVT already deployed (run AirdropMint first)
 *   - Your wallet holds enough pGVT and sGVT to cover all transfers
 *
 * Usage:
 *   1. Edit  script/BatchAirdrop.json  (收件人名单)
 *   2. Run:
 *      forge script script/BatchAirdrop.s.sol:BatchAirdrop \
 *        --rpc-url https://bsc-dataseed.binance.org \
 *        --broadcast
 *
 * Required .env:
 *   PRIVATE_KEY=0x...
 *   PGVT_ADDRESS=0x...      (deployed pGVT contract)
 *   SGVT_ADDRESS=0x...      (deployed sGVT contract)
 */
contract BatchAirdrop is Script {
    // vm.parseJson 要求 struct 字段按字母序排列
    struct Entry {
        string name;    // 备注名（仅标识，不上链）
        uint256 pgvt;   // 整数（如 50000 = 50,000 个）
        uint256 sgvt;   // 整数
        address wallet;
    }

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address sender = vm.addr(deployerKey);
        address pgvt = vm.envAddress("PGVT_ADDRESS");
        address sgvt = vm.envAddress("SGVT_ADDRESS");

        // ---- 从 JSON 读取收件人列表 ----
        string memory json = vm.readFile("script/BatchAirdrop.json");
        bytes memory raw = vm.parseJson(json, ".recipients");
        Entry[] memory list = abi.decode(raw, (Entry[]));
        require(list.length > 0, "Empty recipient list");

        // ---- Pre-flight: 汇总 + 余额检查 ----
        uint256 totalPgvt;
        uint256 totalSgvt;
        for (uint256 i; i < list.length; i++) {
            totalPgvt += list[i].pgvt;
            totalSgvt += list[i].sgvt;
        }
        totalPgvt *= 1e18;
        totalSgvt *= 1e18;

        uint256 pgvtBal = IERC20(pgvt).balanceOf(sender);
        uint256 sgvtBal = IERC20(sgvt).balanceOf(sender);

        console.log("========== BatchAirdrop ==========");
        console.log("Sender     :", sender);
        console.log("Recipients :", list.length);
        console.log("-----------------------------------");
        console.log("Total pGVT :", totalPgvt / 1e18);
        console.log("Total sGVT :", totalSgvt / 1e18);
        console.log("Your  pGVT :", pgvtBal / 1e18);
        console.log("Your  sGVT :", sgvtBal / 1e18);
        console.log("===================================\n");

        require(pgvtBal >= totalPgvt, "Insufficient pGVT balance");
        require(sgvtBal >= totalSgvt, "Insufficient sGVT balance");

        // ---- 批量转账 ----
        vm.startBroadcast(deployerKey);

        for (uint256 i; i < list.length; i++) {
            Entry memory e = list[i];
            if (e.pgvt > 0) {
                IERC20(pgvt).transfer(e.wallet, e.pgvt * 1e18);
                console.log("pGVT ->", e.name, e.wallet, e.pgvt);
            }
            if (e.sgvt > 0) {
                IERC20(sgvt).transfer(e.wallet, e.sgvt * 1e18);
                console.log("sGVT ->", e.name, e.wallet, e.sgvt);
            }
        }

        vm.stopBroadcast();

        console.log("\n========== Done ==========");
        console.log("Remaining pGVT:", IERC20(pgvt).balanceOf(sender) / 1e18);
        console.log("Remaining sGVT:", IERC20(sgvt).balanceOf(sender) / 1e18);
    }
}
