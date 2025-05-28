const { ethers } = require("hardhat");

async function main() {
  const abtTokenAddress = process.env.ABT_TOKEN_ADDRESS;
  const prizePoolV3Address = process.env.ABT_PRIZE_POOL_V3; // new V3 contract
  const winner1 = "0xf64a18162C830312c6ba5e3d9834799B42199A9b";
  const winner2 = "0xf161cAA3230dDB5f028224d295962c4552Dd2430";

  // Test games
  const games = [
    {
      gameId: '11111111-1111-1111-1111-111111111111',
      amounts: [ethers.utils.parseUnits("140", 18), ethers.utils.parseUnits("60", 18)],
      winners: [winner1, winner2],
      total: ethers.utils.parseUnits("200", 18)
    },
    {
      gameId: '22222222-2222-2222-2222-222222222222',
      amounts: [ethers.utils.parseUnits("100", 18), ethers.utils.parseUnits("50", 18)],
      winners: [winner1, winner2],
      total: ethers.utils.parseUnits("150", 18)
    }
  ];

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const abt = await ethers.getContractAt("AgentBattleToken", abtTokenAddress);
  const pool = await ethers.getContractAt("ABTPrizePoolV3", prizePoolV3Address);

  for (const g of games) {
    // Fund the contract for this game
    const bal = await abt.balanceOf(deployer.address);
    console.log(`Deployer ABT balance: ${ethers.utils.formatUnits(bal, 18)}`);
    if (bal.lt(g.total)) throw new Error(`Not enough ABT to fund prize pool for game ${g.gameId}`);
    const tx1 = await abt.transfer(prizePoolV3Address, g.total);
    await tx1.wait();
    console.log(`Transferred ${ethers.utils.formatUnits(g.total, 18)} ABT to prize pool for game ${g.gameId}:`, tx1.hash);
    // Set winners for this game
    const gameIdBytes32 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(g.gameId));
    const tx2 = await pool.setWinners(gameIdBytes32, g.winners, g.amounts);
    await tx2.wait();
    console.log(`Called setWinners for game ${g.gameId} (${gameIdBytes32}):`, tx2.hash);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 