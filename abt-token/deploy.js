const hre = require("hardhat");

async function main() {
  const abtToken = process.env.ABT_TOKEN_ADDRESS;
  if (!abtToken) throw new Error('Set ABT_TOKEN_ADDRESS in env');
  const PrizePool = await hre.ethers.getContractFactory("ABTPrizePool");
  const prizePool = await PrizePool.deploy(abtToken);
  await prizePool.deployed();
  console.log("PrizePool deployed to:", prizePool.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 