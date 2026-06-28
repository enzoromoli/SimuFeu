// VSCode's integrated terminal (itself an Electron app) leaks ELECTRON_RUN_AS_NODE=1
// into child processes, which forces our `electron` binary to run as plain Node
// instead of launching the app. Remove it before spawning Electron.
delete process.env.ELECTRON_RUN_AS_NODE;
process.env.NODE_ENV = 'development';

const { spawn } = require('child_process');
const electronPath = require('electron');

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
