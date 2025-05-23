async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with the account:', deployer.address);

  const Token = await ethers.getContractFactory("AgentBattleToken");
  const token = await Token.deploy(1000000); // 1,000,000 tokens
  await token.deployed();

  console.log("Token deployed to:", token.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 