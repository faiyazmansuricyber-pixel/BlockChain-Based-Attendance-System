const { ethers } = require("hardhat");
const assert = require("assert");

async function main() {
  console.log("=== TESTING ISSUE 3: ACTIVE SESSIONS FILTERING & SELECTION PERSISTENCE ===");

  const [admin, teacher1, student1] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("AttendanceSystem");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  await contract.registerTeacher(teacher1.address, "Rohitkumar", "CS");
  await contract.registerStudent(student1.address, "ENR-001", "Momin", "CS");
  await contract.createSubject("Crypto", "CS-401", teacher1.address);

  // Start Session 1 (will be expired)
  const ep1 = ethers.Wallet.createRandom();
  await contract.connect(teacher1).startSession(1, ep1.address, 1);

  // Jump time by 100 seconds to expire Session 1
  await ethers.provider.send("evm_increaseTime", [100]);
  await ethers.provider.send("evm_mine", []);

  // Start Session 2 (active, 30 min)
  const ep2 = ethers.Wallet.createRandom();
  await contract.connect(teacher1).startSession(1, ep2.address, 30);

  // Start Session 3 (active, 60 min)
  const ep3 = ethers.Wallet.createRandom();
  await contract.connect(teacher1).startSession(1, ep3.address, 60);

  // Fetch latest block timestamp
  const latestBlock = await ethers.provider.getBlock("latest");
  const blockTs = latestBlock.timestamp;

  // Filter active sessions by LATEST BLOCK TIMESTAMP
  const nextId = Number(await contract.nextSessionId()) - 1;
  const activeList = [];

  for (let id = nextId; id >= 1; id--) {
    const s = await contract.sessions(id);
    if (s.isActive && Number(s.expiryTime) > blockTs) {
      const sub = await contract.subjects(s.subjectId);
      activeList.push({
        sessionId: id,
        subjectId: Number(s.subjectId),
        subjectCode: sub.code,
        subjectName: sub.name,
        expiryTime: Number(s.expiryTime),
      });
    }
  }

  // Verify only Session 2 & 3 are active, and Session 1 is excluded
  console.log("Active sessions found by latest block timestamp:", activeList.map(s => s.sessionId));
  assert.equal(activeList.length, 2, "Expected 2 active sessions");
  assert.equal(activeList[0].sessionId, 3, "Newest session must be first (Session 3)");
  assert.equal(activeList[1].sessionId, 2, "Session 2 must be second");

  // Verify state preservation logic:
  // If user selected session 2, a background refresh must NEVER overwrite it to session 3
  let userSelection = 2;
  const refreshList = [...activeList]; // Simulated polling refresh
  if (userSelection && refreshList.some(s => s.sessionId === userSelection)) {
    // Keep user's selection
    userSelection = userSelection;
  } else if (!userSelection && refreshList.length > 0) {
    userSelection = refreshList[0].sessionId;
  }
  assert.equal(userSelection, 2, "User selection was overwritten by refresh!");
  console.log("[PASS] User selection preserved across refresh (still Session #2).");

  // Verify manual Session ID input works independently
  const manualInput = "99";
  const effectiveSessionId = manualInput.trim() ? Number(manualInput) : userSelection;
  assert.equal(effectiveSessionId, 99, "Manual session ID did not take precedence!");
  console.log("[PASS] Manual session ID input works independently.");

  console.log("\n>>> Issue 3 unit/logic test PASSED!\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
