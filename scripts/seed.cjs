const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🌱 Seeding AttendanceSystem with multi-subject sessions for TechQuest...");

  const signers = await ethers.getSigners();
  const admin = signers[0];
  const teacher1 = signers[1];
  const teacher2 = signers[2];
  const student1 = signers[3];
  const student2 = signers[4];
  const student3 = signers[5];
  const student4 = signers[6];
  const student5 = signers[7];

  const configPath = path.join(__dirname, "../src/utils/contractConfig.js");
  let contractAddress;
  if (fs.existsSync(configPath)) {
    const fileContent = fs.readFileSync(configPath, "utf8");
    const match = fileContent.match(/CONTRACT_ADDRESS = "(0x[a-fA-F0-9]{40})"/);
    if (match) contractAddress = match[1];
  }

  let contract;
  if (contractAddress) {
    const AttendanceSystem = await ethers.getContractFactory("AttendanceSystem");
    contract = AttendanceSystem.attach(contractAddress);
  } else {
    const AttendanceSystem = await ethers.getContractFactory("AttendanceSystem");
    contract = await AttendanceSystem.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
  }

  await (await contract.registerTeacher(teacher1.address, "Dr. Sarah Jenkins", "Computer Science")).wait();
  await (await contract.registerTeacher(teacher2.address, "Prof. Robert Chen", "Artificial Intelligence")).wait();

  const studentsList = [
    { signer: student1, id: "TQ2026-CS01", name: "Alex Vance", dept: "Computer Science" },
    { signer: student2, id: "TQ2026-CS02", name: "Elena Rostova", dept: "Computer Science" },
    { signer: student3, id: "TQ2026-AI01", name: "Devin Miller", dept: "Artificial Intelligence" },
    { signer: student4, id: "TQ2026-AI02", name: "Sophia Zhang", dept: "Artificial Intelligence" },
    { signer: student5, id: "TQ2026-CS03", name: "Marcus Thorne", dept: "Computer Science" },
  ];

  for (const st of studentsList) {
    await (await contract.registerStudent(st.signer.address, st.id, st.name, st.dept)).wait();
  }

  await (await contract.createSubject("Smart Contract Engineering", "CS-401", teacher1.address)).wait();
  await (await contract.createSubject("Deep Neural Networks", "AI-302", teacher2.address)).wait();
  await (await contract.createSubject("Cryptographic Protocols", "CS-405", teacher1.address)).wait();

  let currentSessId = 1;

  const cs401Matrix = [
    [student1, student2, student3, student4, student5],
    [student1, student2, student3, student4],
    [student1, student2, student3, student4],
    [student1, student2, student3, student4],
    [student1, student2, student3],
    [student1, student2, student3],
    [student1, student2],
    [student1, student2],
    [student1, student5],
  ];

  for (const presentArr of cs401Matrix) {
    const secretBytes = ethers.randomBytes(32);
    const secretHash = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [currentSessId, secretBytes]);
    await (await contract.connect(teacher1).startSession(1, secretHash, 60)).wait();

    for (const st of presentArr) {
      await (await contract.connect(st).markAttendance(currentSessId, secretBytes)).wait();
    }
    currentSessId++;
  }

  const ai302Matrix = [
    [student1, student2, student3, student4, student5],
    [student1, student2, student3, student4, student5],
    [student1, student2, student3, student4, student5],
    [student1, student2, student3, student4],
    [student1, student3, student4],
    [student1, student3, student4],
    [student1, student3, student4],
    [student3, student4],
    [student3, student4],
  ];

  for (const presentArr of ai302Matrix) {
    const secretBytes = ethers.randomBytes(32);
    const secretHash = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [currentSessId, secretBytes]);
    await (await contract.connect(teacher2).startSession(2, secretHash, 60)).wait();

    for (const st of presentArr) {
      await (await contract.connect(st).markAttendance(currentSessId, secretBytes)).wait();
    }
    currentSessId++;
  }

  const cs405Matrix = [
    [student1, student2, student3, student4, student5],
    [student1, student2, student3, student4],
    [student1, student2, student3, student4],
    [student1, student2, student3, student4],
    [student1, student2, student3, student4],
    [student1, student2, student3],
    [student1, student2, student3],
    [student1, student2, student3],
    [student1, student2],
  ];

  for (const presentArr of cs405Matrix) {
    const secretBytes = ethers.randomBytes(32);
    const secretHash = ethers.solidityPackedKeccak256(["uint256", "bytes32"], [currentSessId, secretBytes]);
    await (await contract.connect(teacher1).startSession(3, secretHash, 60)).wait();

    for (const st of presentArr) {
      await (await contract.connect(st).markAttendance(currentSessId, secretBytes)).wait();
    }
    currentSessId++;
  }

  const crypto = require('crypto');
  const demoOtpArr = new Uint32Array(1);
  crypto.getRandomValues(demoOtpArr);
  const activeDemoCode = String(100000 + (demoOtpArr[0] % 900000));
  const activeHash = ethers.solidityPackedKeccak256(["uint256", "string"], [currentSessId, activeDemoCode]);
  await (await contract.connect(teacher1).startSessionWithDemoCode(1, activeHash, 120, activeDemoCode)).wait();
  console.log(`🎉 LIVE DEMO SESSION ACTIVE! Session ID: ${currentSessId}, Demo OTP: ${activeDemoCode}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
