
require('dotenv').config();
const TradingBot = require('../bot/trading-bot');

async function cancelPendingTransactions() {
    const bot = new TradingBot();
    await bot.initializeWallet();
    
    try {
        await bot.cancelAllPendingTransactions();
        console.log("Cancellation process completed");
    } catch (error) {
        console.error("Cancellation failed:", error);
    }
}

cancelPendingTransactions().catch(console.error);