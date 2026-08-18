const { spawn } = require('child_process');
const { createServer } = require('vite');
const esbuild = require('esbuild');
const path = require('path');

async function start() {
  // 1. Start Vite dev server
  const viteServer = await createServer({
    configFile: path.resolve(__dirname, '../vite.config.ts'),
    server: { port: 5173 }
  });
  await viteServer.listen();
  console.log('Vite server listening on http://localhost:5173');

  // 2. Build electron main & preload
  let electronProcess = null;

  function startElectron() {
    if (electronProcess) {
      try {
        electronProcess.kill();
      } catch (e) {}
    }
    
    // We run Electron and pass our compiled main file
    electronProcess = spawn('npx', ['electron', 'dist-electron/main.js'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: 'http://localhost:5173'
      }
    });

    electronProcess.on('close', () => {
      // Don't kill dev server when closing a re-spawned child
    });
  }

  // Compiler context for Main Process
  const mainCtx = await esbuild.context({
    entryPoints: [path.resolve(__dirname, '../electron/main/main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron', 'better-sqlite3', '@prisma/client'],
    outfile: path.resolve(__dirname, '../dist-electron/main.js'),
    sourcemap: true,
    plugins: [{
      name: 'rebuild-notify',
      setup(build) {
        build.onEnd(() => {
          console.log('Electron main process re-compiled.');
          startElectron();
        });
      }
    }]
  });

  // Compiler context for Preload Script
  const preloadCtx = await esbuild.context({
    entryPoints: [path.resolve(__dirname, '../electron/preload/preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron'],
    outfile: path.resolve(__dirname, '../dist-electron/preload.js'),
    sourcemap: true,
    plugins: [{
      name: 'preload-notify',
      setup(build) {
        build.onEnd(() => {
          console.log('Electron preload script re-compiled.');
        });
      }
    }]
  });

  // Start watching
  await mainCtx.watch();
  await preloadCtx.watch();
}

start().catch(err => {
  console.error('Failed to start dev environment:', err);
  process.exit(1);
});
