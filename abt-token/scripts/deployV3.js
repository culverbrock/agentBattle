const { ethers } = require("hardhat");

async function main() {
  const abtToken = process.env.ABT_TOKEN_ADDRESS;
  if (!abtToken) throw new Error('Set ABT_TOKEN_ADDRESS in env');
  const PrizePoolV3 = await ethers.getContractFactory("ABTPrizePoolV3");
  const prizePoolV3 = await PrizePoolV3.deploy(abtToken);
  await prizePoolV3.deployed();
  console.log("ABTPrizePoolV3 deployed to:", prizePoolV3.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 