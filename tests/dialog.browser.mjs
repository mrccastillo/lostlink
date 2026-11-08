import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

// Run against `npm run dev`: Strict Mode's effect replay triggers this regression.
test("posting modal stays open and supports dismissing and reopening", { timeout: 90_000 }, async () => {
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
    await send("Page.navigate", { url: `${process.env.APP_URL || "http://localhost:3000"}/discover?q=camera` });
    await until("document.readyState === 'complete' && !!document.querySelector('.discover-heading button')", "Discover did not load");
    await delay(1500);
    async function openModal() {
      await evaluate("document.querySelector('.discover-heading button').click()");
      await until("!!document.querySelector('dialog[open]')", "Post modal did not open");
      // The old bug closes it immediately after Strict Mode replays effects.
      await delay(1000);
      assert.equal(await evaluate("!!document.querySelector('dialog[open]')"), true, "Post modal blinked closed");
      assert.equal(await evaluate("new URLSearchParams(location.search).get('q')"), "camera");
      assert.equal(await evaluate("new URLSearchParams(location.search).get('compose')"), "1");
      assert.equal(await evaluate("(() => { const dialog = document.querySelector('dialog[open]'); return dialog.scrollWidth <= dialog.clientWidth; })()"), true, "Modal must not overflow horizontally");
    }
    async function closed() {
      await until("!document.querySelector('dialog[open]') && !new URLSearchParams(location.search).has('compose')", "Modal did not dismiss");
      assert.equal(await evaluate("new URLSearchParams(location.search).get('q')"), "camera");
    }
    await openModal();
    await evaluate("document.querySelector('dialog[open] .dialog-heading button').click()");
    await closed();
    await openModal();
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await closed();
    await openModal();
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 1, y: 1, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1, y: 1, button: "left", clickCount: 1 });
    await closed();
    await openModal();
    await evaluate("history.back()");
    await closed();
    await evaluate("history.forward()");
    await until("!!document.querySelector('dialog[open]')", "Forward navigation did not reopen modal");
    await delay(1000);
    assert.equal(await evaluate("!!document.querySelector('dialog[open]')"), true);
  } finally {
    socket?.close();
    browser.kill();
    await new Promise((resolve) => { if (browser.exitCode !== null) resolve(); else browser.once("exit", resolve); });
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
