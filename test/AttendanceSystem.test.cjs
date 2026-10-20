const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper: sign (sessionId, windowIndex) with a wallet — mirrors what the browser does
async function signQrWindow(wallet, sessionId, windowIndex) {
  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "uint256"],
    [sessionId, windowIndex]
  );
  // ethers v6 signMessage prepends "\x19Ethereum Signed Message:\n32" automatically
  return wallet.signMessage(ethers.getBytes(messageHash));
}

// Helper: generate a random ephemeral wallet (like the browser would)
function randomEphemeral() {
  return ethers.Wallet.createRandom();
}

describe("AttendanceSystem — Rotating-QR & Deactivation Suite", function () {
  let contract;
  let admin, teacher1, teacher2, student1, student2, unregistered;

  beforeEach(async function () {
    [admin, teacher1, teacher2, student1, student2, unregistered] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("AttendanceSystem");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // =====================================================
  // 1. DEPLOYMENT & ROLE ASSIGNMENT
  // =====================================================
  describe("1. Deployment & Role Assignment", function () {
    it("Deployer is Admin (role == 1)", async function () {
      expect(await contract.admin()).to.equal(admin.address);
      expect(await contract.getUserRole(admin.address)).to.equal(1);
    });

    it("Admin can register Teacher and Student", async function () {
      await contract.registerTeacher(teacher1.address, "Dr. Jenkins", "CS");
      expect(await contract.getUserRole(teacher1.address)).to.equal(2);

      await contract.registerStudent(student1.address, "CS001", "Alice", "CS");
      expect(await contract.getUserRole(student1.address)).to.equal(3);
    });

    it("REVERT: non-admin registers a teacher", async function () {
      await expect(
        contract.connect(unregistered).registerTeacher(teacher2.address, "X", "CS")
      ).to.be.revertedWith("Only Admin can perform this action");
    });

    it("REVERT: non-admin registers a student", async function () {
      await expect(
        contract.connect(teacher1).registerStudent(student2.address, "CS002", "Bob", "CS")
      ).to.be.revertedWith("Only Admin can perform this action");
    });
  });

  // =====================================================
  // 2. DEACTIVATION (PART A)
  // =====================================================
  describe("2. Deactivation — Part A", function () {
    beforeEach(async function () {
      await contract.registerTeacher(teacher1.address, "Dr. Jenkins", "CS");
      await contract.registerStudent(student1.address, "CS001", "Alice", "CS");
      await contract.createSubject("Blockchain", "CS-401", teacher1.address);
    });

    it("Admin can deactivate a teacher", async function () {
      await expect(contract.removeTeacher(teacher1.address))
        .to.emit(contract, "TeacherDeactivated")
        .withArgs(teacher1.address, "Dr. Jenkins");

      const t = await contract.teachers(teacher1.address);
      expect(t.isActive).to.be.false;
    });

    it("Admin can deactivate a student", async function () {
      await expect(contract.removeStudent(student1.address))
        .to.emit(contract, "StudentDeactivated")
        .withArgs(student1.address, "CS001", "Alice");

      const s = await contract.students(student1.address);
      expect(s.isActive).to.be.false;
    });

    it("REVERT: deactivated teacher cannot start a session", async function () {
      await contract.removeTeacher(teacher1.address);

      const ephemeral = randomEphemeral();
      await expect(
        contract.connect(teacher1).startSession(1, ephemeral.address, 10)
      ).to.be.revertedWith("Teacher account has been deactivated");
    });

    it("REVERT: deactivated student cannot mark attendance", async function () {
      const ephemeral = randomEphemeral();
      await contract.connect(teacher1).startSession(1, ephemeral.address, 10);
      const sig = await signQrWindow(ephemeral, 1, 0);

      await contract.removeStudent(student1.address);

      await expect(
        contract.connect(student1).markAttendance(1, 0, sig)
      ).to.be.revertedWith("Student account has been deactivated");
    });

    it("Past records of deactivated student remain readable", async function () {
      const ephemeral = randomEphemeral();
      await contract.connect(teacher1).startSession(1, ephemeral.address, 10);
      const sig = await signQrWindow(ephemeral, 1, 0);
      await contract.connect(student1).markAttendance(1, 0, sig);

      // Deactivate after having attended
      await contract.removeStudent(student1.address);
      const history = await contract.getStudentAttendanceHistory(student1.address);
      expect(history.length).to.equal(1);
    });

    it("REVERT: double-deactivation of teacher fails", async function () {
      await contract.removeTeacher(teacher1.address);
      await expect(contract.removeTeacher(teacher1.address)).to.be.revertedWith(
        "Teacher already deactivated"
      );
    });
  });

  // =====================================================
  // 3. SESSION ACCESS CONTROL
  // =====================================================
  describe("3. Session Access Control", function () {
    let ephemeralA;

    beforeEach(async function () {
      await contract.registerTeacher(teacher1.address, "Dr. Jenkins", "CS");
      await contract.registerTeacher(teacher2.address, "Prof. Chen", "AI");
      await contract.registerStudent(student1.address, "CS001", "Alice", "CS");
      await contract.createSubject("Blockchain", "CS-401", teacher1.address);
      ephemeralA = randomEphemeral();
    });

    it("Assigned teacher starts a session → emits SessionStarted, increments sessionCount", async function () {
      await expect(
        contract.connect(teacher1).startSession(1, ephemeralA.address, 10)
      ).to.emit(contract, "SessionStarted");
      expect(await contract.subjectSessionCount(1)).to.equal(1);
    });

    it("REVERT: wrong teacher cannot start session for another teacher's subject", async function () {
      await expect(
        contract.connect(teacher2).startSession(1, ephemeralA.address, 10)
      ).to.be.revertedWith("Only assigned subject teacher or admin can start session");
    });

    it("Assigned teacher can end their own session", async function () {
      await contract.connect(teacher1).startSession(1, ephemeralA.address, 10);
      await expect(contract.connect(teacher1).endSession(1)).to.emit(contract, "SessionEnded");
      const sess = await contract.sessions(1);
      expect(sess.isActive).to.be.false;
    });

    it("REVERT: wrong teacher cannot end a session", async function () {
      await contract.connect(teacher1).startSession(1, ephemeralA.address, 10);
      await expect(
        contract.connect(teacher2).endSession(1)
      ).to.be.revertedWith("Only teacher and admin can end session");
    });

    it("Admin can end any session", async function () {
      await contract.connect(teacher1).startSession(1, ephemeralA.address, 10);
      await expect(contract.endSession(1)).to.emit(contract, "SessionEnded");
      const sess = await contract.sessions(1);
      expect(sess.isActive).to.be.false;
    });

    it("REVERT: student cannot end a session", async function () {
      await contract.connect(teacher1).startSession(1, ephemeralA.address, 10);
      await expect(
        contract.connect(student1).endSession(1)
      ).to.be.revertedWith("Only teacher and admin can end session");
    });
  });

  // =====================================================
  // 4. ROTATING SIGNED QR — ecrecover (PART B)
  // =====================================================
  describe("4. Rotating Signed QR — ecrecover (Part B)", function () {
    let ephemeralA, ephemeralB;

    beforeEach(async function () {
      await contract.registerTeacher(teacher1.address, "Dr. Jenkins", "CS");
      await contract.registerStudent(student1.address, "CS001", "Alice", "CS");
      await contract.registerStudent(student2.address, "CS002", "Bob", "CS");
      await contract.createSubject("Blockchain", "CS-401", teacher1.address);

      ephemeralA = randomEphemeral();
      ephemeralB = randomEphemeral();

      // Session 1 uses ephemeralA, Session 2 uses ephemeralB
      await contract.connect(teacher1).startSession(1, ephemeralA.address, 10);
      await contract.connect(teacher1).startSession(1, ephemeralB.address, 10);
    });

    it("Valid signature (window 0) is accepted and AttendanceMarked emits", async function () {
      const sig = await signQrWindow(ephemeralA, 1, 0);
      await expect(contract.connect(student1).markAttendance(1, 0, sig))
        .to.emit(contract, "AttendanceMarked")
        .withArgs(1, 1, student1.address, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("REVERT: wrong session's signature rejected in Session 1", async function () {
      // Sign for sessionId=2 but try to use it in sessionId=1
      const sigForSession2 = await signQrWindow(ephemeralA, 2, 0);
      await expect(
        contract.connect(student1).markAttendance(1, 0, sigForSession2)
      ).to.be.revertedWith("Invalid QR signature - wrong session or replayed code");
    });

    it("REVERT: Session A ephemeral key signature rejected in Session B", async function () {
      // Session 1 uses ephemeralA; sign windowIndex=0 for sessionId=2 with ephemeralA
      const sigWithEphemeralA = await signQrWindow(ephemeralA, 2, 0);
      await expect(
        contract.connect(student1).markAttendance(2, 0, sigWithEphemeralA)
      ).to.be.revertedWith("Invalid QR signature - wrong session or replayed code");
    });

    it("REVERT: expired window (window 2) rejected — rescan required", async function () {
      // Jump 41 seconds → currentWindow == 2, windowIndex=0 is 2 windows old → invalid
      await ethers.provider.send("evm_increaseTime", [41]);
      await ethers.provider.send("evm_mine", []);

      const sig = await signQrWindow(ephemeralA, 1, 0);
      await expect(
        contract.connect(student1).markAttendance(1, 0, sig)
      ).to.be.revertedWith("QR window has expired - rescan the teacher screen");
    });

    it("Previous window (window N-1) accepted — gives scan-lag leeway", async function () {
      // Jump 21 seconds → currentWindow == 1, windowIndex=0 is previous → accepted
      await ethers.provider.send("evm_increaseTime", [21]);
      await ethers.provider.send("evm_mine", []);

      const sig = await signQrWindow(ephemeralA, 1, 0);
      // Should NOT revert
      await expect(contract.connect(student1).markAttendance(1, 0, sig)).to.not.be.reverted;
    });

    it("REVERT: duplicate attendance on same session", async function () {
      const sig = await signQrWindow(ephemeralA, 1, 0);
      await contract.connect(student1).markAttendance(1, 0, sig);
      // Try to mark again — even with fresh signature
      const sig2 = await signQrWindow(ephemeralA, 1, 0);
      await expect(
        contract.connect(student1).markAttendance(1, 0, sig2)
      ).to.be.revertedWith("Attendance already marked for this session");
    });

    it("REVERT: unregistered wallet cannot mark attendance", async function () {
      const sig = await signQrWindow(ephemeralA, 1, 0);
      await expect(
        contract.connect(unregistered).markAttendance(1, 0, sig)
      ).to.be.revertedWith("Only registered Student can perform this action");
    });

    it("REVERT: attendance after endSession", async function () {
      await contract.connect(teacher1).endSession(1);
      const sig = await signQrWindow(ephemeralA, 1, 0);
      await expect(
        contract.connect(student1).markAttendance(1, 0, sig)
      ).to.be.revertedWith("Session is not active");
    });

    it("subjectSessionCount increments correctly", async function () {
      expect(await contract.subjectSessionCount(1)).to.equal(2);
    });

    it("getStudentAttendanceHistory tracks all attended sessions", async function () {
      const sigA = await signQrWindow(ephemeralA, 1, 0);
      const sigB = await signQrWindow(ephemeralB, 2, 0);
      await contract.connect(student1).markAttendance(1, 0, sigA);
      await contract.connect(student1).markAttendance(2, 0, sigB);

      const history = await contract.getStudentAttendanceHistory(student1.address);
      expect(history.length).to.equal(2);
      expect(Number(history[0].sessionId)).to.equal(1);
      expect(Number(history[1].sessionId)).to.equal(2);

      const [total, attended] = await contract.getSubjectAttendanceStats(1, student1.address);
      expect(Number(total)).to.equal(2);
      expect(Number(attended)).to.equal(2);
    });
  });

  // =====================================================
  // 5. DEMO FALLBACK (6-digit OTP)
  // =====================================================
  describe("5. Demo Fallback (6-digit OTP)", function () {
    const demoCode = "739201";

    beforeEach(async function () {
      await contract.registerTeacher(teacher1.address, "Dr. Jenkins", "CS");
      await contract.registerStudent(student1.address, "CS001", "Alice", "CS");
      await contract.createSubject("CS", "CS-101", teacher1.address);
    });

    it("Demo fallback accepted when flag is enabled", async function () {
      // Derive deterministic ephemeral address from (sessionId=1, code)
      const codeHash = ethers.solidityPackedKeccak256(["uint256", "string"], [1, demoCode]);
      const fakeAddr = ethers.getAddress("0x" + codeHash.slice(-40));
      await contract.connect(teacher1).startSession(1, fakeAddr, 10);
      await expect(
        contract.connect(student1).markAttendanceWithCode(1, demoCode)
      ).to.emit(contract, "AttendanceMarked");
    });

    it("REVERT: demo fallback rejected when admin disables flag", async function () {
      const codeHash = ethers.solidityPackedKeccak256(["uint256", "string"], [1, demoCode]);
      const fakeAddr = ethers.getAddress("0x" + codeHash.slice(-40));
      await contract.connect(teacher1).startSession(1, fakeAddr, 10);

      await contract.setDemoFallbackEnabled(false);
      await expect(
        contract.connect(student1).markAttendanceWithCode(1, demoCode)
      ).to.be.revertedWith("Demo 6-digit OTP fallback is currently disabled");
    });

    it("REVERT: wrong OTP code fails", async function () {
      const codeHash = ethers.solidityPackedKeccak256(["uint256", "string"], [1, demoCode]);
      const fakeAddr = ethers.getAddress("0x" + codeHash.slice(-40));
      await contract.connect(teacher1).startSession(1, fakeAddr, 10);

      await expect(
        contract.connect(student1).markAttendanceWithCode(1, "000000")
      ).to.be.revertedWith("Invalid 6-digit demo OTP code");
    });

    it("Each session gets its own code: code from session A is rejected for session B", async function () {
      const epA = randomEphemeral();
      const epB = randomEphemeral();
      const codeA = "111222";
      const codeB = "333444";

      // Session 1 has codeA, Session 2 has codeB
      await contract.connect(teacher1).startSessionWithDemoCode(1, epA.address, 10, codeA);
      await contract.connect(teacher1).startSessionWithDemoCode(1, epB.address, 10, codeB);

      // Student 1 checks in on Session 1 with codeA -> OK
      await expect(contract.connect(student1).markAttendanceWithCode(1, codeA))
        .to.emit(contract, "AttendanceMarked");

      // Student 1 attempts to use codeA on Session 2 -> REVERT
      await expect(
        contract.connect(student1).markAttendanceWithCode(2, codeA)
      ).to.be.revertedWith("Invalid 6-digit demo OTP code");

      // Old hardcoded fallback "739201" is completely rejected on Session 2
      await expect(
        contract.connect(student1).markAttendanceWithCode(2, "739201")
      ).to.be.revertedWith("Invalid 6-digit demo OTP code");

      // Valid codeB succeeds on Session 2
      await expect(contract.connect(student1).markAttendanceWithCode(2, codeB))
        .to.emit(contract, "AttendanceMarked");
    });

    it("REVERT: duration above 300 minutes rejected", async function () {
      const ep = randomEphemeral();
      await expect(
        contract.connect(teacher1).startSession(1, ep.address, 301)
      ).to.be.revertedWith("Duration must be between 1 and 300 minutes");
    });
  });

  // =====================================================
  // 6. SUBJECT DEACTIVATION
  // =====================================================
  describe("6. Subject Deactivation", function () {
    beforeEach(async function () {
      await contract.registerTeacher(teacher1.address, "Dr. Jenkins", "CS");
      await contract.createSubject("Blockchain", "CS-401", teacher1.address);
    });

    it("Admin can deactivate a subject", async function () {
      await expect(contract.removeSubject(1))
        .to.emit(contract, "SubjectDeactivated")
        .withArgs(1, "CS-401");

      const sub = await contract.subjects(1);
      expect(sub.isActive).to.be.false;
    });

    it("REVERT: deactivated subject cannot start new sessions", async function () {
      await contract.removeSubject(1);
      const ep = randomEphemeral();
      await expect(
        contract.connect(teacher1).startSession(1, ep.address, 10)
      ).to.be.revertedWith("Subject does not exist or is inactive");
    });
  });
});
