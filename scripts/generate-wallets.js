const { ethers } = require("ethers");
const WalletManager = require("../utils/wallet-manager");
require('dotenv').config();

async function generateWallets(count = 5) {
    // Generate new mnemonic if not provided
    const mnemonic = process.env.MNEMONIC_PHRASE || ethers.Wallet.createRandom().mnemonic.phrase;
    
    console.log("Mnemonic phrase:", mnemonic);
    console.log("\nGenerated wallets:");
    
    // Initialize WalletManager
    const walletManager = new WalletManager(mnemonic);
    
    for (let i = 0; i < count; i++) {
        const path = walletManager.generateWallet();
        const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic).derivePath(path);
        const wallet = new ethers.Wallet(hdNode.privateKey);
        
        // Create wallet info object
        const walletInfo = {
            address: wallet.address,
            path: path,
            privateKey: wallet.privateKey,
            accountIndex: Math.floor(i / 20), // Calculate account index
            walletIndex: i % 20 // Calculate wallet index
        };
        
        // Log wallet info
        walletManager.logWalletInfo(walletInfo);
    }
}

// Generate 5 wallets by default
generateWallets().catch(console.error); 