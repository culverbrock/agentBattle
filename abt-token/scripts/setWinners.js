const { ethers } = require("hardhat");

async function main() {
  const abtTokenAddress = process.env.ABT_TOKEN_ADDRESS;
  const prizePoolV2Address = process.env.ABT_PRIZE_POOL_V2;
  const winner1 = "0xf64a18162C830312c6ba5e3d9834799B42199A9b";
  const winner2 = "0xf161cAA3230dDB5f028224d295962c4552Dd2430";
  const amount1 = ethers.utils.parseUnits("140", 18);
  const amount2 = ethers.utils.parseUnits("60", 18);
  const total = amount1.add(amount2);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. Fund the prize pool contract with 200 ABT
  const abt = await ethers.getContractAt("AgentBattleToken", abtTokenAddress);
  const bal = await abt.balanceOf(deployer.address);
  console.log("Deployer ABT balance:", ethers.utils.formatUnits(bal, 18));
  if (bal.lt(total)) throw new Error("Not enough ABT to fund prize pool");
  const tx1 = await abt.transfer(prizePoolV2Address, total);
  await tx1.wait();
  console.log("Transferred 200 ABT to prize pool:", tx1.hash);

  // 2. Call setWinners
  const pool = await ethers.getContractAt("ABTPrizePoolV2", prizePoolV2Address);
  const tx2 = await pool.setWinners([winner1, winner2], [amount1, amount2]);
  await tx2.wait();
  console.log("Called setWinners:", tx2.hash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 