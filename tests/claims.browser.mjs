import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

// Run against `npm run dev`: Strict Mode's effect replay triggers this regression.
test("found-item claim links open a private proof preview without submitting evidence", { timeout: 90_000 }, async () => {
  const executable = [process.env.BROWSER_EXECUTABLE,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((path) => path && existsSync(path));
  assert.ok(executable, "Set BROWSER_EXECUTABLE to an installed Chromium browser.");
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
    await send("Page.enable");
    await send("Page.bringToFront");
    await send("Page.navigate", { url: `${process.env.APP_URL || "http://localhost:3000"}/discover?q=headphones` });
    await until("document.readyState === 'complete' && !!document.querySelector('.discover-heading button')", "Discover did not load");
    await delay(1500);
    const posts = [];
    await send('Network.enable');
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Network.requestWillBeSent' && message.params.request.method === 'POST') posts.push(message.params.request.url);
    });
    await evaluate("document.querySelector('.discover-item-button').click()");
    await until("!!document.querySelector('dialog[open] a[href=\"/claims/headphones\"]')", 'Found item has no claim button');
    await evaluate("document.querySelector('dialog[open] a[href=\"/claims/headphones\"]').click()");
    await until("!!document.querySelector('.claim-form')", 'Claim proof page did not open');
    assert.equal(await evaluate("document.querySelector('.claim-item-summary h2').textContent"), 'Over-ear headphones');
    assert.equal(await evaluate("document.querySelectorAll('.claim-form textarea[required]').length"), 2);
    assert.equal(await evaluate("!!document.querySelector('.claim-confirmation input[required]')"), true);
    assert.equal(await evaluate("document.querySelector('.claim-preview-banner').textContent.includes('no claim')"), true);
    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 500 });
      await delay(150);
      assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true, 'Claim page overflows at ' + width);
    }
    await evaluate(`(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      for (const [name, value] of [['identifyingDetail', 'A small blue sticker underneath the left ear cup.'], ['circumstances', 'I last had it in the library yesterday afternoon.']]) {
        const input = document.querySelector('[name=' + name + ']'); setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('.claim-confirmation input').click();
    })()`);
    await delay(100);
    await evaluate("document.querySelector('.claim-form').requestSubmit()");
    await until("!!document.querySelector('.claim-success')", 'Preview did not finish');
    assert.equal(await evaluate("document.querySelector('.claim-success').textContent.includes('No claim or proof was saved or sent')"), true);
    assert.equal(posts.length, 0, 'Example proof must stay in the browser');
    await send('Page.navigate', { url: `${process.env.APP_URL || 'http://localhost:3000'}/discover?q=camera` });
    await until("document.readyState === 'complete' && !!document.querySelector('.discover-item-button')", 'Lost item did not load');
    await delay(1200);
    await evaluate("document.querySelector('.discover-item-button').click()");
    await until("!!document.querySelector('dialog[open]')", 'Lost item did not open');
    assert.equal(await evaluate("!!document.querySelector('dialog[open] a[href^=\"/claims/\"]')"), false, 'Lost items must not have claim buttons');
  } finally {
    socket?.close();
    browser.kill();
    await new Promise((resolve) => { if (browser.exitCode !== null) resolve(); else browser.once("exit", resolve); });
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
