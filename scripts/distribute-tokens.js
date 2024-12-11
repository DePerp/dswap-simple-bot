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
        
        // Start distribution
        console.log("Starting token distribution...");
        console.log(`Source wallet: ${sourceWallet.address}`);
        
        // Helper function to generate random amount between 0.5 and 2
        const getRandomAmount = () => {
            return (Math.random() * (2 - 0.5) + 0.5).toFixed(3);
        };
        
        const totalWallets = 1000; 
        
        const results = await walletManager.distributeTokens(
            provider,
            sourceWallet,
            tokenContract,
            getRandomAmount(), 
            totalWallets,
            overrides
        );
        
        // Save results to file
        const fs = require('fs');
        fs.writeFileSync(
            'distribution-results.json',
            JSON.stringify(results, null, 2)
        );
        
        console.log("Distribution complete! Results saved to distribution-results.json");
        
    } catch (error) {
        console.error("Distribution failed:", error.message);
        if (error.stack) {
            console.error("Stack trace:", error.stack);
        }
    }
}

// Run the distribution
distributeTokens().catch(console.error); 