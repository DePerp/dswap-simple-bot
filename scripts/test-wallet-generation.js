require('dotenv').config();
const WalletManager = require('../utils/wallet-manager');

async function testGeneration() {
    const walletManager = new WalletManager(process.env.MNEMONIC_PHRASE);
    
    console.log("Testing wallet generation and logging...");
    
   
    for (let i = 0; i < 5; i++) {
        const wallet = walletManager.generateWallet();
        console.log(`\nGenerated wallet #${i + 1}: ${wallet.address}`);
    }
}

testGeneration().catch(console.error); 