import { test, expect } from "@playwright/test";

const PAGES: { path: string; heading: string | RegExp }[] = [
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/terms", heading: "Terms of Service" },
  { path: "/docs", heading: "Docs" },
  { path: "/docs/web-widget", heading: "Web widget" },
  { path: "/dpa", heading: "Data Processing Addendum" },
  { path: "/about", heading: "About Saidloop" },
  { path: "/contact", heading: "Contact" },
  { path: "/changelog", heading: "Changelog" },
];

test.describe("Marketing pages smoke", () => {
  for (const pageDef of PAGES) {
    test(`${pageDef.path} renders expected heading`, async ({ page }) => {
      const response = await page.goto(pageDef.path);
      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1, name: pageDef.heading })).toBeVisible();
    });
  }

  test("landing footer links to privacy and docs", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("#footer");
    await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await expect(footer.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    await expect(footer.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/#how",
    );
  });

  test("landing add-on credits copy wraps inside the card", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#pricing");
    const addon = page.locator('[data-pencil-name="Add-on"]');
    const desc = addon.locator('[data-pencil-name="D"]');

    await expect(desc).toBeVisible();
    const overflow = await desc.evaluate((el) => {
      const card = el.closest('[data-pencil-name="Add-on"]');
      if (!(card instanceof HTMLElement)) return true;
      return el.scrollWidth > card.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test("landing billing toggle switches yearly prices", async ({ page }) => {
    await page.goto("/#pricing");
    const pricing = page.locator("#pricing");
    const yearly = pricing.getByRole("button", { name: /Yearly/ });
    const monthly = pricing.getByRole("button", { name: "Monthly" });

    await expect(pricing.getByText("$12", { exact: true })).toBeVisible();
    await expect(yearly).toHaveAttribute("aria-pressed", "false");

    await yearly.click();
    await expect(yearly).toHaveAttribute("aria-pressed", "true");
    await expect(pricing.getByText("$10", { exact: true })).toBeVisible();
    await expect(pricing.getByText("$33", { exact: true })).toBeVisible();
    await expect(pricing.getByText("$124", { exact: true })).toBeVisible();

    await monthly.click();
    await expect(monthly).toHaveAttribute("aria-pressed", "true");
    await expect(pricing.getByText("$12", { exact: true })).toBeVisible();
    await expect(pricing.getByText("$39", { exact: true })).toBeVisible();
  });

  test("landing exposes crawlable SEO signals", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Users report it\. Your AI fixes it\./,
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /One loop,/ })).toBeVisible();

    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(3);
    const payloads = await jsonLd.allTextContents();
    expect(payloads.some((text) => text.includes('"FAQPage"'))).toBeTruthy();
    expect(payloads.some((text) => text.includes('"SoftwareApplication"'))).toBeTruthy();

    const robots = await page.request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("Sitemap: https://saidloop.com/sitemap.xml");
    expect(robotsBody).toContain("Disallow: /app/");

    const sitemap = await page.request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    const sitemapBody = await sitemap.text();
    expect(sitemapBody).toContain("https://saidloop.com</loc>");
    expect(sitemapBody).toContain("https://saidloop.com/docs</loc>");
  });
});
