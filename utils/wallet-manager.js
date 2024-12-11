const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class WalletManager {
    constructor(mnemonic) {
        if (!ethers.utils.isValidMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }
        this.mnemonic = mnemonic;
        this.currentAccountIndex = 0;
        this.currentWalletIndex = 0;
        this.wallets = new Map();
        this.logFile = path.resolve(__dirname, '../logs/wallets.log');
        this.ensureLogDirectory();
        console.log("Log file path:", this.logFile);
        this.walletStats = {
            totalWallets: 0,
            walletsWithBalance: 0,
            totalBalance: 0,
            balanceDistribution: []
        };
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    logWalletInfo(walletInfo) {
        try {
            this.ensureLogDirectory();
            
            const logEntry = `
=== Wallet ${walletInfo.accountIndex}:${walletInfo.walletIndex} ===
Generated: ${new Date().toISOString()}
Address: ${walletInfo.address}
Path: ${walletInfo.path}
Private Key: ${walletInfo.privateKey}
Balance: ${walletInfo.balance || '0'} ETH
----------------------------------------\n`;
            
            if (!fs.existsSync(this.logFile)) {
                fs.writeFileSync(this.logFile, "=== Wallet Manager Log ===\n\n");
            }
            
            fs.appendFileSync(this.logFile, logEntry, { flag: 'a' });
            
            console.log(`Generated wallet ${walletInfo.accountIndex}:${walletInfo.walletIndex}`);
            console.log(`Address: ${walletInfo.address}`);
            console.log(`Path: ${walletInfo.path}`);
            console.log('----------------------------------------');
            
        } catch (error) {
            console.error("Failed to log wallet info:", error);
            console.error("Error details:", error.message);
            console.error("Log file path:", this.logFile);
            throw error;
        }
    }

    generateWallet() {
        try {
            // Check if we need to move to next account
            if (this.currentWalletIndex >= 20) {
                this.currentAccountIndex++;
                this.currentWalletIndex = 0;
            }
            
            const path = `m/44'/60'/${this.currentAccountIndex}'/0/${this.currentWalletIndex}`;
            this.currentWalletIndex++;
            return path;
        } catch (error) {
            console.error("Failed to generate wallet:", error);
            throw error;
        }
    }

    async scanWalletTree(provider, maxAccounts = 5, maxWalletsPerAccount = 20) {
        this.walletStats = {
            totalWallets: 0,
            walletsWithBalance: 0,
            totalBalance: 0,
            balanceDistribution: []
        };

        const activeWallets = [];
        
        for (let accountIndex = 0; accountIndex < maxAccounts; accountIndex++) {
            for (let walletIndex = 0; walletIndex < maxWalletsPerAccount; walletIndex++) {
                const path = `m/44'/60'/${accountIndex}'/0/${walletIndex}`;
                const hdNode = ethers.utils.HDNode.fromMnemonic(this.mnemonic).derivePath(path);
                const wallet = new ethers.Wallet(hdNode.privateKey, provider);
                
                // Check balance
                const balance = await provider.getBalance(wallet.address);
                
                // If wallet has any balance, add it to active wallets
                if (!balance.isZero()) {
                    const walletInfo = {
                        address: wallet.address,
                        path: path,
                        privateKey: hdNode.privateKey,
                        balance: ethers.utils.formatEther(balance),
                        accountIndex: accountIndex,
                        walletIndex: walletIndex
                    };
                    
                    activeWallets.push(walletInfo);
                    this.logWalletInfo(walletInfo);
                    this.walletStats.totalWallets++;
                    if (balance > 0) {
                        this.walletStats.walletsWithBalance++;
                        this.walletStats.totalBalance += parseFloat(ethers.utils.formatEther(balance));
                        this.walletStats.balanceDistribution.push({
                            address: wallet.address,
                            balance: ethers.utils.formatEther(balance),
                            path: path
                        });
                    }
                }
            }
        }
        
        return activeWallets;
    }

    async getWalletStats() {
        return this.walletStats;
    }

    async consolidateBalances(provider, destinationAddress, gasSettings) {
        const results = [];
        
        // Get all wallets with balance from the distribution
        const walletsToConsolidate = this.walletStats.balanceDistribution
            .filter(walletInfo => walletInfo.address.toLowerCase() !== destinationAddress.toLowerCase());

        for (const walletInfo of walletsToConsolidate) {
            try {
                // Create wallet instance from mnemonic and path
                const hdNode = ethers.utils.HDNode.fromMnemonic(this.mnemonic).derivePath(walletInfo.path);
                const sourceWallet = new ethers.Wallet(hdNode.privateKey, provider);
                
                // Get current balance
                const balance = await provider.getBalance(walletInfo.address);
                
                // Calculate max amount to send (balance - gas cost)
                const gasCost = gasSettings.maxFeePerGas.mul(gasSettings.gasLimit);
                const amountToSend = balance.sub(gasCost);
                
                if (amountToSend.lte(0)) {
                    results.push({
                        from: walletInfo.address,
                        amount: '0',
                        success: false,
                        error: 'Insufficient balance to cover gas costs'
                    });
                    continue;
                }

                // Create and send transaction
                const tx = await sourceWallet.sendTransaction({
                    to: destinationAddress,
                    value: amountToSend,
                    maxFeePerGas: gasSettings.maxFeePerGas,
                    maxPriorityFeePerGas: gasSettings.maxPriorityFeePerGas,
                    gasLimit: gasSettings.gasLimit
                });

                // Wait for transaction confirmation
                const receipt = await tx.wait();

                results.push({
                    from: walletInfo.address,
                    amount: ethers.utils.formatEther(amountToSend),
                    success: true,
                    txHash: receipt.transactionHash
                });

            } catch (error) {
                results.push({
                    from: walletInfo.address,
                    amount: walletInfo.balance,
                    success: false,
                    error
                });
            }
        }

        return results;
    }
}

module.exports = WalletManager;