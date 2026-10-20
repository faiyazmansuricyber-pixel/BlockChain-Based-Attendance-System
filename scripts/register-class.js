import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { ethers } = hre;

/**
 * Helper — derives the deterministic "demo OTP" ephemeral address from (sessionId, code).
 */
function demoOtpAddress(sessionId, demoCode) {
  const hash = ethers.solidityPackedKeccak256(["uint256", "string"], [sessionId, demoCode]);
  return ethers.getAddress("0x" + hash.slice(-40));
}

async function main() {
  console.log("🏫 Registering Class Roster & Past Attendance Sessions...");

  const signers = await ethers.getSigners();
  const admin    = signers[0]; // Admin Deployer

  // ── 1. Faculty (Hardhat #1 – #4) ──────────────────────────────────────────
  const facultyList = [
    { signer: signers[1], name: "Dr. Alice Morgan",  dept: "Computer Science" },
    { signer: signers[2], name: "Dr. Bruce Wayne",   dept: "Cyber Security" },
    { signer: signers[3], name: "Prof. Clara Oswald",dept: "Artificial Intelligence" },
    { signer: signers[4], name: "Prof. David Miller",dept: "Information Technology" },
  ];

  // ── 2. Students (Hardhat #5 – #14) ─────────────────────────────────────────
  const studentList = [
    { signer: signers[5],  id: "ENR-2024-001", name: "Alex Smith",     dept: "Computer Science" },
    { signer: signers[6],  id: "ENR-2024-002", name: "Bethany Jones",   dept: "Cyber Security" },
    { signer: signers[7],  id: "ENR-2024-003", name: "Charlie Davis",   dept: "Cyber Security" },
    { signer: signers[8],  id: "ENR-2024-004", name: "Daniel Wilson",   dept: "Artificial Intelligence" },
    { signer: signers[9],  id: "ENR-2024-005", name: "Emma Watson",     dept: "Artificial Intelligence" },
    { signer: signers[10], id: "ENR-2024-006", name: "Felix Brown",     dept: "Information Technology" },
    { signer: signers[11], id: "ENR-2024-007", name: "Grace Hopper",    dept: "Information Technology" },
    { signer: signers[12], id: "ENR-2024-008", name: "Henry Ford",      dept: "Computer Science" },
    { signer: signers[13], id: "ENR-2024-009", name: "Isabella Garcia", dept: "Cyber Security" },
    { signer: signers[14], id: "ENR-2024-010", name: "Jack Miller",     dept: "Artificial Intelligence" },
  ];

  // Load contract
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
    console.log("🚀 Deploying fresh contract...");
    const AttendanceSystem = await ethers.getContractFactory("AttendanceSystem");
    contract = await AttendanceSystem.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
  }

  // ── Register Teachers ──────────────────────────────────────────────────────
  console.log("\n👨‍🏫 1. Registering Faculty...");
  for (const fac of facultyList) {
    try {
      await (await contract.connect(admin).registerTeacher(fac.signer.address, fac.name, fac.dept)).wait();
      console.log(`   ✓ Registered Faculty: ${fac.name} (${fac.dept})`);
    } catch (e) {
      if (e.message.includes("already registered")) {
        console.log(`   ℹ️ Faculty already registered: ${fac.name}`);
      } else throw e;
    }
  }

  // ── Register Students ──────────────────────────────────────────────────────
  console.log("\n🎓 2. Registering Students...");
  for (const st of studentList) {
    try {
      await (await contract.connect(admin).registerStudent(st.signer.address, st.id, st.name, st.dept)).wait();
      console.log(`   ✓ Registered Student: ${st.name} (${st.id})`);
    } catch (e) {
      if (e.message.includes("already registered")) {
        console.log(`   ℹ️ Student already registered: ${st.name}`);
      } else throw e;
    }
  }

  // ── Create Subjects ────────────────────────────────────────────────────────
  console.log("\n📚 3. Creating Subjects...");
  const subjectsToCreate = [
    { name: "Cryptography & Network Security", code: "CS-401", teacherAddr: facultyList[0].signer.address },
    { name: "Blockchain & Smart Contracts",    code: "CY-302", teacherAddr: facultyList[1].signer.address },
    { name: "Machine Learning & AI",          code: "AI-201", teacherAddr: facultyList[2].signer.address },
    { name: "Cloud & Web Technologies",       code: "IT-104", teacherAddr: facultyList[3].signer.address },
  ];

  for (const sub of subjectsToCreate) {
    try {
      await (await contract.connect(admin).createSubject(sub.name, sub.code, sub.teacherAddr)).wait();
      console.log(`   ✓ Created Subject: ${sub.code} — ${sub.name}`);
    } catch (e) {
      console.log(`   ℹ️ Subject creation skipped or already exists: ${sub.code}`);
    }
  }

  // ── Create Past Sessions ───────────────────────────────────────────────────
  console.log("\n⏳ 4. Creating Past Sessions & Varied Attendance Records...");

  // Shorthands for student signers
  const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10] = studentList.map(st => st.signer);

  /**
   * Attendance matrices for 9 past sessions per subject.
   * Student attendance targets:
   * - s1 (Alex Smith): High (9/9 = 100%)
   * - s2 (Bethany Jones): High (8/9 = 89%)
   * - s3 (Charlie Davis): High (9/9 = 100%)
   * - s4 (Daniel Wilson): Defaulter (4/9 = 44%)
   * - s5 (Emma Watson): Moderate (7/9 = 78%)
   * - s6 (Felix Brown): Defaulter (5/9 = 55%)
   * - s7 (Grace Hopper): High (8/9 = 89%)
   * - s8 (Henry Ford): Defaulter (6/9 = 67%)
   * - s9 (Isabella Garcia): High (8/9 = 89%)
   * - s10 (Jack Miller): Moderate (7/9 = 78%)
   */
  const attendanceMatrix = [
    [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10], // Session 1: All present
    [s1, s2, s3, s5, s7, s8, s9, s10],         // Session 2
    [s1, s2, s3, s5, s6, s7, s9, s10],         // Session 3
    [s1, s2, s3, s4, s5, s7, s8, s9],          // Session 4
    [s1, s3, s5, s6, s7, s9, s10],             // Session 5
    [s1, s2, s3, s4, s7, s8, s9, s10],         // Session 6
    [s1, s2, s3, s5, s6, s7, s9],              // Session 7
    [s1, s2, s3, s8, s9, s10],                 // Session 8
    [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10], // Session 9: All present
  ];

  let currentSessId = 1;

  for (let subId = 1; subId <= 4; subId++) {
    const teacherSigner = facultyList[subId - 1].signer;

    for (const presentArr of attendanceMatrix) {
      const ephemeral = ethers.Wallet.createRandom();

      await (await contract.connect(teacherSigner).startSession(subId, ephemeral.address, 60)).wait();

      for (const stSigner of presentArr) {
        const msgHash = ethers.solidityPackedKeccak256(
          ["uint256", "uint256"],
          [currentSessId, 0]
        );
        const sig = await ephemeral.signMessage(ethers.getBytes(msgHash));
        await (await contract.connect(stSigner).markAttendance(currentSessId, 0, sig)).wait();
      }

      currentSessId++;
    }
    console.log(`   ✓ 9 past sessions created for Subject #${subId}`);
  }

  // ── 5. Launch Live Demo Session ───────────────────────────────────────────
  console.log("\n🎉 5. Launching Live Demo Session...");
  const liveSessionId = currentSessId;
  const demoCodeArr = new Uint32Array(1);
  (globalThis.crypto ?? (await import('crypto')).webcrypto).getRandomValues(demoCodeArr);
  const demoCode = String(100000 + (demoCodeArr[0] % 900000));
  const liveEphemeralAddr = demoOtpAddress(liveSessionId, demoCode);

  await (await contract.connect(facultyList[0].signer).startSessionWithDemoCode(1, liveEphemeralAddr, 120, demoCode)).wait();

  console.log(`\n✅ CLASS REGISTERED SUCCESSFULLY!`);
  console.log(`   Live Session ID : #${liveSessionId} (Subject: CS-401)`);
  console.log(`   Demo OTP        : ${demoCode}`);
  console.log(`   Faculty Count   : ${facultyList.length}`);
  console.log(`   Student Count   : ${studentList.length}`);
}

main().catch(err => {
  console.error("❌ Registration failed:", err);
  process.exit(1);
});
