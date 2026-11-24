import { seedPublishedReports, startAuthenticatedBrowserApp } from "./browser-auth-fixture.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

// Run after npm run build against an isolated account.
test("login, workspace navigation, posting modal, and sign-out work without retrying", { timeout: 90_000 }, async (context) => {
  const executable = [process.env.BROWSER_EXECUTABLE,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((path) => path && existsSync(path));
  assert.ok(executable, "Set BROWSER_EXECUTABLE to an installed Chromium browser.");
  const fixture = await startAuthenticatedBrowserApp(context, 3119);
  const { baseURL, credentials, grantAdmin } = fixture;
  const { found } = await seedPublishedReports(fixture);
  const reports = fixture.db.collection('reports');
  const privateMarker = 'discover-private-canary';
  const approved = crypto.randomUUID();
  const withheld = crypto.randomUUID();
  await reports.updateOne({ _id: found._id }, { $set: {
    verificationAnswer: privateMarker, attachments: [approved, withheld], approvedMedia: [approved],
  } });
  await fixture.db.collection('report_media').insertMany([approved, withheld].map(id => ({
    _id: id, ownerId: found.ownerId, reportId: found._id, resourceType: 'image', format: 'png', publicId: privateMarker,
  })));
  for (const overrides of [{ moderation: 'pending' }, { moderation: 'hidden' }, { organization: 'outside' }]) {
    await reports.insertOne({ ...found, ...overrides, _id: crypto.randomUUID(), title: privateMarker, location: privateMarker });
  }
  const cookie = fixture.cookies.map(({ name, value }) => name + '=' + value).join('; ');
  const response = await fetch(baseURL + '/discover', { headers: { cookie } });
  const payload = await response.text();
  assert.ok(payload.includes(found.title), 'Published item missing from rendered board');
  assert.ok(payload.includes(`/api/case-media/published/${found._id}/${approved}`), 'Approved media missing');
  assert.ok(!payload.includes(withheld), 'Unapproved media identifier entered the member response');
  assert.ok(!payload.includes(privateMarker), 'Private content entered the member response');
  assert.ok((await reports.indexes()).some(index => index.name === 'reports_publication_browse_v1'));
  const duplicates = Array.from({ length: 19 }, () => ({
    ...found, title: 'Pagination probe', _id: crypto.randomUUID(),
  })).sort((a, b) => a._id.localeCompare(b._id));
  await reports.insertMany(duplicates);
  for (const [sort, first, last] of [['az', duplicates[0], duplicates.at(-1)], ['za', duplicates.at(-1), duplicates[0]]]) {
    const path = '/discover?q=pagination&type=found&category=Electronics&location=Library&date=2025-04-10&sort=' + sort;
    const firstPage = await (await fetch(baseURL + path, { headers: { cookie } })).text();
    const lastPage = await (await fetch(baseURL + path + '&page=2', { headers: { cookie } })).text();
    assert.ok(firstPage.includes(first._id) && !firstPage.includes(last._id), 'Incorrect first page');
    assert.ok(lastPage.includes(last._id) && !lastPage.includes(first._id), 'Incorrect second page');
  }
  await reports.deleteMany({ title: { $in: [privateMarker, 'Pagination probe'] } });
  await reports.updateOne({ _id: found._id }, { $set: { approvedMedia: [] } });
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
    const appUrl = baseURL;
    await send("Page.navigate", { url: appUrl });
    await until("!!document.querySelector('a.header-cta')", "Landing posting link did not load");
    await evaluate("document.querySelector('a.header-cta').click()");
    await until("location.pathname === '/login' && !!document.querySelector('input[type=password]')", "Posting link did not open login");
    assert.equal(await evaluate("new URLSearchParams(location.search).get('next')"), "/discover?compose=1");
    assert.equal(await evaluate("!!document.querySelector('dialog[open]')"), false);

    for (const path of ["/discover", "/discover?compose=1", "/help", "/my-posts", "/claims", "/claims/backpack", "/admin"]) {
      await send("Page.navigate", { url: "about:blank" });
      await until("location.href === 'about:blank'", "Previous navigation did not clear");
      await send("Page.navigate", { url: appUrl + path });
      await until("location.pathname === '/login' && !!document.querySelector('input[type=password]')", `Signed-out access to ${path} did not redirect`);
    }
    await send("Page.navigate", { url: appUrl + "/login" });
    await until("document.readyState === 'complete' && !location.search && !!document.querySelector('.auth-panel button[type=submit]:enabled')", "Login form did not become interactive");
    for (const [name, value] of Object.entries(credentials)) {
      await evaluate(`document.querySelector('input[name=${name}]').focus()`);
      await send("Input.insertText", { text: value });
      assert.equal(await evaluate(`document.querySelector('input[name=${name}]').value.length`), value.length, `Could not enter ${name}`);
    }
    await evaluate("document.querySelector('.auth-panel button[type=submit]').click()");
    await until("location.pathname === '/discover' && document.readyState === 'complete' && !!document.querySelector('.discover-heading button')", "Login did not open Discover");
    await evaluate("window.workspaceSidebar = document.querySelector('.discover-sidebar'); window.workspaceDocument = true");
    for (const [path, content] of [["/my-posts", ".my-posts-empty"], ["/claims", ".claim-privacy"], ["/discover", ".discover-filters"]]) {
      await evaluate(`document.querySelector('.discover-desktop-nav a[href="${path}"]').click()`);
      await until(`location.pathname === '${path}' && !!document.querySelector('${content}')`, `Workspace link did not open ${path}`);
      assert.equal(await evaluate("window.workspaceDocument && window.workspaceSidebar.isConnected"), true, "Workspace navigation replaced the document or sidebar");
      for (const nav of [".discover-desktop-nav", ".discover-mobile-nav nav"]) {
        const activeLinks = await evaluate(`Array.from(document.querySelectorAll('${nav} a.is-active[aria-current="page"]')).filter(link => !link.closest('[hidden]')).map(link => link.getAttribute('href'))`);
        assert.deepEqual(activeLinks, [path], `Workspace active link did not follow navigation to ${path}`);
      }
    }
    await until("document.readyState === 'complete'", "Discover document did not finish loading");
    await delay(750);
    await evaluate("window.navigationTestMarker = true");
    await evaluate("document.querySelector('.discover-search input').value = 'camera'; document.querySelector('.discover-filters').requestSubmit()");
    await until("new URLSearchParams(location.search).get('q') === 'camera' && document.querySelectorAll('.discover-item').length === 1", "Discover search did not update");
    assert.equal(await evaluate("window.navigationTestMarker"), true, "Discover search reloaded the document");
    async function openModal() {
      await evaluate("document.querySelector('.discover-heading button').click()");
      await until("!!document.querySelector('dialog[open]')", "Post modal did not open");
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
    await evaluate("document.querySelector('dialog[open] .dialog-heading button').click()");
    await closed();
    assert.equal(await evaluate("!!document.querySelector('.discover-sidebar a[href=\"/admin\"]')"), false);
    await reports.updateOne({ _id: found._id }, { $set: { moderation: "pending" } });
    assert.equal(await grantAdmin(), true);
    await send("Page.navigate", { url: appUrl + "/discover" });
    await until("!!document.querySelector('.discover-desktop-nav a[href=\"/admin\"]')", "Admin link missing");
    await evaluate("document.querySelector('.discover-desktop-nav a[href=\"/admin\"]').click()");
    await until("location.pathname === '/admin' && document.querySelectorAll('.dashboard-queue .dashboard-count').length === 3 && !!document.querySelector('.dashboard-returns strong')", "Dashboard queue and return counts missing");
    await evaluate("window.adminSidebar = [...document.querySelectorAll('.discover-sidebar')].find(sidebar => sidebar.checkVisibility()); true");
    await evaluate("window.workspaceSidebar = window.adminSidebar; window.workspaceDocument = true");

    async function checkAdminNav(nav, path) {
      const selector = JSON.stringify(nav + ' a[href="' + path + '"][aria-current="page"].is-active');
      await until(`window.adminSidebar.querySelector(${selector})?.checkVisibility()`, `Active link missing for ${path}`);
      assert.equal(await evaluate("window.adminSidebar?.isConnected && window.adminSidebar.checkVisibility() && [...document.querySelectorAll('.discover-sidebar')].filter(sidebar => sidebar.checkVisibility()).length === 1"), true, "Admin sidebar was replaced");
      assert.equal(await evaluate(`window.adminSidebar.querySelectorAll('${nav} [aria-current="page"]').length`), 1);
      const links = await evaluate(`Array.from(window.adminSidebar.querySelectorAll('${nav} a[href^="/admin"]')).filter(link => {
        const icon = link.querySelector('svg');
        return icon?.checkVisibility() && icon.getBoundingClientRect().width > 0 && icon.getBoundingClientRect().height > 0;
      }).map(link => link.pathname)`);
      assert.deepEqual(links, ["/admin", "/admin/reports", "/admin/claims", "/admin/pickups"]);
      assert.equal(await evaluate("[...document.querySelectorAll('#admin-main')].filter(main => main.checkVisibility()).length"), 1);
    }

    const desktop = ".discover-desktop-nav";
    const mobile = ".discover-mobile-nav";
    await checkAdminNav(desktop, "/admin");
    for (const path of ["/admin/reports", "/admin/claims", "/admin/pickups"]) {
      await evaluate(`window.adminSidebar.querySelector('${desktop} a[href="${path}"]').click()`);
      await until(`location.pathname === '${path}' && !!document.querySelector('.case-pages')`, `Queue missing for ${path}`);
      await checkAdminNav(desktop, path);
      if (path === "/admin/reports") {
        const detail = path + "/" + found._id;
        await evaluate(`document.querySelector('.case-list a[href="${detail}"]').click()`);
        await until(`location.pathname === '${detail}' && !!document.querySelector('.case-status')`, "Report case missing");
        await checkAdminNav(desktop, path);
      }
    }
    for (const [path, content] of [["/discover", ".discover-filters"], ["/my-posts", ".my-posts-list, .my-posts-empty"], ["/claims", ".claim-list, .claim-privacy"], ["/admin", ".dashboard-queues"]]) {
      await evaluate(`window.workspaceSidebar.querySelector('${desktop} a[href="${path}"]').click()`);
      await until(`location.pathname === '${path}' && [...document.querySelectorAll('${content}')].some(element => element.checkVisibility())`, `Cross-section navigation did not open ${path}`);
      assert.equal(await evaluate("window.workspaceDocument && window.workspaceSidebar.isConnected && window.workspaceSidebar === [...document.querySelectorAll('.discover-sidebar')].find(sidebar => sidebar.checkVisibility())"), true, "Cross-section navigation replaced the document or sidebar");
      assert.equal(await evaluate("window.workspaceSidebar.querySelectorAll('.navigation-pending').length"), 0, "Sidebar still shows a navigation spinner");
    }
    await evaluate(`window.adminSidebar.querySelector('${desktop} a[href="/admin/pickups"]').click()`);
    await until("location.pathname === '/admin/pickups' && [...document.querySelectorAll('.case-main h1')].some(element => element.checkVisibility() && element.textContent === 'Reserved pickups')", "Pickups did not reopen");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate("window.adminSidebar.querySelector('.discover-mobile-nav summary').click()");
    await checkAdminNav(mobile, "/admin/pickups");
    await evaluate("window.adminSidebar.querySelector('.discover-mobile-nav a[href=\"/admin\"]').click()");
    await until("location.pathname === '/admin' && [...document.querySelectorAll('.dashboard-queues')].some(element => element.checkVisibility()) && !window.adminSidebar.querySelector('.discover-mobile-nav').open", "Mobile link did not return to the dashboard and dismiss the menu");
    await evaluate("window.adminSidebar.querySelector('.discover-mobile-nav summary').click()");
    await checkAdminNav(mobile, "/admin");
    await evaluate("window.adminSidebar.querySelector('.discover-mobile-nav .discover-sign-out button').click()");
    await until("location.pathname === '/login' && !location.search && !!document.querySelector('input[type=password]')", "Sign-out did not open login");
    await send("Page.navigate", { url: "about:blank" });
    await until("location.href === 'about:blank'", "Sign-out navigation did not clear");
    await send("Page.navigate", { url: appUrl + "/discover" });
    await until("location.pathname === '/login' && !!document.querySelector('input[type=password]')", "Discover was accessible after sign-out");
  } finally {
    socket?.close();
    browser.kill();
    await new Promise((resolve) => { if (browser.exitCode !== null) resolve(); else browser.once("exit", resolve); });
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
