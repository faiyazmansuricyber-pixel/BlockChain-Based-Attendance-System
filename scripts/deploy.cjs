const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying AttendanceSystem smart contract...");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer Address:", deployer.address);

  const AttendanceSystem = await ethers.getContractFactory("AttendanceSystem");
  const attendanceSystem = await AttendanceSystem.deploy();
  await attendanceSystem.waitForDeployment();

  const contractAddress = await attendanceSystem.getAddress();
  console.log("✅ AttendanceSystem deployed to:", contractAddress);

  // Read Artifact ABI
  const artifactPath = path.join(__dirname, "../src/artifacts/contracts/AttendanceSystem.sol/AttendanceSystem.json");
  let abi = [];
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    abi = artifact.abi;
  }

  // Create contractConfig.js for frontend
  const configContent = `// Auto-generated contract configuration
export const CONTRACT_ADDRESS = "${contractAddress}";

export const CONTRACT_ABI = ${JSON.stringify(abi, null, 2)};
`;

  const configPath = path.join(__dirname, "../src/utils/contractConfig.js");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, configContent);

  console.log("📝 Saved contract address and ABI to src/utils/contractConfig.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
