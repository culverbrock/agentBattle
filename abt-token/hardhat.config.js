require("dotenv").config();
require("@nomiclabs/hardhat-ethers");

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/UabqS2_hIwk2H0b6cdVsPeAHY5JWQneI",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
}; 