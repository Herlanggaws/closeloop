import { type APIRequestContext, type Page, expect } from "@playwright/test";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type SeededSession = {
  email: string;
  userId: string;
  accessToken: string;
  projectId: string;
  publicKey: string;
  projectName: string;
};

function uniq(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function seedSession(
  request: APIRequestContext,
  opts: { plan?: "free" | "indie" | "studio" } = {},
): Promise<SeededSession> {
  const email = `${uniq("ui")}@test.closeloop`;
  const password = "test-test-test";
  const projectName = `UI Report ${uniq("p")}`;

  const register = await request.post(`${API_URL}/api/auth/register`, {
    data: { name: "UI Tester", email, password },
  });
  expect(register.ok(), await register.text()).toBeTruthy();
  const regBody = await register.json();
  const accessToken = regBody.access_token as string;
  const userId = (regBody.user?.id as string) || "";
  expect(accessToken).toBeTruthy();

  if (opts.plan && opts.plan !== "free") {
    const plan = await request.patch(`${API_URL}/api/org/plan`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { plan: opts.plan },
    });
    expect(plan.ok(), await plan.text()).toBeTruthy();
  }

  const project = await request.post(`${API_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name: projectName, platforms: ["web"] },
  });
  expect(project.ok(), await project.text()).toBeTruthy();
  const projBody = await project.json();
  const projectId = projBody.project.id as string;
  const publicKey = projBody.public_key as string;
  expect(projectId && publicKey).toBeTruthy();

  return { email, userId, accessToken, projectId, publicKey, projectName };
}

export async function ingestReport(
  request: APIRequestContext,
  publicKey: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  const res = await request.post(`${API_URL}/v1/ingest/reports`, {
    headers: {
      "Content-Type": "application/json",
      "X-Closeloop-Key": publicKey,
    },
    data: {
      type: "bug",
      message,
      platform: "web",
      email: "rina@example.com",
      user_id: "rina",
      context: { url: "/e2e", browser: "Playwright" },
      ...extra,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json() as Promise<{ ticket_id: string; report_id: string }>;
}

export async function applySession(
  page: Page,
  session: SeededSession,
  opts: { tours?: boolean } = {},
) {
  await page.addInitScript(
    ({ accessToken, projectId, publicKey, tourKeys }) => {
      localStorage.setItem("closeloop_access", accessToken);
      localStorage.setItem("closeloop_project", projectId);
      localStorage.setItem("closeloop_public_key", publicKey);
      // Coach-mark tours cover the filters and buttons these tests click; keep them off.
      for (const key of tourKeys) {
        localStorage.setItem(key, JSON.stringify({ seen: [], disabled: true }));
      }
    },
    {
      accessToken: session.accessToken,
      projectId: session.projectId,
      publicKey: session.publicKey,
      // Tours stay off unless a test is about tours.
      tourKeys: opts.tours ? [] : [session.userId, session.email]
        .filter(Boolean)
        .map((id) => `saidloop.tours.v1.${id}`),
    },
  );
}

export async function gotoInbox(page: Page, session: SeededSession) {
  await applySession(page, session);
  await page.goto("/app/inbox");
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
}

export async function widgetRoot(page: Page) {
  // Widget mounts an open shadow host under documentElement.
  return page.locator("body").locator("div").filter({ has: page.locator("button.fab, button:has-text('Report')") }).first();
}
