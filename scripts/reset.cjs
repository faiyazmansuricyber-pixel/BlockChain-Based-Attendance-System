/**
 * reset.cjs — Clean restart: terminates any running Hardhat node, deletes
 * contractConfig.js, recompiles the contract, and runs a fresh deploy.
 * No seed data is registered. Run `npm run seed` manually afterwards if needed.
 */
const { execSync, spawn } = require("child_process");
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const ROOT         = path.join(__dirname, "..");
const CONFIG_FILE  = path.join(ROOT, "src", "utils", "contractConfig.js");
const HARDHAT_PORT = 8545;

function log(msg) { console.log(msg); }

// Kill whatever is listening on 8545 (cross-platform)
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
      log(`🔪 Killed PIDs on :${port}: ${pids.join(", ")}`);
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "ignore" });
      log(`🔪 Killed processes on :${port}`);
    }
  } catch {
    log(`ℹ️  No process was using port ${port}`);
  }
}

async function main() {
  log("⚡ BLOCKCHAIN ATTENDANCE — CLEAN RESET");
  log("==========================================");

  // 1. Kill old node
  log("\n1️⃣  Stopping existing Hardhat node (if any)...");
  killPort(HARDHAT_PORT);
  await sleep(800);

  // 2. Delete stale config
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
    log(`2️⃣  Deleted stale ${CONFIG_FILE}`);
  } else {
    log("2️⃣  No stale contractConfig.js found.");
  }

  // 3. Compile
  log("\n3️⃣  Compiling contracts...");
  execSync("npx hardhat compile", { cwd: ROOT, stdio: "inherit" });

  // 4. Spawn fresh Hardhat node (detached)
  log("\n4️⃣  Starting fresh Hardhat node on :8545...");
  const isWin = os.platform() === "win32";
  const cmd = isWin ? "cmd.exe" : "npx";
  const args = isWin ? ["/c", "npx hardhat node"] : ["hardhat", "node"];
  const nodeProc = spawn(cmd, args, { cwd: ROOT, detached: true, stdio: "ignore" });
  nodeProc.unref();
  await sleep(4000); // Give node time to start

  // 5. Deploy
  log("\n5️⃣  Deploying contract (clean — no sample data)...");
  execSync("npx hardhat run scripts/deploy.js --network localhost", { cwd: ROOT, stdio: "inherit" });

  log("\n✅ RESET COMPLETE — Chain is fresh, contract deployed with ZERO data.");
  log("   Run `npm run seed` to populate demo data, or use the Admin portal.");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
