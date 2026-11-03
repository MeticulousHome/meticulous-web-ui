const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const phase = process.argv[2] || "before";
  assert(["before", "after"].includes(phase), "Phase must be before or after");
  const appUrl = new URL(process.argv[3] || process.env.APP_URL);
  assert(
    ["http:", "https:"].includes(appUrl.protocol),
    "APP_URL must use HTTP or HTTPS",
  );
  appUrl.searchParams.set("machine", "http://usb-mode-fixture.test");
  appUrl.hash = "/settings/system";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    hasTouch: true,
    colorScheme: "light",
  });
  const page = await context.newPage();
  const writes = [];
  let settings = {
    usb_mode: "host",
    debug_shot_data_retention_days: 7,
    update_channel: "beta",
    timezone_sync: false,
    time_zone: "America/Mexico_City",
    ssh_enabled: false,
    report_contact_mail: "",
    hostname_override: null,
    telemetry_service_enabled: true,
  };
  await page.route("http://usb-mode-fixture.test/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
          "access-control-allow-headers": "*",
        },
      });
    if (req.method() !== "GET") {
      const body = req.postDataJSON();
      writes.push(body);
      settings = { ...settings, ...body };
    }
    const body = req.url().includes("settings") ? settings : {};
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*" },
      json: body,
    });
  });
  await page.goto(appUrl.href);
  const usb = page.getByLabel("USB mode", { exact: true });
  await usb.waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await usb.inputValue(), "host");
  assert.equal(
    await usb.locator("option:checked").innerText(),
    "Host (drives, accessories)",
  );
  if (phase === "before") {
    assert.equal(await usb.isEnabled(), true);
    await page.screenshot({ path: path.join(__dirname, "before.png") });
    await usb.selectOption("client");
    await page.waitForTimeout(250);
    assert(writes.some((x) => x.usb_mode === "client"));
  } else {
    assert.equal(await usb.isDisabled(), true);
    assert.equal(
      await usb.evaluate((el) => getComputedStyle(el).opacity),
      "0.5",
    );
    await page.screenshot({ path: path.join(__dirname, "after.png") });
    const box = await usb.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await usb.evaluate((el) => el.focus());
    assert.equal(
      await usb.evaluate((el) => el === document.activeElement),
      false,
    );
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    assert.equal(await usb.inputValue(), "host");
    assert.equal(writes.length, 0);
    const ssh = page.getByRole("switch", { name: "SSH", exact: true });
    await ssh.focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .getByLabel("Report contact email", { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await ssh.click();
    await page
      .getByLabel("Report contact email", { exact: true })
      .fill("ui-check@example.test");
    await page.getByLabel("Report contact email", { exact: true }).press("Tab");
    await page
      .getByLabel("Update channel", { exact: true })
      .selectOption("stable");
    await page.waitForTimeout(250);
    assert(writes.some((x) => x.ssh_enabled === true));
    assert(
      writes.some((x) => x.report_contact_mail === "ui-check@example.test"),
    );
    assert(writes.some((x) => x.update_channel === "stable"));
    assert(!writes.some((x) => "usb_mode" in x));
    for (const value of ["client", "dual_role", "future_mode"]) {
      settings.usb_mode = value;
      await page.reload();
      await usb.waitFor();
      await page
        .waitForFunction(
          (v) => document.querySelector("select:disabled")?.value === v,
          value,
        )
        .catch(() => {});
      assert.equal(await usb.inputValue(), value);
      assert.equal(await usb.isDisabled(), true);
    }
    delete settings.usb_mode;
    await page.reload();
    await page.getByLabel("Report contact email", { exact: true }).waitFor();
    assert.equal(await usb.count(), 0);
  }
  console.log(JSON.stringify({ phase, passed: true, writes }));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
