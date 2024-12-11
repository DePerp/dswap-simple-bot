require('dotenv').config();
const { ethers } = require("ethers");
const TokenSwap = require("../utils/example-swap");
const WalletManager = require("../utils/wallet-manager");
const path = require('path');
const fs = require('fs');

class TradingBot {
    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
        this.walletManager = new WalletManager(process.env.MNEMONIC_PHRASE);
        this.swapCount = 0;
        this.currentWallet = null;
        this.GAS_RESERVE = ethers.utils.parseEther("0.0001"); // Reserve 0.0001 ETH for gas
        this.TOKEN_RESERVE = ethers.utils.parseUnits("1", 18); // Reserve 1 token
        
        // Gas settings for Base network
        this.MAX_FEE_PER_GAS = ethers.utils.parseUnits("2", "gwei"); // 2 gwei max
        this.MAX_PRIORITY_FEE_PER_GAS = ethers.utils.parseUnits("0.001", "gwei"); // 0.001 gwei max priority
        this.MIN_CONFIRMATIONS = 1;
        this.MAX_SWAPS_PER_WALLET = 5 + Math.floor(Math.random() * 6);
        this.logFile = path.join(__dirname, '../logs/trading.log');
        this.activeWallets = new Map(); // Store wallets with balance
        this.minimumBalance = ethers.utils.parseEther("0.001"); // Minimum balance to consider wallet active
    }

    async logOperation(operation) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${operation}\n`;
        fs.appendFileSync(this.logFile, logEntry);
        console.log(logEntry);
    }

    async initializeWallet() {
        // Scan wallet tree first
        await this.scanForActiveWallets();
        
        // Get wallet with highest balance
        const wallet = await this.getBestWallet();
        if (!wallet) {
            throw new Error("No wallets with sufficient balance found");
        }
        
        this.currentWallet = wallet;
        this.tokenSwap = new TokenSwap(
            process.env.TOKEN_ADDRESS,
            this.provider,
            this.currentWallet
        );
        
        await this.handleExistingTokens();
    }

    async scanForActiveWallets() {
        console.log("Scanning for active wallets...");
        const walletsWithBalance = await this.walletManager.scanWalletTree(this.provider);
        
        // Clear existing active wallets
        this.activeWallets.clear();
        
        // Filter and store wallets with sufficient balance
        for (const walletInfo of walletsWithBalance) {
            const balance = ethers.utils.parseEther(walletInfo.balance);
            if (balance.gt(this.minimumBalance)) {
                this.activeWallets.set(walletInfo.address, {
                    ...walletInfo,
                    balance: balance
                });
            }
        }
        
        // If no active wallets found or less than minimum required, create new ones
        if (this.activeWallets.size < 3) { 
            console.log("Insufficient active wallets, creating new ones...");
            await this.createNewWallets();
        }
        
        console.log(`Found ${this.activeWallets.size} active wallets`);
    }

    async createNewWallets() {
        try {
            // Get the main wallet (first wallet from mnemonic)
            const mainWallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC_PHRASE).connect(this.provider);
            const mainBalance = await mainWallet.getBalance();
            
            // Check if main wallet has enough ETH to distribute
            if (mainBalance.lt(ethers.utils.parseEther("0.005"))) {
                console.log("Main wallet has insufficient balance to create new wallets");
                return;
            }

            // Create 5 new wallets
            for (let i = 0; i < 5; i++) {
                const path = this.walletManager.generateWallet();
                const newWallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC_PHRASE, path).connect(this.provider);
                
                // Send some ETH to new wallet (0.001 ETH)
                const tx = {
                    to: newWallet.address,
                    value: ethers.utils.parseEther("0.001"),
                    maxFeePerGas: this.MAX_FEE_PER_GAS,
                    maxPriorityFeePerGas: this.MAX_PRIORITY_FEE_PER_GAS
                };
                
                const transaction = await mainWallet.sendTransaction(tx);
                await transaction.wait(1);
                
                // Log new wallet info
                const walletInfo = {
                    address: newWallet.address,
                    path: path,
                    privateKey: newWallet.privateKey,
                    balance: "0.001",
                    accountIndex: this.walletManager.currentAccountIndex,
                    walletIndex: this.walletManager.currentWalletIndex - 1
                };
                
                this.walletManager.logWalletInfo(walletInfo);
                
                // Add to active wallets
                this.activeWallets.set(newWallet.address, {
                    ...walletInfo,
                    balance: ethers.utils.parseEther("0.001")
                });
                
                // Wait a bit between transactions
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error("Error creating new wallets:", error);
        }
    }

    async getBestWallet() {
        // Sort wallets by balance and get the one with highest balance
        const sortedWallets = Array.from(this.activeWallets.values())
            .sort((a, b) => b.balance.sub(a.balance));
        
        if (sortedWallets.length === 0) {
            return null;
        }

        const bestWalletInfo = sortedWallets[0];
        return ethers.Wallet.fromMnemonic(
            process.env.MNEMONIC_PHRASE,
            bestWalletInfo.path
        ).connect(this.provider);
    }

    async handleExistingTokens() {
        try {
            const tokenBalance = await this.tokenSwap.getTokenBalance(this.currentWallet.address);
            console.log("Raw token balance:", tokenBalance.toString());
            
            // Get current reserves to check limits
            const [ethReserve, tokenReserve] = await this.tokenSwap.tokenContract.getReserves();
            console.log("Current reserves - ETH:", ethers.utils.formatEther(ethReserve), "Token:", ethers.utils.formatUnits(tokenReserve, 18));
            
            
            const availableTokens = tokenBalance.sub(this.TOKEN_RESERVE);
            
            if (availableTokens.gt(0)) {
                console.log(`Found existing tokens: ${ethers.utils.formatUnits(tokenBalance, 18)}`);
                
          
                const maxSellAmount = tokenReserve.mul(10).div(100);
                const sellAmount = availableTokens.gt(maxSellAmount) ? maxSellAmount : availableTokens;
                
                console.log(`Selling amount: ${ethers.utils.formatUnits(sellAmount, 18)} tokens`);
                console.log(`(${sellAmount.mul(100).div(tokenReserve)}% of contract reserve)`);
                
                // Sell tokens
                const result = await this.tokenSwap.sellTokens(sellAmount);
                console.log(`Initial token sell ${result.success ? 'successful' : 'failed'}:`, result);
                
                if (result.success) {
                    await new Promise(resolve => setTimeout(resolve, 30000));
                } else {
                    console.log("Failed to sell tokens, will try again later");
                }
            }
        } catch (error) {
            console.error("Error handling existing tokens:", error);
            console.log("Token balance type:", typeof tokenBalance);
            console.log("Token balance value:", tokenBalance?.toString());
        }
    }

    async rotateWallet() {
        try {
            await this.logOperation("=== Starting wallet rotation ===");
            
            // Sell remaining tokens before rotation
            await this.handleExistingTokens();
            
            // Remove current wallet from active wallets
            this.activeWallets.delete(this.currentWallet.address);
            
            // Get next best wallet
            const newWallet = await this.getBestWallet();
            if (!newWallet) {
                await this.logOperation("No more active wallets available. Rescanning...");
                await this.scanForActiveWallets();
                const wallet = await this.getBestWallet();
                if (!wallet) {
                    throw new Error("No wallets with sufficient balance found");
                }
                return wallet;
            }
            
            this.currentWallet = newWallet;
            this.tokenSwap = new TokenSwap(
                process.env.TOKEN_ADDRESS,
                this.provider,
                this.currentWallet
            );
            
            await this.logOperation(`Rotated to wallet: ${this.currentWallet.address}`);
            await this.logOperation(`New balance: ${ethers.utils.formatEther(await this.currentWallet.getBalance())} ETH`);
            
            return true;
        } catch (error) {
            await this.logOperation(`Error during wallet rotation: ${error.message}`);
            return false;
        }
    }

    async clearPendingTransactions() {
        const pendingNonce = await this.provider.getTransactionCount(this.currentWallet.address, 'pending');
        const confirmedNonce = await this.provider.getTransactionCount(this.currentWallet.address, 'latest');
        
        if (pendingNonce > confirmedNonce) {
            console.log("Found stuck transactions, attempting to clear...");
            // Send 0 ETH transaction to self with higher gas price to clear stuck transactions
            const tx = {
                to: this.currentWallet.address,
                value: 0,
                nonce: confirmedNonce,
                maxFeePerGas: this.MAX_FEE_PER_GAS.mul(2), // Double the max fee
                maxPriorityFeePerGas: this.MAX_PRIORITY_FEE_PER_GAS.mul(2)
            };
            
            try {
                const transaction = await this.currentWallet.sendTransaction(tx);
                await transaction.wait(1);
                console.log("Successfully cleared stuck transactions");
            } catch (error) {
                console.error("Failed to clear stuck transactions:", error);
            }
        }
    }

    async executeTrade() {
        await this.clearPendingTransactions();
        
        try {
            await this.logOperation("=== Starting trade execution ===");
            await this.logOperation(`Current wallet: ${this.currentWallet.address}`);
            await this.logOperation(`ETH balance: ${ethers.utils.formatEther(await this.currentWallet.getBalance())} ETH`);
            
            const rawTokenBalance = await this.tokenSwap.getTokenBalance(this.currentWallet.address);
            await this.logOperation(`Token balance: ${ethers.utils.formatUnits(rawTokenBalance, 18)}`);
            
        
            if (this.swapCount >= this.MAX_SWAPS_PER_WALLET) {
                console.log(`Reached ${this.swapCount} swaps, rotating wallet...`);
                const rotationSuccess = await this.rotateWallet();
                if (rotationSuccess) {
                    this.MAX_SWAPS_PER_WALLET = 5 + Math.floor(Math.random() * 6);
                    this.swapCount = 0;
                }
                return; 
            }

            const MAX_RETRIES = 3;
            let retries = 0;

            while (retries < MAX_RETRIES) {
                try {
                    // Get token balance
                    const rawTokenBalance = await this.tokenSwap.getTokenBalance(this.currentWallet.address);
                    const tokenBalance = ethers.BigNumber.from(rawTokenBalance);
                    console.log(`Raw token balance: ${rawTokenBalance.toString()}`);
                    
                    // Calculate available tokens
                    const availableTokens = tokenBalance.sub(this.TOKEN_RESERVE);
                    
                    if (availableTokens.lte(0)) {
                        console.log("Insufficient token balance for sell, attempting to buy tokens...");
                        
                        // Get ETH balance
                        const ethBalance = await this.currentWallet.getBalance();
                        const availableEth = ethBalance.sub(this.GAS_RESERVE);
                        
                        if (availableEth.lte(0)) {
                            console.log("Insufficient ETH balance for buying tokens");
                            continue;
                        }

                        // Buy tokens with 50% of available ETH
                        const ethToBuy = availableEth.div(2);
                        console.log(`Attempting to buy tokens with ${ethers.utils.formatEther(ethToBuy)} ETH`);
                        
                        const buyResult = await this.tokenSwap.buyTokens(ethToBuy);
                        
                        if (!buyResult.success) {
                            throw new Error(buyResult.error || 'Failed to buy tokens');
                        }
                        
                        console.log(`Successfully bought tokens with ${buyResult.ethAmount} ETH`);
                        // Wait for transaction to be mined
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        continue; 
                    }

                    // Rest of the selling logic
                    const percentage = Math.floor(Math.random() * 20) + 10;
                    const tokensToSell = availableTokens.mul(percentage).div(100);
                    
                    console.log(`Current token balance: ${ethers.utils.formatUnits(tokenBalance, 18)}`);
                    console.log(`Attempting to sell ${percentage}% = ${ethers.utils.formatUnits(tokensToSell, 18)} tokens`);
                    
                    const result = await this.tokenSwap.sellTokens(tokensToSell);

                    if (!result.success) {
                        throw new Error(result.error || 'Unknown trade error');
                    }

                    console.log(`Trade successful:`, result);
                    this.swapCount++;
                    console.log(`Swap count: ${this.swapCount}/${this.MAX_SWAPS_PER_WALLET}`);
                    
                    
                    if (this.swapCount >= this.MAX_SWAPS_PER_WALLET) {
                        console.log("Preparing for wallet rotation...");
                      
                        const finalTokenBalance = await this.tokenSwap.getTokenBalance(this.currentWallet.address);
                        const tokensToSell = finalTokenBalance.sub(this.TOKEN_RESERVE);
                        
                        if (tokensToSell.gt(0)) {
                            console.log(`Selling remaining tokens before rotation: ${ethers.utils.formatUnits(tokensToSell, 18)}`);
                            await this.tokenSwap.sellTokens(tokensToSell);
                            
                            await new Promise(resolve => setTimeout(resolve, 30000));
                        }
                    }
                    
                    // Wait between trades
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    break; 

                } catch (error) {
                    console.log(`Error details: ${error}`);
                    retries++;
                    if (retries < MAX_RETRIES) {
                        console.log(`Retry ${retries}/${MAX_RETRIES} after error: ${error.message}`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                }
            }

            if (result.success) {
                await this.logOperation(`Trade successful: ${JSON.stringify(result)}`);
                await this.logOperation(`New ETH balance: ${ethers.utils.formatEther(await this.currentWallet.getBalance())} ETH`);
                await this.logOperation(`New token balance: ${ethers.utils.formatUnits(await this.tokenSwap.getTokenBalance(this.currentWallet.address), 18)}`);
            }
            
        } catch (error) {
            await this.logOperation(`Trade execution error: ${error.message}`);
            throw error;
        }
    }

    async start() {
        await this.logOperation("=== Starting trading bot ===");
        try {
            await this.initializeWallet();
            await this.logOperation(`Initial wallet: ${this.currentWallet.address}`);
            await this.logOperation(`Initial ETH balance: ${ethers.utils.formatEther(await this.currentWallet.getBalance())} ETH`);
            await this.logOperation(`Initial token balance: ${ethers.utils.formatUnits(await this.tokenSwap.getTokenBalance(this.currentWallet.address), 18)}`);
            
            const intervalMs = (process.env.TRADE_INTERVAL_MINUTES || 1) * 60 * 1000;
            console.log(`Trade interval set to ${process.env.TRADE_INTERVAL_MINUTES || 1} minutes`);
            
            
            while (true) {
                try {
                    await this.executeTrade();
                    
                    if (this.swapCount >= this.MAX_SWAPS_PER_WALLET) {
                        console.log("Maximum swaps reached, rotating wallet...");
                        const rotationSuccess = await this.rotateWallet();
                        
                        if (rotationSuccess) {
                            this.swapCount = 0;
                            this.MAX_SWAPS_PER_WALLET = 5 + Math.floor(Math.random() * 6);
                            console.log(`Rotated to new wallet: ${this.currentWallet.address}`);
                            console.log(`New target: ${this.MAX_SWAPS_PER_WALLET} swaps`);
                        } else {
                            console.log("Wallet rotation failed, will retry in next iteration");
                        }
                    }

                   
                    console.log(`Waiting ${process.env.TRADE_INTERVAL_MINUTES} minutes before next trade...`);
                    await new Promise(resolve => setTimeout(resolve, intervalMs));
                    
                } catch (error) {
                    console.error("Error in main trading loop:", error);
                 
                    await new Promise(resolve => setTimeout(resolve, 60000));
                }
            }
        } catch (error) {
            await this.logOperation(`Critical error: ${error.message}`);
            throw error;
        }
    }

    async cancelAllPendingTransactions() {
        try {
            const pendingNonce = await this.provider.getTransactionCount(this.currentWallet.address, 'pending');
            const confirmedNonce = await this.provider.getTransactionCount(this.currentWallet.address, 'latest');

            if (pendingNonce <= confirmedNonce) {
                console.log("No pending transactions found");
                return;
            }

            console.log(`Found ${pendingNonce - confirmedNonce} pending transactions`);

            // Get current gas prices
            const feeData = await this.provider.getFeeData();
            
            // Create cancellation transaction with higher gas price
            const cancelTx = {
                to: this.currentWallet.address,
                value: 0,
                nonce: confirmedNonce,
                maxFeePerGas: feeData.maxFeePerGas.mul(2), // Double the current gas price
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(2),
                gasLimit: 21000, // Standard gas limit for ETH transfer
                type: 2 // EIP-1559
            };

            console.log("Sending cancellation transaction...");
            const tx = await this.currentWallet.sendTransaction(cancelTx);
            
            console.log(`Cancellation transaction sent: ${tx.hash}`);
            const receipt = await tx.wait(1);
            
            console.log(`Cancellation confirmed in block ${receipt.blockNumber}`);
            
            // Verify if cancellation was successful
            const newPendingNonce = await this.provider.getTransactionCount(this.currentWallet.address, 'pending');
            const newConfirmedNonce = await this.provider.getTransactionCount(this.currentWallet.address, 'latest');
            
            if (newPendingNonce === newConfirmedNonce) {
                console.log("Successfully cancelled all pending transactions");
            } else {
                console.log(`${newPendingNonce - newConfirmedNonce} transactions still pending`);
            }

            return receipt;
        } catch (error) {
            console.error("Failed to cancel pending transactions:", error);
            throw error;
        }
    }
}


const bot = new TradingBot();
bot.start().catch(async (error) => {
    console.error("Fatal error in trading bot:", error);
 
    await new Promise(resolve => setTimeout(resolve, 60000));
    bot.start();
});