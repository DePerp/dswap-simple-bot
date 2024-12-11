# Trading Bot Documentation

## Description
Example Automated trading bot for Dswap Standard token random buy/sell multiple wallets. The bot supports automatic wallet rotation, balance management, and trade execution. 
Provided as is as part of the training.

**install**
```
yarn install
```
**start bot**
```
yarn start:bot
```

## Key Features

### Wallet Management
- Automatic scanning and creation of new wallets
- Wallet rotation after a set number of swaps
- Maintaining minimum ETH balance for gas
- Managing multiple wallets from a single mnemonic phrase

### Trading Operations
- Automatic token buying and selling
- Slippage protection
- Random number of swaps per wallet (5-10)
- Gas limit control for Base Network
- Handling stuck transactions

### Security
- ETH gas reserve (0.0001 ETH)
- Token reserve (1 token)
- Automatic clearing of stuck transactions
```
node scripts/scan-and-consolidate.js
```
- Critical error protection

## Configuration

### Required Environment Variables
```
WALLET_PRIVATE_KEY=
RPC_URL=
TOKEN_ADDRESS=
TRADE_AMOUNT_ETH=0.01
TRADE_INTERVAL_MINUTES=5
SWAPS_BEFORE_ROTATION=10
MNEMONIC_PHRASE=
GAS_RESERVE=0.05
UNISWAP_ROUTER_ADDRESS=
WETH_ADDRESS=
ACCOUNTS_LIST_PATH=path/to/your/accounts.json
```


## Core Methods

### Initialization
- constructor() - Bot initialization
- initializeWallet() - Wallet preparation
- scanForActiveWallets() - Active wallet scanning

### Trading Operations
- executeTrade() - Trade execution
- handleExistingTokens() - Existing token handling
- clearPendingTransactions() - Clearing stuck transactions

### Wallet Management
- rotateWallet() - Wallet rotation
- getBestWallet() - Getting wallet with maximum balance
- createNewWallets() - Creating new wallets

## Logging
- All operations logged to logs/trading.log
- Console output of important operations
- Detailed error and transaction logging

## Error Handling
- Automatic retry on errors
- Maximum 3 attempts per operation
- Waiting between attempts
- Automatic restart on critical errors

## Usage Recommendations
1. Ensure sufficient main wallet balance
2. Configure correct gas limits for network
3. Regularly check operation logs
4. Monitor wallet balances

## Security
- Store mnemonic phrase securely
- Use reliable RPC connection
- Regularly check transaction status
- Don't keep large amounts in trading wallets

## License and Distribution Terms

### Usage Restrictions
This software is provided for educational and training purposes only. By using this software you agree to:

1. Use it solely for educational, testing and development purposes
2. Not use it for any illegal activities or market manipulation
3. Not use it in production environments without proper review and modifications
4. Accept all risks associated with its use

### Disclaimer
- This software is provided "AS IS" without warranty of any kind
- The authors are not responsible for any financial losses or damages
- This is not financial advice or investment recommendation
- Past performance does not guarantee future results

### Distribution
- You may freely share and modify the code while maintaining these terms
- Commercial use requires explicit written permission
- All modifications must include this disclaimer
- Attribution to original authors is required

### Liability
The authors and contributors:
- Make no guarantees about the software's performance
- Are not liable for any damages or losses
- Do not provide technical support
- Reserve the right to modify these terms

By using this software, you acknowledge and accept these terms and conditions.