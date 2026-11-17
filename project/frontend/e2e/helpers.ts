import { type APIRequestContext, type Page, expect } from "@playwright/test";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type SeededSession = {
  email: string;
  accessToken: string;
  projectId: string;
  publicKey: string;
  projectName: string;
};

function uniq(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function seedSession(request: APIRequestContext): Promise<SeededSession> {
  const email = `${uniq("ui")}@test.closeloop`;
  const password = "test-test-test";
  const projectName = `UI Report ${uniq("p")}`;

  const register = await request.post(`${API_URL}/api/auth/register`, {
    data: { name: "UI Tester", email, password },
  });
  expect(register.ok(), await register.text()).toBeTruthy();
  const regBody = await register.json();
  const accessToken = regBody.access_token as string;
  expect(accessToken).toBeTruthy();

  const project = await request.post(`${API_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name: projectName, platforms: ["web"] },
  });
  expect(project.ok(), await project.text()).toBeTruthy();
  const projBody = await project.json();
  const projectId = projBody.project.id as string;
  const publicKey = projBody.public_key as string;
  expect(projectId && publicKey).toBeTruthy();

  return { email, accessToken, projectId, publicKey, projectName };
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

export async function applySession(page: Page, session: SeededSession) {
  await page.addInitScript(
    ({ accessToken, projectId, publicKey }) => {
      localStorage.setItem("closeloop_access", accessToken);
      localStorage.setItem("closeloop_project", projectId);
      localStorage.setItem("closeloop_public_key", publicKey);
    },
    {
      accessToken: session.accessToken,
      projectId: session.projectId,
      publicKey: session.publicKey,
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
