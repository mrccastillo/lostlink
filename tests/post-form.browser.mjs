import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createAuth } from "../src/lib/auth/create-auth.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

// Run after npm run build. Uses isolated MongoDB and a separate local app; never uploads to Cloudinary.
test("authenticated report form supports dropped previews without horizontal overflow", { timeout: 90_000 }, async () => {
  const executable = [process.env.BROWSER_EXECUTABLE,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((path) => path && existsSync(path));
  assert.ok(executable, "Set BROWSER_EXECUTABLE to an installed Chromium browser.");
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri());
  await client.connect();
  const baseURL = 'http://localhost:3118';
  const config = { mongoUri: replica.getUri(), databaseName: 'isolated_preview_test', secret: 'isolated-browser-test-secret-32-characters', baseURL, emailApiKey: 'test-only', emailFrom: 'auth@example.test' };
  const emails = [];
  const auth = createAuth({ db: client.db(config.databaseName), client, config, sendEmail: async (email) => { emails.push(email.text); } });
  const credentials = { email: 'preview@example.test', password: 'isolated-preview-test-password' };
  const request = (path, body) => auth.handler(new Request(baseURL + '/api/auth' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL }, body: JSON.stringify(body) }));
  assert.equal((await request('/sign-up/email', { ...credentials, name: 'Preview Member' })).status, 200);
  await auth.handler(new Request(emails[0].match(/https?:\/\/\S+/)[0]));
  const login = await request('/sign-in/email', credentials);
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3118'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, MONGODB_URI: config.mongoUri, MONGODB_DB: config.databaseName, BETTER_AUTH_SECRET: config.secret, BETTER_AUTH_URL: baseURL, RESEND_API_KEY: 'test-only', AUTH_EMAIL_FROM: config.emailFrom, CLOUDINARY_CLOUD_NAME: 'isolated-test', CLOUDINARY_API_KEY: 'test-only', CLOUDINARY_API_SECRET: 'test-only' } });
  for (let n = 0; n < 60; n++) { try { await fetch(baseURL + '/discover'); break; } catch { await delay(200); } }
  const profile = await mkdtemp(join(tmpdir(), "lostlink-dialog-test-"));
  const browser = spawn(executable, ["--headless=new", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket;
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; }
      catch { await delay(100); }
    }
    assert.ok(port, "Browser debugging endpoint did not start.");
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    let id = 0;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const entry = pending.get(message.id);
      if (entry) { pending.delete(message.id); if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result); }
    });
    function send(method, params = {}) {
      return new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); });
    }
    async function evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function until(expression, label) {
      for (let attempt = 0; attempt < 120; attempt++) {
        if (await evaluate(expression)) return;
        await delay(150);
      }
      assert.fail(label);
    }
    await send("Network.enable");
    await send("Network.setExtraHTTPHeaders", { headers: { Cookie: cookie } });
    await send("Page.enable");
    await send("Page.bringToFront");
    await send("Page.navigate", { url: `${baseURL}/discover?q=camera` });
    await until("document.readyState === 'complete' && !!document.querySelector('.discover-heading button')", "Discover did not load");
    await delay(1500);
    await evaluate("document.querySelector('.discover-heading button').click()");
    await until("!!document.querySelector('.media-dropzone')", "Authenticated report uploader did not load");
    assert.equal(await evaluate("document.querySelectorAll('dialog form').length"), 1, 'No nested upload forms');
    assert.equal(await evaluate("!!(document.querySelector('textarea').compareDocumentPosition(document.querySelector('.media-dropzone')) & Node.DOCUMENT_POSITION_FOLLOWING)"), true, 'Dropzone must follow description');
    await evaluate(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'example.png', { type: 'image/png' }));
      transfer.items.add(new File([new Uint8Array([26,69,223,163])], 'example.webm', { type: 'video/webm' }));
      document.querySelector('.media-dropzone').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    })()`);
    await until("document.querySelectorAll('.media-preview').length === 2", "Dropped file previews missing");
    await until("document.querySelector('.media-preview img').naturalWidth > 0", "Image preview did not decode");
    assert.equal(await evaluate("!!document.querySelector('.media-preview video[controls]')"), true, 'Video preview must have controls');
    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 500 });
      await delay(150);
      assert.equal(await evaluate("(() => { const dialog = document.querySelector('dialog[open]'); return dialog.scrollWidth <= dialog.clientWidth; })()"), true, 'No horizontal overflow at ' + width);
    }
    await evaluate("document.querySelector('.media-remove').click()");
    await until("document.querySelectorAll('.media-preview').length === 1", "File removal failed");
    console.log('PASS authenticated form: dropzone position, image/video previews, removal, single form, and no horizontal overflow at 1280/390/320px');
  } finally {
    app.kill();
    await client.close();
    await replica.stop();
    socket?.close();
    browser.kill();
    await new Promise((resolve) => { if (browser.exitCode !== null) resolve(); else browser.once("exit", resolve); });
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
