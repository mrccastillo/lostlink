import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { seedPublishedReports, startAuthenticatedBrowserApp } from "./browser-auth-fixture.mjs";

async function until(read, description) {
  const deadline = Date.now() + 15_000;
  do {
    const value = await read();
    if (value) return value;
    await delay(100);
  } while (Date.now() < deadline);
  assert.fail(`Timed out waiting for ${description}`);
}

async function startBrowser(context, baseURL) {
  const executable = [
    process.env.BROWSER_EXECUTABLE,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].find((file) => file && existsSync(file));
  assert.ok(executable, "Set BROWSER_EXECUTABLE to an installed Chromium browser.");
  const profile = await mkdtemp(join(tmpdir(), "lostlink-lifecycle-"));
  const browser = spawn(executable, ["--headless=new", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket;
  const exited = new Promise((resolve) => browser.once("close", resolve));
  context.after(async () => {
    socket?.close();
    browser.kill();
    await exited;
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  const port = await until(async () => {
    try { return (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }, "Chromium debugging endpoint");
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  assert.ok(response.ok);
  socket = new WebSocket((await response.json()).webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const reply = JSON.parse(data);
    const request = pending.get(reply.id);
    if (!request) return;
    pending.delete(reply.id);
    if (reply.error) request.reject(new Error(reply.error.message));
    else request.resolve(reply.result);
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(fn, ...args) {
    const result = await send("Runtime.evaluate", {
      expression: `(${fn})(...${JSON.stringify(args)})`, returnByValue: true,
    });
    assert.ok(!result.exceptionDetails, result.exceptionDetails?.exception?.description);
    return result.result.value;
  }
  async function visit(path, actor) {
    if (actor) {
      await send("Network.clearBrowserCookies");
      await send("Network.setCookies", { cookies: actor.cookies });
    }
    const url = baseURL + path;
    const navigation = await send("Page.navigate", { url });
    assert.ok(!navigation.errorText, navigation.errorText);
    await until(() => evaluate((target) => location.href === target && document.readyState === "complete", url), path);
  }
  function viewport(width) {
    return send("Emulation.setDeviceMetricsOverride", {
      width, height: 850, deviceScaleFactor: 1, mobile: width < 600,
    });
  }
  return { evaluate, visit, viewport };
}

// These functions run in the page. Use labeled form controls and trigger their native events.
function submitFields(formSelector, values, choices) {
  const form = document.querySelector(formSelector);
  if (!form) return false;
  for (const selector of choices) form.querySelector(selector).click();
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value").set;
    setter.call(field, value);
    field.dispatchEvent(new Event(field.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  }
  if (!form.reportValidity()) throw new Error("The lifecycle form failed native validation");
  form.querySelector('button[type="submit"]').click();
  return true;
}

test("members and staff take a found report from submission through physical pickup", { timeout: 180_000 }, async (context) => {
  const fixture = await startAuthenticatedBrowserApp(context, 3123);
  const finder = await fixture.createMember("Lifecycle Finder", "finder@example.test");
  const claimant = await fixture.createMember("Lifecycle Claimant", "claimant@example.test");
  await fixture.grantAdmin();
  const { db } = fixture;
  const { visit, evaluate, viewport } = await startBrowser(context, fixture.baseURL);
  const title = "Indigo library satchel";
  const proof = "A tiny embroidered moon is inside the zip pocket.";
  const circumstances = "I left it beside the library printer on Friday.";
  const reports = db.collection("reports");
  const claims = db.collection("claims");

  await visit("/discover?compose=1", finder);
  await until(() => evaluate(submitFields, "dialog[open] form:has([name=title])", {
    title, category: "Bags & accessories", location: "Library", occurredOn: "2025-01-10",
    description: "An indigo satchel was found beside the printer.",
  }, ['input[name=type][value=found]']), "report submission form");
  const report = await until(() => reports.findOne({ title }), "submitted report");
  assert.equal(report.type, "found");
  assert.equal(report.moderation, "pending");
  assert.equal(report.lifecycle, "open");
  const searchPath = `/discover?q=${encodeURIComponent(title)}`;
  await visit(searchPath, claimant);
  await until(() => evaluate(() => Array.from(document.querySelectorAll("main h2"))
    .some(heading => heading.innerText === "No items found")), "pending report excluded from Discover");

  async function openQueueCase(queue, id, mobile = false) {
    const queuePath = `/admin/${queue}`;
    const casePath = `${queuePath}/${id}`;
    await viewport(mobile ? 390 : 1280);
    await visit("/discover", fixture);
    if (mobile) {
      await until(() => evaluate(() => {
        const summary = document.querySelector("aside details > summary");
        if (!summary?.getClientRects().length) return false;
        summary.click();
        return true;
      }), "mobile navigation disclosure");
    }
    const label = mobile ? "Mobile workspace navigation" : "Workspace navigation";
    await until(() => evaluate((label, path) => {
      const nav = document.querySelector(`nav[aria-label="${label}"]`);
      const link = nav?.querySelector(`a[href="${path}"]`);
      if (!link?.getClientRects().length) return false;
      link.click();
      return true;
    }, label, queuePath), `${label} link to ${queue}`);
    await until(() => evaluate((label, path) => {
      const nav = document.querySelector(`nav[aria-label="${label}"]`);
      return location.pathname === path && !!nav?.querySelector(`a[href="${path}"][aria-current="page"]`);
    }, label, queuePath), `active ${queue} navigation link`);
    await until(() => evaluate((path, title) => {
      const link = document.querySelector(`main a[href="${path}"]`);
      if (link?.textContent.trim() !== title) return false;
      link.click();
      return true;
    }, casePath, title), `${queue} queue entry for ${title}`);
    await until(() => evaluate((path) => location.pathname === path, casePath), casePath);
  }

  async function selectDecision(action, entityId) {
    await until(() => evaluate((action, entityId) => {
      const trigger = document.querySelector(`button[data-decision="${action}"]`);
      if (trigger && location.pathname.endsWith("/" + entityId)) {
        trigger.click();
        return true;
      }
      const radio = document.querySelector(`input[type="radio"][name="action"][value="${action}"]`);
      if (!radio || radio.form.elements.entityId.value !== entityId) return false;
      radio.click();
      return true;
    }, action, entityId), `${action} decision`);
  }
  async function confirmDecision(reason, choices = []) {
    await until(() => evaluate(submitFields, "form:has([name=reason]):has(button[type=submit]:enabled)", { reason }, choices),
      "enabled decision confirmation");
  }

  const reportPath = `/admin/reports/${report._id}`;
  await openQueueCase("reports", report._id);
  await selectDecision("hide", report._id);
  await until(() => evaluate(() => {
    const dialog = document.querySelector("dialog[open]");
    if (!dialog?.querySelector("textarea:required")) return false;
    dialog.querySelector('button[aria-label="Close dialog"]').click();
    return true;
  }), "dismiss hide report confirmation");
  assert.equal((await reports.findOne({ _id: report._id })).moderation, "pending");
  await selectDecision("publish", report._id);
  await until(() => evaluate(() => !!document.querySelector("dialog[open] textarea")), "publish confirmation dialog");
  await confirmDecision("Public details reviewed.");
  await until(() => reports.findOne({ _id: report._id, moderation: "published", lifecycle: "open" }), "published report");

  const claimPath = `/claims/${report._id}`;
  await visit(searchPath, claimant);
  await until(() => evaluate((title) => {
    if (document.querySelector("dialog[open]")) return true;
    const item = document.querySelector(`button[aria-label="View item: ${title}"]`);
    item?.click();
    return false;
  }, title), "published item details in live Discover");
  await until(() => evaluate((path) => {
    const link = document.querySelector(`dialog[open] a[href="${path}"]`);
    if (!link) return false;
    link.click();
    return true;
  }, claimPath), "claim link for the published item");
  await until(() => evaluate(submitFields, "form:has([name=identifyingDetail])", {
    identifyingDetail: proof, circumstances,
  }, ["input[name=confirmed]"]), "private proof form");
  const claim = await until(() => claims.findOne({ reportId: report._id }), "submitted claim");
  assert.equal(claim.status, "pending");
  assert.notEqual(claim.claimantId, report.ownerId);
  assert.equal((await reports.findOne({ _id: report._id })).lifecycle, "open");

  async function expectClaimStatus(status) {
    await visit("/claims", claimant);
    await until(() => evaluate((path, status) =>
      document.querySelector(`main a[href="${path}"]`)?.innerText.toLowerCase().includes(status),
    claimPath, status), `claimant's ${status} status`);
  }
  await expectClaimStatus("pending");
  await openQueueCase("claims", claim._id, true);
  await until(() => evaluate((proof, circumstances) =>
    [proof, circumstances].every((answer) => document.querySelector("main")?.innerText.includes(answer)),
  proof, circumstances), "private answers in staff review");
  await selectDecision("approve", claim._id);
  const draft = "Both identifying details match. ".repeat(50);
  // Exercise the server limit even when the current browser also enforces maxlength.
  await until(() => evaluate(() => {
    const field = document.querySelector("textarea[name=reason]");
    if (!field) return false;
    field.removeAttribute("maxlength");
    return true;
  }), "editable decision reason");
  await confirmDecision(draft);
  await until(() => evaluate((draft) => {
    const field = document.querySelector("textarea[name=reason]");
    return field?.value === draft && !field.matches(":disabled")
      && /1,500/.test(field.closest("section").querySelector('[role="status"]')?.innerText);
  }, draft), "server validation message and retained approval draft");
  assert.equal((await claims.findOne({ _id: claim._id })).status, "pending");
  assert.equal((await reports.findOne({ _id: report._id })).lifecycle, "open");
  await confirmDecision("Both identifying details match.");
  await until(() => claims.findOne({ _id: claim._id, status: "approved" }), "approved claim");
  const reserved = await reports.findOne({ _id: report._id });
  assert.equal(reserved.lifecycle, "reserved");
  assert.equal(reserved.reservedClaimId, claim._id);
  assert.equal(await db.collection("return_events").countDocuments({ claimId: claim._id }), 0);
  await expectClaimStatus("approved");

  await openQueueCase("pickups", claim._id);
  await selectDecision("handoff", claim._id);
  await confirmDecision("Staff witnessed the physical pickup.", ['input[name="handoffConfirmed"]']);
  await until(() => claims.findOne({ _id: claim._id, status: "fulfilled" }), "fulfilled claim");
  assert.equal((await reports.findOne({ _id: report._id })).lifecycle, "returned");
  const returns = await db.collection("return_events").find({ claimId: claim._id }).toArray();
  assert.equal(returns.length, 1);
  const staff = await db.collection("user").findOne({ email: fixture.credentials.email });
  assert.equal(returns[0].actorId, String(staff._id));
  assert.equal(returns[0].claimantId, claim.claimantId);
  assert.equal(returns[0].reportId, report._id);
  assert.ok(returns[0].createdAt instanceof Date);
  await expectClaimStatus("fulfilled");

  await visit("/my-posts", finder);
  await until(() => evaluate((title) => {
    const post = Array.from(document.querySelectorAll("article")).find(item => item.querySelector("h2")?.innerText === title);
    if (!post) return false;
    if (!post.querySelector("details").open) post.querySelector("summary").click();
    const itemStatus = Array.from(post.querySelectorAll("dt")).find(label => label.innerText === "Item status");
    return post.innerText.includes("Published") && itemStatus?.nextElementSibling?.innerText.trim().toLowerCase() === "returned";
  }, title), "returned item in the finder's My Posts");

  await visit(reportPath, fixture);
  await until(() => evaluate(() => !!document.querySelector(".report-review")), "report details");
  assert.equal(await evaluate(() => !!document.querySelector("#history")), false);
  const events = await db.collection("audit_events").find({
    organization: "community", entityId: { $in: [report._id, claim._id] },
  }).sort({ createdAt: 1, _id: 1 }).toArray();
  assert.deepEqual(events.map(({ action, actorId }) => [action, actorId]), [
    ["report.submitted", report.ownerId], ["report.published", String(staff._id)],
    ["claim.submitted", claim.claimantId], ["claim.approved", String(staff._id)],
    ["claim.fulfilled", String(staff._id)],
  ]);
  for (const answer of [proof, circumstances]) assert.ok(!JSON.stringify(events).includes(answer), "Audit history leaked private proof");
});

test("finder submission links staff and the lost owner to the same response", { timeout: 150_000 }, async (context) => {
  const fixture = await startAuthenticatedBrowserApp(context, 3123);
  await fixture.grantAdmin();
  const { lost, author: owner } = await seedPublishedReports(fixture);
  const reports = fixture.db.collection("reports");
  const finder = await fixture.createMember("Camera Finder", "camera-finder@example.test");
  const { visit, evaluate } = await startBrowser(context, fixture.baseURL);
  await visit("/discover", finder);
  await until(() => evaluate((title) => {
    const trigger = document.querySelector(`button[aria-label="View item: ${title}"]`);
    if (!trigger) return false;
    trigger.click();
    return true;
  }, lost.title), "lost post");
  await until(() => evaluate(() => {
    const trigger = [...document.querySelectorAll("dialog[open] button")].find(el => el.textContent === "I found this item");
    if (!trigger) return false;
    trigger.click();
    return true;
  }), "finder response button");
  await until(() => evaluate(submitFields, "dialog[open] form:has([name=respondingTo])", {
    location: "Library", occurredOn: "2025-04-12", description: "Found the compact camera by the printer.",
  }, []), "finder submission");
  const response = await until(() => reports.findOne({ respondingTo: lost._id }), "linked report");
  await visit("/admin/reports", fixture);
  await until(() => evaluate((id) => document.querySelector(`a[href="/admin/reports/${id}"]`)?.closest("li")?.textContent.includes("Finder response"), response._id), "staff queue label");
  await visit("/admin/reports/" + response._id, fixture);
  await until(() => evaluate((id) => {
    if (!document.querySelector(`main a[href="/admin/reports/${id}"]`)) return false;
    const trigger = document.querySelector('button[data-decision="publish"]');
    trigger?.click();
    return !!trigger;
  }, lost._id), "original post link in staff review");
  await until(() => evaluate(submitFields, "dialog[open] form:has([name=reason])", {}, []), "publish confirmation");
  await until(() => reports.findOne({ _id: response._id, moderation: "published" }), "published finder response");
  await visit("/discover", owner);
  await until(() => evaluate(() => {
    const link = document.querySelector(".finder-alerts a");
    link?.click();
    return !!link;
  }), "owner follows finder notice");
  await until(() => evaluate((id) => document.querySelector(`#response-${id}`)?.textContent.includes("Found the compact camera"), response._id), "linked finder description");
  await until(() => evaluate(() => {
    const button = document.querySelector(".finder-alerts button");
    button?.click();
    return !!button;
  }), "mark notice as read");
  await until(() => reports.findOne({ _id: response._id, unreadFor: { $exists: false } }), "acknowledged notice");
});
