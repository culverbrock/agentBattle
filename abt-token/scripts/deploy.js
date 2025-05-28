async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with the account:', deployer.address);

  const abtToken = process.env.ABT_TOKEN_ADDRESS;
  if (!abtToken) throw new Error('Set ABT_TOKEN_ADDRESS in env');
  const PrizePoolV2 = await ethers.getContractFactory("ABTPrizePoolV2");
  const prizePoolV2 = await PrizePoolV2.deploy(abtToken);
  await prizePoolV2.deployed();

  console.log("ABTPrizePoolV2 deployed to:", prizePoolV2.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 