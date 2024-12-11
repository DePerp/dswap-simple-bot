require('dotenv').config();
const { ethers } = require("ethers");
const WalletManager = require("../utils/wallet-manager");

async function scanAndConsolidate() {
    try {
        console.log("=== Starting Wallet Scan & Consolidation on Base Network ===");
        
        const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
        const walletManager = new WalletManager(process.env.MNEMONIC_PHRASE);
        
     
        const network = await provider.getNetwork();
        console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
        
      
        const gasSettings = {
            maxFeePerGas: ethers.utils.parseUnits("0.1", "gwei"),
            maxPriorityFeePerGas: ethers.utils.parseUnits("0.1", "gwei"),
            gasLimit: 21000
        };
        
        console.log("\nGas settings:");
        console.log(`Max Fee: ${ethers.utils.formatUnits(gasSettings.maxFeePerGas, "gwei")} gwei`);
        console.log(`Max Priority Fee: ${ethers.utils.formatUnits(gasSettings.maxPriorityFeePerGas, "gwei")} gwei`);
        
    
        console.log("\nScanning wallet tree (10 accounts x 20 wallets)...");
        const walletsWithBalance = await walletManager.scanWalletTree(provider, 10, 20);
        
     
        const stats = await walletManager.getWalletStats();
        console.log("\n=== Scan Results ===");
        console.log(`Total wallets scanned: ${stats.totalWallets}`);
        console.log(`Wallets with balance: ${stats.walletsWithBalance}`);
        console.log(`Total balance: ${stats.totalBalance} ETH`);
        
        if (stats.walletsWithBalance > 0) {
            console.log("\nWallets with balance found:");
            stats.balanceDistribution.forEach((wallet, index) => {
                console.log(`\n${index + 1}. Address: ${wallet.address}`);
                console.log(`   Balance: ${wallet.balance} ETH`);
                console.log(`   Path: ${wallet.path}`);
            });
            
            if (stats.walletsWithBalance > 1) {
                console.log("\n=== Starting Balance Consolidation ===");
                const destinationAddress = stats.balanceDistribution[0].address;
                console.log(`Consolidating all balances to: ${destinationAddress}`);
                
                const results = await walletManager.consolidateBalances(
                    provider, 
                    destinationAddress,
                    gasSettings
                );
                
                console.log("\n=== Consolidation Results ===");
                console.log(`Successful transfers: ${results.filter(r => r.success).length}`);
                console.log(`Failed transfers: ${results.filter(r => !r.success).length}`);
                
             
                results.forEach((result, index) => {
                    console.log(`\nTransfer ${index + 1}:`);
                    console.log(`From: ${result.from}`);
                    console.log(`Amount: ${result.amount} ETH`);
                    console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
                    if (result.success) {
                        console.log(`TX Hash: ${result.txHash}`);
                    } else {
                        console.log(`Error: ${result.error}`);
                    }
                });
                
            
                const finalBalance = await provider.getBalance(destinationAddress);
                console.log(`\nFinal balance at ${destinationAddress}: ${ethers.utils.formatEther(finalBalance)} ETH`);
            }
        } else {
            console.log("\nNo wallets with balance found");
        }
        
    } catch (error) {
        console.error("Error during scan and consolidation:", error);
        throw error;
    }
}


console.log("Starting scan and consolidation script...");
scanAndConsolidate()
    .then(() => {
        console.log("\nScript completed successfully!");
        process.exit(0);
    })
    .catch(error => {
        console.error("Script failed:", error);
        process.exit(1);
    }); 