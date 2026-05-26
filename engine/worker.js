const { parentPort } = require('worker_threads');

parentPort.on('message', (msg) => {
  console.log('[engine] received:', msg);

  if (msg.type === 'init') {
    parentPort.postMessage({ type: 'ready', status: 'engine initialized' });
  }
});
