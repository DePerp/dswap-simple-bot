require('dotenv').config();
const { ethers } = require("ethers");
const WalletManager = require("../utils/wallet-manager");

async function distributeTokens() {
    try {
        
        if (!process.env.WALLET_PRIVATE_KEY) {
            throw new Error("WALLET_PRIVATE_KEY not found in .env file");
        }
        if (!process.env.MNEMONIC_PHRASE) {
            throw new Error("MNEMONIC_PHRASE not found in .env file");
        }
        if (!process.env.TOKEN_ADDRESS) {
            throw new Error("TOKEN_ADDRESS not found in .env file");
        }
        if (!process.env.RPC_URL) {
            throw new Error("RPC_URL not found in .env file");
        }
        if (!process.env.ACCOUNTS_LIST_PATH) {
            throw new Error("ACCOUNTS_LIST_PATH not found in .env file");
        }

     
        const privateKey = process.env.WALLET_PRIVATE_KEY.startsWith('0x') 
            ? process.env.WALLET_PRIVATE_KEY 
            : `0x${process.env.WALLET_PRIVATE_KEY}`;

        // Gas settings for Base network
        const MAX_FEE_PER_GAS = ethers.utils.parseUnits("2", "gwei");
        const MAX_PRIORITY_FEE_PER_GAS = ethers.utils.parseUnits("0.001", "gwei");
        
        // Initialize provider and wallet manager
        const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
        const walletManager = new WalletManager(process.env.MNEMONIC_PHRASE);
        
        // Initialize source wallet
        const sourceWallet = new ethers.Wallet(privateKey, provider);
        console.log("\nDistribution Wallet Details:");
        console.log(`Address: ${sourceWallet.address}`);
        console.log(`Private key used: ${process.env.WALLET_PRIVATE_KEY.slice(0, 6)}...`);
        
      
        const balance = await sourceWallet.getBalance();
        console.log(`ETH balance: ${ethers.utils.formatEther(balance)} ETH`);
        
        // Initialize token contract with gas settings
        const tokenContract = new ethers.Contract(
            process.env.TOKEN_ADDRESS,
            [
                "function transfer(address to, uint256 amount) returns (bool)",
                "function balanceOf(address account) view returns (uint256)",
                "function decimals() view returns (uint8)"
            ],
            sourceWallet
        );

    
        const overrides = {
            maxFeePerGas: MAX_FEE_PER_GAS,
            maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
            gasLimit: 100000,
            type: 2 // EIP-1559
        };

      
        const tokenBalance = await tokenContract.balanceOf(sourceWallet.address);
        const decimals = await tokenContract.decimals();
        console.log(`Token balance: ${ethers.utils.formatUnits(tokenBalance, decimals)}`);
        
        if (tokenBalance.lt(ethers.utils.parseUnits("1000", decimals))) {
            throw new Error("Insufficient token balance. Need at least 1000 tokens");
        }
        
        // Read accounts from file
        const fs = require('fs');
        let accounts;
        try {
            const accountsData = fs.readFileSync(process.env.ACCOUNTS_LIST_PATH, 'utf8');
            accounts = JSON.parse(accountsData);
            if (!Array.isArray(accounts)) {
                throw new Error("Accounts file must contain an array of objects");
            }
            // Validate format of each entry
            accounts.forEach((entry, index) => {
                if (!entry.address || !entry.amount) {
                    throw new Error(`Invalid entry at index ${index}. Each entry must have 'address' and 'amount' fields`);
                }
                if (typeof entry.amount !== 'number' && typeof entry.amount !== 'string') {
                    throw new Error(`Invalid amount format at index ${index}. Amount must be a number or string`);
                }
            });
        } catch (error) {
            throw new Error(`Failed to read accounts file: ${error.message}`);
        }

        // Calculate total amount needed
        const totalAmount = accounts.reduce((sum, entry) => {
            return sum + parseFloat(entry.amount);
        }, 0);

        console.log("Starting token distribution...");
        console.log(`Source wallet: ${sourceWallet.address}`);
        console.log(`Total accounts to distribute: ${accounts.length}`);
        console.log(`Total amount to distribute: ${totalAmount}`);

        // Check if we have enough tokens
        if (tokenBalance.lt(ethers.utils.parseUnits(totalAmount.toString(), decimals))) {
            throw new Error(`Insufficient token balance. Need ${totalAmount} tokens`);
        }

        const results = {
            successful: [],
            failed: []
        };

        for (let i = 0; i < accounts.length; i++) {
            const { address: targetAddress, amount } = accounts[i];
            
            try {
                console.log(`[${i + 1}/${accounts.length}] Sending ${amount} tokens to ${targetAddress}`);
                
                const tx = await tokenContract.transfer(
                    targetAddress,
                    ethers.utils.parseUnits(amount.toString(), decimals),
                    overrides
                );
                
                const receipt = await tx.wait();
                
                results.successful.push({
                    address: targetAddress,
                    amount: amount,
                    txHash: receipt.transactionHash
                });
                
                console.log(`✓ Transaction confirmed: ${receipt.transactionHash}`);
            } catch (error) {
                console.error(`✗ Failed to send to ${targetAddress}: ${error.message}`);
                results.failed.push({
                    address: targetAddress,
                    error: error.message
                });
            }
            
            // Add small delay between transactions
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Save results to file
        fs.writeFileSync(
            'distribution-results.json',
            JSON.stringify(results, null, 2)
        );
        
        console.log("\nDistribution Summary:");
        console.log(`Successfully sent to: ${results.successful.length} addresses`);
        console.log(`Failed transfers: ${results.failed.length} addresses`);
        console.log("Full results saved to distribution-results.json");
        
    } catch (error) {
        console.error("Distribution failed:", error.message);
        if (error.stack) {
            console.error("Stack trace:", error.stack);
        }
    }
}

// Run the distribution
distributeTokens().catch(console.error); 