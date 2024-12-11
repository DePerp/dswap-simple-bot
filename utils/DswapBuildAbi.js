const DswapBuildAbi = [
    {
      inputs: [
        { name: "_stake", type: "address" },
        { name: "_name", type: "string" },
        { name: "_symbol", type: "string" },
        { name: "_initialSupply", type: "uint256" },
        { name: "_devSupplyPercent", type: "uint256" },
        { name: "_basisValue", type: "uint256" },
        { name: "_tokenIconIPFS", type: "string" }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      inputs: [{ name: "minTokenAmount", type: "uint256" }],
      name: "buyTokens",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        { name: "tokenAmount", type: "uint256" },
        { name: "minEthAmount", type: "uint256" }
      ],
      name: "sellTokens",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "getCurrentPrice",
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "getReserves",
      outputs: [
        { name: "currentEthReserve", type: "uint256" },
        { name: "currentTokenReserve", type: "uint256" }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "getTokenReserve",
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "getEthReserve",
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "getAccumulatedFeesInToken",
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "getAccumulatedFeesInETH",
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [{ name: "ethAmount", type: "uint256" }],
      name: "getEstimatedTokensForETH",
      outputs: [{ name: "tokenAmount", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [{ name: "tokenAmount", type: "uint256" }],
      name: "getEstimatedETHForTokens",
      outputs: [{ name: "ethAmount", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "claimFees",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: "buyer", type: "address" },
        { indexed: false, name: "ethAmount", type: "uint256" },
        { indexed: false, name: "tokenAmount", type: "uint256" }
      ],
      name: "TokensPurchased",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: "seller", type: "address" },
        { indexed: false, name: "tokenAmount", type: "uint256" },
        { indexed: false, name: "ethAmount", type: "uint256" }
      ],
      name: "TokensSold",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        { indexed: false, name: "newEthReserve", type: "uint256" },
        { indexed: false, name: "newTokenReserve", type: "uint256" }
      ],
      name: "ReservesUpdated",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: "recipient", type: "address" },
        { indexed: false, name: "tokenAmount", type: "uint256" },
        { indexed: false, name: "ethAmount", type: "uint256" }
      ],
      name: "FeesWithdrawn",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        { indexed: false, name: "tokenFeeAmount", type: "uint256" },
        { indexed: false, name: "ethFeeAmount", type: "uint256" }
      ],
      name: "FeeAccumulated",
      type: "event"
    }
  ];
  
  module.exports = DswapBuildAbi;