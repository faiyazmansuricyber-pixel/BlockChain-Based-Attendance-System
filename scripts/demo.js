const { spawn } = require('child_process');
const path = require('path');

console.log("🚀 Starting TechQuest Blockchain Attendance Demo Environment...");

// Step 1: Start Hardhat Node
console.log("1️⃣ Starting Hardhat local node on port 8545...");
const hardhatNode = spawn('npx.cmd', ['hardhat', 'node'], {
  cwd: path.join(__dirname, '..'),
  shell: true,
  stdio: 'pipe'
});

hardhatNode.stdout.on('data', (data) => {
  const str = data.toString();
  if (str.includes('Started HTTP and WebSocket JSON-RPC server')) {
    console.log("✅ Hardhat Node is running!");
    runDeployAndSeed();
  }
});

let deployed = false;
function runDeployAndSeed() {
  if (deployed) return;
  deployed = true;

  console.log("2️⃣ Deploying AttendanceSystem contract...");
  const deployProcess = spawn('npx.cmd', ['hardhat', 'run', 'scripts/deploy.js', '--network', 'localhost'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: 'inherit'
  });

  deployProcess.on('close', (code) => {
    if (code === 0) {
      console.log("3️⃣ Seeding demo data (Teachers, Students, Subjects, Sessions)...");
      const seedProcess = spawn('npx.cmd', ['hardhat', 'run', 'scripts/seed.js', '--network', 'localhost'], {
        cwd: path.join(__dirname, '..'),
        shell: true,
        stdio: 'inherit'
      });

      seedProcess.on('close', (seedCode) => {
        if (seedCode === 0) {
          console.log("4️⃣ Starting Vite Frontend Dev Server...");
          spawn('npm.cmd', ['run', 'dev'], {
            cwd: path.join(__dirname, '..'),
            shell: true,
            stdio: 'inherit'
          });
        }
      });
    }
  });
}
