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
