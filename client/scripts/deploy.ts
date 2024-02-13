import { ethers } from "hardhat";

async function main() {
  const MintNFT = await ethers.deployContract(
    "MintNFT",
    ["Collection NFT", "CN"],
    {}
  );
  await MintNFT.waitForDeployment();

  console.log(`MintNFT deployed to ${MintNFT.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
