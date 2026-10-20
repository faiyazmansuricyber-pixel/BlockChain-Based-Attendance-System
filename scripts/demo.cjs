/**
 * demo.cjs — Complete All-In-One Demo Runner:
 * 1. Stops any process running on port 8545.
 * 2. Deletes stale contractConfig.js.
 * 3. Compiles smart contracts (npx hardhat compile).
 * 4. Starts fresh Hardhat node on :8545 in background.
 * 5. Deploys AttendanceSystem contract (scripts/deploy.js).
 * 6. Registers full class roster & past sessions (scripts/register-class.js).
 * 7. Starts Vite frontend dev server (npm run dev).
 */
const { execSync, spawn } = require("child_process");
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const ROOT         = path.join(__dirname, "..");
const CONFIG_FILE  = path.join(ROOT, "src", "utils", "contractConfig.js");
const HARDHAT_PORT = 8545;

function log(msg) { console.log(msg); }

function killPort(port) {
  try {
    if (os.platform() === "win32") {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const pids = [...new Set(
        result.split("\n")
          .map(l => l.trim().split(/\s+/).pop())
          .filter(p => /^\d+$/.test(p) && p !== "0")
      )];
      pids.forEach(pid => {
        try { execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" }); } catch {}
      });
      log(`🔪 Killed stale PIDs on :${port}: ${pids.join(", ")}`);
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "ignore" });
      log(`🔪 Killed stale processes on :${port}`);
    }
  } catch {
    log(`ℹ️  No process running on port ${port}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  log("\n========================================================");
  log("🚀 LAUNCHING TECHQUEST BLOCKCHAIN ATTENDANCE DEMO MODE");
  log("========================================================\n");

  // Step 1: Kill stale node
  log("1️⃣  Stopping existing Hardhat node (if any)...");
  killPort(HARDHAT_PORT);
  await sleep(800);

  // Step 2: Delete stale config
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
    log(`2️⃣  Deleted stale ${CONFIG_FILE}`);
  } else {
    log("2️⃣  No stale contractConfig.js found.");
  }

  // Step 3: Compile contracts
  log("\n3️⃣  Compiling smart contracts...");
  execSync("npx hardhat compile", { cwd: ROOT, stdio: "inherit" });

  // Step 4: Spawn fresh Hardhat node (detached)
  log("\n4️⃣  Starting fresh Hardhat node on :8545...");
  const isWin = os.platform() === "win32";
  const cmd = isWin ? "cmd.exe" : "npx";
  const args = isWin ? ["/c", "npx hardhat node"] : ["hardhat", "node"];
  const nodeProc = spawn(cmd, args, { cwd: ROOT, detached: true, stdio: "ignore" });
  nodeProc.unref();
  await sleep(4000); // Give Hardhat node time to boot up

  // Step 5: Deploy contract
  log("\n5️⃣  Deploying AttendanceSystem smart contract...");
  execSync("npx hardhat run scripts/deploy.js --network localhost", { cwd: ROOT, stdio: "inherit" });

  // Step 6: Register class roster & past sessions
  log("\n6️⃣  Registering Class Roster (4 Faculty, 10 Students, 4 Subjects, Past Sessions)...");
  execSync("npx hardhat run scripts/register-class.js --network localhost", { cwd: ROOT, stdio: "inherit" });

  log("\n========================================================");
  log("✅ DEMO ENVIRONMENT READY! STARTING FRONTEND DEV SERVER...");
  log("========================================================\n");

  // Step 7: Launch Vite dev server
  const viteCmd = isWin ? "cmd.exe" : "npx";
  const viteArgs = isWin ? ["/c", "npx vite"] : ["vite"];
  spawn(viteCmd, viteArgs, { cwd: ROOT, stdio: "inherit" });
}

main().catch(err => {
  console.error("❌ Demo launch failed:", err);
  process.exit(1);
});
