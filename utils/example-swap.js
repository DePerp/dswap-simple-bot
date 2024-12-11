const { ethers } = require("ethers");
const DswapBuildAbi = require("./DswapBuildAbi");

class TokenSwap {
    constructor(tokenAddress, provider, wallet) {
        this.tokenAddress = tokenAddress;
        this.provider = provider;
        this.wallet = wallet;
        
        this.erc20Abi = [
            "function balanceOf(address) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)",
            "function allowance(address owner, address spender) view returns (uint256)"
        ];

        // Initialize contracts with imported ABI
        this.tokenContract = new ethers.Contract(tokenAddress, [...this.erc20Abi, ...DswapBuildAbi], wallet);
    }

    // Helper function to format amounts for logging
    async _formatAmount(amount, decimals = 18) {
        return ethers.utils.formatUnits(amount, decimals);
    }

    // Get current token price in ETH
    async getTokenPrice() {
        const price = await this.tokenContract.getCurrentPrice();
        return this._formatAmount(price);
    }

    // Get token balance for an address
    async getTokenBalance(address) {
        const balance = await this.tokenContract.balanceOf(address);
        return balance;
    }

    // Buy tokens with ETH
    async buyTokens(ethAmount) {
        try {
            if (!ethAmount || !ethers.BigNumber.isBigNumber(ethAmount) || ethAmount.lte(0)) {
                throw new Error("Invalid ETH amount");
            }
            
            // Get current network conditions
            const feeData = await this.provider.getFeeData();
            
            // Get estimated tokens with slippage protection
            const estimatedTokens = await this.tokenContract.getEstimatedTokensForETH(ethAmount);
            const minTokens = estimatedTokens.mul(95).div(100); // 5% slippage

            // Get gas estimate first
            const gasEstimate = await this.tokenContract.estimateGas.buyTokens(
                minTokens,
                { value: ethAmount }
            );
            const gasLimit = gasEstimate.mul(120).div(100); // Add 20% buffer

            // Execute buy transaction
            const tx = await this.tokenContract.buyTokens(
                minTokens,
                { 
                    value: ethAmount,
                    gasLimit,
                    maxFeePerGas: feeData.maxFeePerGas,
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                    type: 2
                }
            );

            const receipt = await tx.wait(2);
            
            return {
                success: true,
                hash: receipt.transactionHash,
                ethAmount: ethers.utils.formatEther(ethAmount),
                estimatedTokens: ethers.utils.formatUnits(estimatedTokens, 18)
            };
        } catch (error) {
            console.log("Buy error details:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Sell tokens for ETH
    async sellTokens(tokenAmountWei) {
        try {
            if (!tokenAmountWei || !ethers.BigNumber.isBigNumber(tokenAmountWei) || tokenAmountWei.lte(0)) {
                throw new Error("Invalid token amount");
            }

            // Get current reserves
            const [ethReserve, tokenReserve] = await this.tokenContract.getReserves();
            console.log("Reserves before sell - ETH:", ethers.utils.formatEther(ethReserve), "Token:", ethers.utils.formatUnits(tokenReserve, 18));
            
            
            const maxSellAmount = tokenReserve.mul(30).div(100);
            if (tokenAmountWei.gt(maxSellAmount)) {
                throw new Error(`Cannot sell more than 30% of reserve (${ethers.utils.formatUnits(maxSellAmount, 18)} tokens)`);
            }

            // Check allowance
            const allowance = await this.tokenContract.allowance(
                this.wallet.address,
                this.tokenContract.address
            );
            
            if (allowance.lt(tokenAmountWei)) {
                console.log("Approving tokens...");
                const approveTx = await this.tokenContract.approve(
                    this.tokenContract.address,
                    ethers.constants.MaxUint256
                );
                await approveTx.wait(1);
                console.log("Tokens approved");
            }

            // Calculate minimum ETH amount with 5% slippage
            const expectedEthAmount = tokenAmountWei.mul(ethReserve).div(tokenReserve);
            const minEthAmount = expectedEthAmount.mul(95).div(100);

            console.log(`Attempting to sell ${ethers.utils.formatUnits(tokenAmountWei, 18)} tokens`);
            console.log(`Minimum ETH expected: ${ethers.utils.formatEther(minEthAmount)}`);

            const tx = await this.tokenContract.sellTokens(
                tokenAmountWei,
                minEthAmount,
                {
                    gasLimit: 500000, 
                    maxFeePerGas: ethers.utils.parseUnits("0.1", "gwei"),
                    maxPriorityFeePerGas: ethers.utils.parseUnits("0.1", "gwei"),
                    type: 2
                }
            );

            const receipt = await tx.wait(2);
            
            return {
                success: true,
                hash: receipt.transactionHash,
                tokenAmount: ethers.utils.formatUnits(tokenAmountWei, 18),
                ethAmount: ethers.utils.formatEther(minEthAmount),
                recipient: this.wallet.address
            };
        } catch (error) {
            console.log("Sell error details:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get price impact for a trade
    async getPriceImpact(ethAmount) {
        const ethAmountWei = ethers.utils.parseEther(ethAmount.toString());
        const currentPrice = await this.tokenContract.getCurrentPrice();
        const estimatedTokens = await this.tokenContract.getEstimatedTokensForETH(ethAmountWei);
        
        const expectedPrice = ethAmountWei.mul(ethers.constants.WeiPerEther).div(estimatedTokens);
        const priceImpact = currentPrice.sub(expectedPrice).mul(100).div(currentPrice);
        
        return this._formatAmount(priceImpact);
    }
}

module.exports = TokenSwap;
