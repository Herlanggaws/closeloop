import assert from "node:assert/strict";
import { describe, it } from "node:test";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";
import { LANDING_FAQ_ITEMS } from "./landing-faq.ts";
import { MARKETING_PATHS, SITE_URL } from "./site.ts";

describe("site SEO helpers", () => {
  it("uses the public saidloop.com origin", () => {
    assert.equal(SITE_URL, "https://saidloop.com");
  });

  it("lists core marketing paths for the sitemap", () => {
    assert.ok(MARKETING_PATHS.includes("/"));
    assert.ok(MARKETING_PATHS.includes("/docs"));
    assert.ok(MARKETING_PATHS.includes("/privacy"));
  });

  it("builds robots with sitemap and private disallow rules", () => {
    const result = robots();
    assert.equal(result.sitemap, "https://saidloop.com/sitemap.xml");
    assert.equal(result.host, "https://saidloop.com");
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    assert.ok(rule);
    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    for (const path of ["/app/", "/preview/", "/design-system", "/auth/", "/invite/"]) {
      assert.ok(disallow.includes(path), `expected disallow ${path}`);
    }
  });

  it("builds an absolute sitemap for marketing routes", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    assert.ok(urls.includes("https://saidloop.com"));
    assert.ok(urls.includes("https://saidloop.com/docs/web-widget"));
    assert.equal(
      urls.some((url) => url.includes("/app/")),
      false,
    );
  });

  it("keeps FAQ copy for FAQPage structured data", () => {
    assert.ok(LANDING_FAQ_ITEMS.length >= 3);
    for (const item of LANDING_FAQ_ITEMS) {
      assert.ok(item.question.length > 0);
      assert.ok(item.answer.length > 0);
    }
  });
});
