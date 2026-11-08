'use strict';

// Development helper: inspects the already-running packaged app through CDP.
// Usage: node scripts/cdp-inspect.cjs [port] [screenshot-path]
const fs = require('node:fs');

const port = Number(process.argv[2] || 9333);
const screenshotPath = process.argv[3] || 'release-test.png';

async function main() {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new Error('No page target found');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  await send('Runtime.enable');
  await send('Page.enable');

  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const board = document.querySelector('#root > div > div');
      const gradient = document.querySelector('.bg-gradient-to-b');
      return {
        title: document.title,
        url: location.href,
        userAgent: navigator.userAgent,
        rootChildren: document.getElementById('root')?.children.length ?? 0,
        boardSize: board ? {
          width: board.getBoundingClientRect().width,
          height: board.getBoundingClientRect().height
        } : null,
        gradient: gradient ? getComputedStyle(gradient).backgroundImage : null,
        supportsLab: CSS.supports('color', 'lab(50% 0 0)'),
        textLength: document.body.innerText.length,
        visible: document.visibilityState
      };
    })()`,
    returnByValue: true,
  });

  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(screenshotPath, Buffer.from(shot.data, 'base64'));

  console.log(JSON.stringify(result.result.value, null, 2));
  console.log(`Screenshot: ${screenshotPath}`);
  socket.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
