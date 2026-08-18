const { spawn } = require('child_process');
const path = require('path');

const exePath = path.resolve(__dirname, '../dist-package/win-unpacked/Smart Vyapar.exe');
console.log('Spawning:', exePath);

const child = spawn(exePath, [], {
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1' // Force logging
  }
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  stdout += data.toString();
});

child.stderr.on('data', (data) => {
  stderr += data.toString();
});

setTimeout(() => {
  console.log('Killing child process...');
  child.kill();
  
  console.log('\n--- STDOUT ---');
  console.log(stdout || '(empty)');
  
  console.log('\n--- STDERR ---');
  console.log(stderr || '(empty)');
  
  process.exit(0);
}, 5000);
