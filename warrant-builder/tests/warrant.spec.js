const { test, expect } = require("@playwright/test");

const TYPES = ["ping", "place", "blood", "records", "device", "tracker", "pen", "ramey"];
const SAMPLES = ["place", "blood", "bloodnight", "records", "device", "tracker", "pen", "ramey", "ping", "ping911"];
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function errorsOf(page) {
  const errors = [];
  page.on("console", function (msg) {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", function (err) { errors.push(String(err)); });
  return errors;
}

test.beforeEach(async function ({ page }) {
  await page.goto("/index.html");
  await page.evaluate(function () { localStorage.clear(); });
});

test("every type renders a Marin caption and the AI line is plain text", async function ({ page }) {
  const errors = await errorsOf(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/index.html");
  await expect(page.getByRole("button", { name: "No artificial intelligence." })).toBeVisible();
  const ai = page.locator("#aiToggle");
  await expect(ai).toHaveCSS("text-decoration-line", "none");
  for (const type of TYPES) {
    await page.locator("[data-type=\"" + type + "\"]").click();
    await expect(page.locator(".paper")).toContainText("COUNTY OF MARIN");
    await page.locator("#btnTypes").click();
  }
  expect(errors).toEqual([]);
});

test("same answers give the same text and fingerprint", async function ({ page }) {
  await page.goto("/index.html");
  const first = await page.evaluate(function () {
    window.__WB.loadSample("place");
    window.__WB.go("review");
    return {
      fp: window.__WB.fingerprint(),
      text: window.__WB.plainText("affidavit") + "\n" + window.__WB.plainText("warrant")
    };
  });
  expect(first.fp).toMatch(/^[0-9a-f]{8}$/);
  expect(first.text).toContain("Jordan Hale");
  expect(first.text).toContain("100 Sample Lane");
  expect(first.text).not.toContain("SOURCE NAME SAMPLE QUINN");
  await page.reload();
  const second = await page.evaluate(function () {
    window.__WB.loadSample("place");
    window.__WB.go("review");
    return {
      fp: window.__WB.fingerprint(),
      text: window.__WB.plainText("affidavit") + "\n" + window.__WB.plainText("warrant")
    };
  });
  expect(second).toEqual(first);
  const changed = await page.evaluate(function () {
    const before = window.__WB.fingerprint();
    window.__WB.setAnswer("facts", "A different invented training sentence.");
    return { before: before, after: window.__WB.fingerprint() };
  });
  expect(changed.after).not.toBe(changed.before);
});

test("hobbs facts stay in the sealed attachment", async function ({ page }) {
  await page.goto("/index.html");
  const texts = await page.evaluate(function () {
    window.__WB.loadSample("place");
    return {
      affidavit: window.__WB.plainText("affidavit"),
      warrant: window.__WB.plainText("warrant"),
      attachment: window.__WB.plainText("attachment")
    };
  });
  expect(texts.attachment).toContain("SOURCE NAME SAMPLE QUINN");
  expect(texts.attachment).toContain("NOT FOR SERVICE");
  expect(texts.affidavit).not.toContain("SOURCE NAME SAMPLE QUINN");
  expect(texts.warrant).not.toContain("SOURCE NAME SAMPLE QUINN");
});

test("after-signing entries do not change the fingerprint", async function ({ page }) {
  await page.goto("/index.html");
  await page.evaluate(function () {
    window.__WB.loadSample("place");
    window.__WB.go("after");
  });
  const before = await page.evaluate(function () { return window.__WB.fingerprint(); });
  const affidavit = await page.evaluate(function () { return window.__WB.plainText("affidavit"); });
  const count = await page.locator(".check-item input[type=checkbox]").count();
  for (let i = 0; i < count; i++) {
    await page.locator(".check-item input[type=checkbox]").nth(i).check();
  }
  await page.locator("[data-post=judgeName]").fill("Judge Training Sample");
  const after = await page.evaluate(function () {
    return { fp: window.__WB.fingerprint(), affidavit: window.__WB.plainText("affidavit") };
  });
  expect(after.fp).toBe(before);
  expect(after.affidavit).toBe(affidavit);
});

test("every checklist walks to Done with the strip in agreement", async function ({ page }) {
  test.setTimeout(120000);
  await page.goto("/index.html");
  for (const name of SAMPLES) {
    await page.evaluate(function (sample) {
      window.__WB.loadSample(sample);
      window.__WB.go("after");
    }, name);
    for (let guard = 0; guard < 40; guard++) {
      const strip = (await page.locator("#stripText").innerText()).trim();
      if (strip === "Done") {
        await expect(page.locator(".check-item.outlined")).toHaveCount(0);
        break;
      }
      const title = (await page.locator(".check-item.outlined .ctitle").innerText()).trim();
      expect(title, name + " step " + guard).toBe(strip);
      await page.locator(".check-item.outlined input[type=checkbox]").check();
      if (guard === 39) throw new Error(name + " did not finish");
    }
  }
});

test("deadline examples", async function ({ page }) {
  await page.goto("/index.html");
  const dates = await page.evaluate(function () {
    const d = window.__WB.dates;
    return {
      ping: d.courtDaysAfter("2026-11-20", 3),
      pingLong: d.longDate(d.courtDaysAfter("2026-11-20", 3)),
      friday: d.longDate("2026-11-20"),
      thanks: d.isHoliday("2026-11-26"),
      claytonShape: d.addCal("2026-07-15", 10),
      day10: d.executionDay("2026-11-02"),
      sundayIssue: d.executionDay("2026-11-12"),
      returnSunday: d.returnBy("2026-11-12"),
      biz: d.businessDaysAfter("2026-11-20", 5)
    };
  });
  expect(dates.friday).toContain("Friday");
  expect(dates.ping).toBe("2026-11-25");
  expect(dates.pingLong).toContain("Wednesday");
  expect(dates.pingLong).toContain("November 25, 2026");
  expect(dates.thanks).toBe(true);
  expect(dates.claytonShape).toBe("2026-07-25");
  expect(dates.day10).toBe("2026-11-12");
  expect(dates.sundayIssue).toBe("2026-11-22");
  expect(dates.returnSunday).toBe("2026-11-20");
  expect(dates.biz).toBe("2026-12-01");
  const warn = await page.evaluate(function () {
    window.__WB.loadSample("records");
    window.__WB.setPost("serveDate", "2026-11-13");
    window.__WB.setPost("magServeBy", "2026-11-06");
    return window.__WB.dateRows().map(function (r) { return r.label + " " + r.value; }).join("\n");
  });
  expect(warn).toContain("void");
  expect(warn).toContain("earlier than day 10");
});

test("word export produces zip files and embeds an exhibit", async function ({ page }) {
  await page.goto("/index.html");
  const result = await page.evaluate(async function (png) {
    window.__WB.loadSample("place");
    window.__WB.addExhibit(png, "Training photo");
    const one = await window.__WB.exportDocxB64("affidavit");
    const all = await window.__WB.exportZipB64();
    window.__WB.loadSample("ping");
    window.__WB.setPingTemplate("not-a-zip");
    const motion = await window.__WB.exportDocxB64("motion");
    const zip = await JSZip.loadAsync(Uint8Array.from(atob(one), function (c) { return c.charCodeAt(0); }));
    const names = Object.keys(zip.files);
    return {
      one: one.slice(0, 4),
      all: all.slice(0, 4),
      motion: motion.slice(0, 4),
      names: names,
      hasImage: names.some(function (n) { return n.indexOf("word/media/") === 0; }),
      hasText: (await zip.file("word/document.xml").async("string")).indexOf("Jordan Hale") >= 0
    };
  }, PNG);
  expect(result.one).toBe("UEsD");
  expect(result.all).toBe("UEsD");
  expect(result.motion).toBe("UEsD");
  expect(result.hasImage).toBe(true);
  expect(result.hasText).toBe(true);
});

test("no console errors at desktop and phone widths", async function ({ page }) {
  const errors = await errorsOf(page);
  for (const size of [{ width: 1280, height: 800 }, { width: 400, height: 800 }]) {
    await page.setViewportSize(size);
    await page.goto("/index.html");
    await page.locator("[data-type=place]").click();
    await page.evaluate(function () { window.__WB.loadSample("place"); window.__WB.go("review"); });
    if (size.width === 400) {
      await page.locator("#btnPane").click();
      const overflow = await page.evaluate(function () {
        return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
      });
      expect(overflow).toBe(true);
    }
    await expect(page.locator(".paper")).toContainText("SUPERIOR COURT");
  }
  expect(errors).toEqual([]);
});
