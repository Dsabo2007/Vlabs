'use strict';

// Development smoke test for the Electron build:
//   npx electron scripts/capture.cjs
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.disableHardwareAcceleration();

// Every smoke run starts from a fresh profile, exactly like a first install.
const profileDir = path.join(__dirname, '..', '.electron-test-profile');
fs.rmSync(profileDir, { recursive: true, force: true });
app.setPath('userData', profileDir);

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const logs = [];
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) logs.push({ level, message, line, sourceId });
  });
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    logs.push({ level: 'did-fail-load', code, description, url });
  });

  await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const info = await window.webContents.executeJavaScript(`(() => {
    const root = document.getElementById('root');
    return {
      title: document.title,
      url: location.href,
      rootChildren: root ? root.children.length : 0,
      textLength: document.body.innerText.length,
      hasBench: Boolean(document.querySelector('[data-instrument]')),
      supportsOklch: CSS.supports('color', 'oklch(50% 0 0)'),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      screen: { width: innerWidth, height: innerHeight },
      errors: window.__labErrors || [],
    };
  })()`);

  const image = await window.webContents.capturePage();
  const screenshotPath = path.join(__dirname, '..', 'docs', 'electron-smoke.png');
  fs.writeFileSync(screenshotPath, image.toPNG());

  console.log(JSON.stringify({ info, logs }, null, 2));
  console.log(`Screenshot: ${screenshotPath}`);
  app.quit();
});
