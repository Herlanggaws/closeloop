import { test, expect, type Page } from "@playwright/test";

// S-15 Billing with the API mocked: needs only the web app.

type Setup = {
  plan?: string;
  role?: string;
  subscribed?: boolean;
  configured?: boolean;
  endsAt?: string;
  query?: string;
};

async function openBilling(page: Page, setup: Setup = {}) {
  const { plan = "free", role = "owner", subscribed = false, configured = true, endsAt, query = "" } = setup;
  const posts: { path: string; body: unknown }[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("closeloop_access", "e2e-token");
    localStorage.setItem("closeloop_project", "e2e-project");
    localStorage.setItem(
      "saidloop.tours.v1.e2e-user",
      JSON.stringify({ seen: [], disabled: true }),
    );
  });
  await page.route(/^https:\/\/billing\.test\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Hosted page</h1>" }),
  );
  await page.route(/^https?:\/\/[^/]+\/api\//, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const cors = {
      "Access-Control-Allow-Origin": request.headers()["origin"] || "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    };
    const json = (status: number, body: object) =>
      route.fulfill({ status, headers: cors, json: body });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (path.startsWith("/api/billing/")) {
      posts.push({ path, body: request.postDataJSON() });
      return configured
        ? json(200, { url: `https://billing.test/hosted/${path.split("/").pop()}` })
        : json(503, {
            error: { code: "BILLING_NOT_CONFIGURED", message: "Billing not configured on this server." },
          });
    }
    if (path === "/api/me") {
      return json(200, {
        user: { id: "e2e-user", email: "owner@example.com", name: "Owner" },
        org: { id: "e2e-org", name: "Workspace", plan },
        role,
        usage: {
          plan,
          subscribed,
          billing_ends_at: endsAt,
          projects: { used: 1, limit: 3 },
          reports: { used: 4, limit: 1000 },
          seats: { used: 1, limit: 2 },
          period_start: "2026-11-01T00:00:00Z",
        },
      });
    }
    if (path === "/api/projects/e2e-project") {
      return json(200, { project: { id: "e2e-project", name: "Demo" } });
    }
    if (path === "/api/projects") {
      return json(200, { projects: [{ id: "e2e-project", name: "Demo" }] });
    }
    return json(200, {});
  });
  await page.goto(`/app/settings/billing${query}`);
  await expect(page.getByTestId("change-plan-grid")).toBeVisible();
  return posts;
}

test.describe("Billing", () => {
  test("yearly upgrade opens checkout", async ({ page }) => {
    const posts = await openBilling(page);
    await page.getByRole("button", { name: /Yearly/ }).click();
    await expect(page.locator('[data-plan="indie"]')).toContainText("$150 / year");
    await page.locator('[data-plan="indie"]').click();
    await expect(page).toHaveURL("https://billing.test/hosted/checkout");
    expect(posts).toEqual([
      { path: "/api/billing/checkout", body: { plan: "indie", interval: "year" } },
    ]);
  });

  test("monthly is the default", async ({ page }) => {
    const posts = await openBilling(page);
    await expect(page.locator('[data-plan="studio"]')).toContainText("$39");
    await page.locator('[data-plan="studio"]').click();
    await expect(page).toHaveURL("https://billing.test/hosted/checkout");
    expect(posts[0].body).toEqual({ plan: "studio", interval: "month" });
  });

  test("free plan explains checkout", async ({ page }) => {
    await openBilling(page);
    await expect(page.getByText("Upgrading opens a secure checkout. Cancel anytime from this page.")).toBeVisible();
    await expect(page.getByText("Not billed", { exact: true })).toHaveCount(0);
  });

  test("an unbilled paid plan says so", async ({ page }) => {
    await openBilling(page, { plan: "indie" });
    await expect(page.getByText("Not billed", { exact: true })).toBeVisible();
    await expect(page.getByText("Your Indie plan was set up without a subscription, so nothing is billed.")).toBeVisible();
  });

  test("a subscriber changes plans in the portal", async ({ page }) => {
    const posts = await openBilling(page, { plan: "indie", subscribed: true });
    await expect(page.getByRole("button", { name: "Manage subscription" })).toBeVisible();
    await expect(page.getByText("Not billed", { exact: true })).toHaveCount(0);
    await page.locator('[data-plan="studio"]').click();
    await expect(page).toHaveURL("https://billing.test/hosted/portal");
    expect(posts.map((p) => p.path)).toEqual(["/api/billing/portal"]);
  });

  test("a canceled plan shows when it ends", async ({ page }) => {
    await openBilling(page, { plan: "studio", subscribed: true, endsAt: "2026-12-22T14:27:02Z" });
    await expect(
      page.getByText("Ends on Dec 22, 2026. Then this workspace moves to Free."),
    ).toBeVisible();
    await expect(page.locator('[data-plan="free"]')).toBeDisabled();
    await expect(page.getByText("Cancel subscription")).toHaveCount(0);
  });

  test("after checkout, plans lock until the webhook lands, then the page updates", async ({
    page,
  }) => {
    const setup: Setup = { query: "?checkout=success" };
    await openBilling(page, setup);
    await expect(page.getByRole("status")).toHaveText(
      "Payment received. Your plan updates in a moment.",
    );
    await expect(page.locator('[data-plan="indie"]')).toBeDisabled();

    await page.unrouteAll({ behavior: "wait" });
    await page.route(/\/api\/me/, (route) =>
      route.fulfill({
        headers: {
          "Access-Control-Allow-Origin": route.request().headers()["origin"] || "*",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
        json: {
          user: { id: "e2e-user", email: "owner@example.com" },
          org: { id: "e2e-org", name: "Workspace", plan: "indie" },
          role: "owner",
          usage: {
            plan: "indie",
            subscribed: true,
            billing_interval: "year",
            projects: { used: 1, limit: 3 },
            reports: { used: 4, limit: 1000 },
            period_start: "2026-11-01T00:00:00Z",
          },
        },
      }),
    );
    await expect(page.getByRole("status")).toHaveText("You're subscribed.");
    await expect(page.getByText("$150 / year")).toBeVisible();
    // Otherwise a refresh after the subscription ends would claim a new payment and lock the cards.
    await expect(page).toHaveURL(/\/app\/settings\/billing$/);
  });

  test("says so when payment confirmation does not arrive", async ({ page }) => {
    await page.clock.install();
    await openBilling(page, { query: "?checkout=success" });
    await expect(page.getByRole("status")).toHaveText(
      "Payment received. Your plan updates in a moment.",
    );
    await page.clock.runFor(32_000);
    await expect(page.getByRole("status")).toContainText(
      "We haven't received your payment confirmation yet. Don't pay again.",
    );
    await expect(page.getByRole("link", { name: "contact support" })).toHaveAttribute(
      "href",
      "/contact",
    );
    await expect(page.locator('[data-plan="indie"]')).toBeDisabled();
  });

  test("members cannot change the plan", async ({ page }) => {
    await openBilling(page, { role: "member" });
    await expect(page.locator('[data-plan="indie"]')).toBeDisabled();
    await expect(page.getByText("Only the workspace owner can change the plan.")).toBeVisible();
  });

  test("shows when billing is not configured, without naming the provider", async ({ page }) => {
    await openBilling(page, { configured: false });
    await page.locator('[data-plan="indie"]').click();
    await expect(page.getByText("Billing not configured on this server.")).toBeVisible();
    await expect(page.getByText(/polar/i)).toHaveCount(0);
  });
});
