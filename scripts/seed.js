import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { ethers } = hre;

/**
 * Helper — derives the deterministic "demo OTP" ephemeral address from (sessionId, code).
 * Must mirror the contract's markAttendanceWithCode logic:
 *   address(uint160(uint256(keccak256(abi.encodePacked(sessionId, demoCode)))))
 */
function demoOtpAddress(sessionId, demoCode) {
  const hash = ethers.solidityPackedKeccak256(["uint256", "string"], [sessionId, demoCode]);
  return ethers.getAddress("0x" + hash.slice(-40));
}

async function main() {
  console.log("🌱 Seeding AttendanceSystem with rotating-QR sessions...");

  const signers = await ethers.getSigners();
  const admin    = signers[0];
  const teacher1 = signers[1]; // Dr. Sarah Jenkins
  const teacher2 = signers[2]; // Prof. Robert Chen
  const student1 = signers[3]; // Alex Vance
  const student2 = signers[4]; // Elena Rostova
  const student3 = signers[5]; // Devin Miller
  const student4 = signers[6]; // Sophia Zhang
  const student5 = signers[7]; // Marcus Thorne

  // Load deployed contract address
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
    console.log("🔗 Attached to existing contract at:", contractAddress);
  } else {
    console.log("⚠️  No contractConfig.js found. Deploying new contract...");
    const AttendanceSystem = await ethers.getContractFactory("AttendanceSystem");
    contract = await AttendanceSystem.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
  }

  // ── Register Users ──────────────────────────────────────────────────────────
  console.log("\n1️⃣  Registering Teachers...");
  await (await contract.registerTeacher(teacher1.address, "Dr. Sarah Jenkins", "Computer Science")).wait();
  await (await contract.registerTeacher(teacher2.address, "Prof. Robert Chen", "Artificial Intelligence")).wait();
  console.log("   ✓ 2 teachers registered");

  console.log("\n2️⃣  Registering Students...");
  const studentsList = [
    { signer: student1, id: "TQ2026-CS01", name: "Alex Vance",     dept: "Computer Science" },
    { signer: student2, id: "TQ2026-CS02", name: "Elena Rostova",  dept: "Computer Science" },
    { signer: student3, id: "TQ2026-AI01", name: "Devin Miller",   dept: "Artificial Intelligence" },
    { signer: student4, id: "TQ2026-AI02", name: "Sophia Zhang",   dept: "Artificial Intelligence" },
    { signer: student5, id: "TQ2026-CS03", name: "Marcus Thorne",  dept: "Computer Science" },
  ];
  for (const st of studentsList) {
    await (await contract.registerStudent(st.signer.address, st.id, st.name, st.dept)).wait();
    console.log(`   ✓ ${st.name} (${st.id})`);
  }

  console.log("\n3️⃣  Creating Subjects...");
  await (await contract.createSubject("Smart Contract Engineering", "CS-401", teacher1.address)).wait();
  await (await contract.createSubject("Deep Neural Networks",       "AI-302", teacher2.address)).wait();
  await (await contract.createSubject("Cryptographic Protocols",    "CS-405", teacher1.address)).wait();
  console.log("   ✓ CS-401 | AI-302 | CS-405");

  // ── Past Sessions (ecrecover / rotating-QR flow) ────────────────────────────
  // Each past session: generate an ephemeral wallet, call startSession with its address,
  // have each "present" student sign (sessionId, windowIndex=0) and call markAttendance.
  console.log("\n4️⃣  Creating Past Sessions (rotating ephemeral key)...");

  let currentSessId = 1;

  // Attendance matrices: inner arrays = students present at that session
  const sessions = {
    // CS-401 — varied: 90%+, 70%, ~50%
    1: [
      [student1, student2, student3, student4, student5],
      [student1, student2, student3, student4],
      [student1, student2, student3, student4],
      [student1, student2, student3, student4],
      [student1, student2, student3],
      [student1, student2, student3],
      [student1, student2],
      [student1, student2],
      [student1, student5],
    ],
    // AI-302 — similar spread
    2: [
      [student1, student2, student3, student4, student5],
      [student1, student2, student3, student4, student5],
      [student1, student2, student3, student4, student5],
      [student1, student2, student3, student4],
      [student1, student3, student4],
      [student1, student3, student4],
      [student1, student3, student4],
      [student3, student4],
      [student3, student4],
    ],
    // CS-405
    3: [
      [student1, student2, student3, student4, student5],
      [student1, student2, student3, student4],
      [student1, student2, student3, student4],
      [student1, student2, student3, student4],
      [student1, student2, student3, student4],
      [student1, student2, student3],
      [student1, student2, student3],
      [student1, student2, student3],
      [student1, student2],
    ],
  };

  const teacherBySub = { 1: teacher1, 2: teacher2, 3: teacher1 };

  for (const [subIdStr, matrix] of Object.entries(sessions)) {
    const subId = Number(subIdStr);
    const teacher = teacherBySub[subId];

    for (const presentArr of matrix) {
      // Generate an ephemeral wallet — this mirrors what the browser teacher UI does
      const ephemeral = ethers.Wallet.createRandom();

      await (await contract.connect(teacher).startSession(subId, ephemeral.address, 60)).wait();

      for (const st of presentArr) {
        // Sign (sessionId, windowIndex=0) — same as the QR payload in window 0
        const msgHash = ethers.solidityPackedKeccak256(
          ["uint256", "uint256"],
          [currentSessId, 0]
        );
        const sig = await ephemeral.signMessage(ethers.getBytes(msgHash));
        await (await contract.connect(st).markAttendance(currentSessId, 0, sig)).wait();
      }
      currentSessId++;
    }
    console.log(`   ✓ 9 sessions seeded for subject ${subId}`);
  }

  // ── Live Demo Session ────────────────────────────────────────────────────────
  console.log(`\n5️⃣  Launching Live Demo Session #${currentSessId} for CS-401...`);
  const demoOtpArr = new Uint32Array(1);
  (globalThis.crypto ?? (await import('crypto')).webcrypto).getRandomValues(demoOtpArr);
  const DEMO_OTP = String(100000 + (demoOtpArr[0] % 900000));
  const demoAddr = demoOtpAddress(currentSessId, DEMO_OTP);
  await (await contract.connect(teacher1).startSessionWithDemoCode(1, demoAddr, 120, DEMO_OTP)).wait();
  console.log(`   🎉 LIVE SESSION ACTIVE!`);
  console.log(`   Session ID   : ${currentSessId}`);
  console.log(`   Subject      : CS-401`);
  console.log(`   Demo OTP     : ${DEMO_OTP}  (ephemeral addr derived deterministically)`);
  console.log(`   Ephemeral Addr: ${demoAddr}`);
  console.log("\n✨ Seeding complete!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
