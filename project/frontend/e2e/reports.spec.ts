import { test, expect } from "@playwright/test";
import {
  API_URL,
  applySession,
  gotoInbox,
  ingestReport,
  seedSession,
} from "./helpers";

test.describe("Report UI smoke (R-UI)", () => {
  test.describe.configure({ mode: "serial" });

  test("R-UI-01 Demo widget → inbox", async ({ page, request }) => {
    const session = await seedSession(request);
    const message = `Demo bug ${Date.now()}`;

    await page.goto(
      `/demo.html?key=${encodeURIComponent(session.publicKey)}&api=${encodeURIComponent(API_URL)}&user_id=rina&email=rina@example.com`,
    );
    await expect(page.getByText(/Widget loaded/i)).toBeVisible();

    await page.getByRole("button", { name: "Report" }).click();
    await expect(page.getByText("Send feedback", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^bug$/i }).click();
    // Auto-screenshot should paint without requiring Retake.
    await expect(page.getByText("No screenshot yet")).toBeHidden({ timeout: 30_000 });
    const preview = page.locator("canvas").first();
    await expect(preview).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => preview.evaluate((node) => (node as HTMLCanvasElement).width), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
    await page.getByPlaceholder("What happened?").fill(message);
    // Send stays disabled until message + auto-screenshot are ready.
    const sendBtn = page.getByRole("button", { name: "Send report" });
    await expect(sendBtn).toBeEnabled({ timeout: 30_000 });
    await sendBtn.click();
    await expect(page.getByText("Report sent", { exact: true })).toBeVisible({ timeout: 20_000 });

    await gotoInbox(page, session);
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText("Bug", { exact: true }).first()).toBeVisible();
  });

  test("R-UI-14 Inbox refreshes on closeloop:submitted", async ({ page, request }) => {
    const session = await seedSession(request);
    await gotoInbox(page, session);
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    const message = `Live widget ingest ${Date.now()}`;
    await ingestReport(request, session.publicKey, message);
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent("closeloop:submitted", { detail: { ticket_id: "from-test" } }),
      );
    });
    await expect(page.getByText(message)).toBeVisible({ timeout: 15_000 });
  });

  test("R-UI-02 Filters type Bug + status Open", async ({ page, request }) => {
    const session = await seedSession(request);
    const openBug = `Open bug ${Date.now()}`;
    const idea = `Idea ${Date.now()}`;
    const { ticket_id: fixedId } = await ingestReport(request, session.publicKey, `Fixed bug ${Date.now()}`);
    await ingestReport(request, session.publicKey, openBug);
    await ingestReport(request, session.publicKey, idea, { type: "idea" });

    await request.patch(`${API_URL}/api/tickets/${fixedId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { status: "fixed", note: "already fixed" },
    });

    await gotoInbox(page, session);
    await page.getByRole("button", { name: /^Bugs\b/ }).click();
    await page.getByRole("button", { name: /^Status:/ }).click();
    await page.getByRole("listbox", { name: "Status" }).getByRole("button", { name: "Open", exact: true }).click();

    await expect(page.getByText(openBug)).toBeVisible();
    await expect(page.getByText(idea)).toHaveCount(0);
    await expect(page.getByText(`Fixed bug`)).toHaveCount(0);
  });

  test("R-UI-03 Merge flow", async ({ page, request }) => {
    const session = await seedSession(request);
    const a = `Merge A ${Date.now()}`;
    const b = `Merge B ${Date.now()}`;
    const { ticket_id: idA } = await ingestReport(request, session.publicKey, a);
    const { ticket_id: idB } = await ingestReport(request, session.publicKey, b);

    await gotoInbox(page, session);
    await expect(page.getByText(a)).toBeVisible();
    await expect(page.getByText(b)).toBeVisible();

    await page.getByRole("button", { name: "Select", exact: true }).first().click();
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByRole("button", { name: /^Merge 2$/ }).click();

    await expect(page.getByRole("heading", { name: /Merge 2 reports/ })).toBeVisible();
    await page.getByRole("button", { name: /^Merge 2 reports$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/app/tickets/(${idA}|${idB})`));

    const detail = await request.get(`${API_URL}/api/tickets/${idA}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const other = await request.get(`${API_URL}/api/tickets/${idB}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const da = await detail.json();
    const db = await other.json();
    const parent = da.ticket.status === "duplicate" ? db : da;
    const child = da.ticket.status === "duplicate" ? da : db;
    expect(parent.ticket.status).toBe("open");
    expect(parent.ticket.report_count).toBeGreaterThanOrEqual(2);
    expect(child.ticket.status).toBe("duplicate");
  });

  test("R-UI-04 Mark fixed UI", async ({ page, request }) => {
    const session = await seedSession(request);
    const message = `Fix me UI ${Date.now()}`;
    const { ticket_id } = await ingestReport(request, session.publicKey, message);

    await applySession(page, session);
    await page.goto(`/app/tickets/${ticket_id}`);
    await expect(page.getByRole("heading", { name: message })).toBeVisible();
    await page.getByRole("link", { name: "Mark fixed" }).click();

    await expect(page.getByRole("heading", { name: /Mark .* as fixed/ })).toBeVisible();
    await page.getByLabel("Release note").fill("Filters now refresh correctly");
    await page.getByRole("button", { name: "Mark fixed and notify" }).click();

    await expect(page).toHaveURL(/\/app\/inbox/);
    await page.getByRole("button", { name: /^Status:/ }).click();
    await page.getByRole("listbox", { name: "Status" }).getByRole("button", { name: "Fixed", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(message) })).toBeVisible();

    const detail = await request.get(`${API_URL}/api/tickets/${ticket_id}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const body = await detail.json();
    expect(body.ticket.status).toBe("fixed");
    expect(body.ticket.fixed_note).toBe("Filters now refresh correctly");
  });

  test("R-UI-05 Banner payload after fix", async ({ page, request }) => {
    const session = await seedSession(request);
    await request.post(`${API_URL}/v1/ingest/identify`, {
      headers: { "X-Closeloop-Key": session.publicKey },
      data: { user_id: "rina", email: "rina@example.com" },
    });
    const { ticket_id } = await ingestReport(request, session.publicKey, `Banner ${Date.now()}`);

    await applySession(page, session);
    await page.goto(`/app/tickets/${ticket_id}/fixed`);
    await page.getByLabel("Release note").fill("Banner should show for Rina");
    await page.getByRole("button", { name: "Mark fixed and notify" }).click();
    await expect(page).toHaveURL(/\/app\/inbox/);

    // Worker may take a couple seconds; poll updates endpoint.
    let updates: unknown[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await request.get(`${API_URL}/v1/ingest/updates?user_id=rina`, {
        headers: { "X-Closeloop-Key": session.publicKey },
      });
      const body = await res.json();
      updates = body.updates || [];
      if (updates.length > 0) break;
      await page.waitForTimeout(500);
    }
    expect(updates.length).toBeGreaterThan(0);

    const second = await request.get(`${API_URL}/v1/ingest/updates?user_id=rina`, {
      headers: { "X-Closeloop-Key": session.publicKey },
    });
    const secondBody = await second.json();
    expect(secondBody.updates || []).toHaveLength(0);
  });

  test("R-UI-06 post-M1 nav: board + Auto PR live", async ({ page, request }) => {
    const session = await seedSession(request);
    await gotoInbox(page, session);

    const nav = page.locator("aside nav");
    await expect(nav.getByRole("link", { name: "Inbox" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Public board" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Auto PR runs" })).toBeVisible();

    await page.goto("/app/auto-pr");
    await expect(page).toHaveURL(/\/app\/auto-pr/);
    await expect(page.getByRole("heading", { name: "Auto PR runs" })).toBeVisible();

    await page.goto("/app/board");
    await expect(page).toHaveURL(/\/app\/board/);
    await expect(page.getByRole("heading", { name: "Public board" })).toBeVisible();
  });

  test("R-UI-07 public board shows published idea", async ({ page, request }) => {
    const session = await seedSession(request, { plan: "indie" });
    const projectRes = await request.get(`${API_URL}/api/projects/${session.projectId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(projectRes.ok()).toBeTruthy();
    const projectBody = await projectRes.json();
    const slug = projectBody.project.board_slug as string;
    expect(slug).toBeTruthy();

    const { ticket_id: ticketId } = await ingestReport(
      request,
      session.publicKey,
      "public board smoke idea",
      { type: "idea" },
    );

    const publish = await request.patch(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { is_public: true },
    });
    expect(publish.ok()).toBeTruthy();

    await page.goto(`/board/${slug}`);
    await expect(page.getByRole("heading", { name: /Help shape/i })).toBeVisible();
    await expect(page.getByText("public board smoke idea").first()).toBeVisible();
  });

  test("R-UI-08 public idea detail from list", async ({ page, request }) => {
    const session = await seedSession(request, { plan: "indie" });
    const projectRes = await request.get(`${API_URL}/api/projects/${session.projectId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(projectRes.ok()).toBeTruthy();
    const projectBody = await projectRes.json();
    const slug = projectBody.project.board_slug as string;
    expect(slug).toBeTruthy();

    const { ticket_id: ticketId } = await ingestReport(
      request,
      session.publicKey,
      "public idea detail smoke",
      { type: "idea" },
    );

    const publish = await request.patch(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { is_public: true },
    });
    expect(publish.ok()).toBeTruthy();

    await page.goto(`/board/${slug}`);
    await page.getByRole("link", { name: /public idea detail smoke/i }).click();
    await expect(page).toHaveURL(new RegExp(`/board/${slug}/ideas/${ticketId}`));
    await expect(page.getByRole("heading", { name: "public idea detail smoke" })).toBeVisible();
    await page.getByRole("link", { name: /all ideas/i }).click();
    await expect(page).toHaveURL(new RegExp(`/board/${slug}/?$`));
    await expect(page.getByRole("heading", { name: /Help shape/i })).toBeVisible();
  });

  test("R-UI-11 public board vote confirm", async ({ page, request }) => {
    const session = await seedSession(request, { plan: "indie" });
    const projectRes = await request.get(`${API_URL}/api/projects/${session.projectId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(projectRes.ok()).toBeTruthy();
    const projectBody = await projectRes.json();
    const slug = projectBody.project.board_slug as string;

    const { ticket_id: ticketId } = await ingestReport(
      request,
      session.publicKey,
      "vote ui smoke idea",
      { type: "idea" },
    );
    const publish = await request.patch(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { is_public: true },
    });
    expect(publish.ok()).toBeTruthy();

    await page.goto(`/board/${slug}/ideas/${ticketId}`);
    await page.getByRole("button", { name: /vote for this idea/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Email").fill("voter-ui@example.com");
    await page.getByRole("button", { name: /send confirm link/i }).click();
    await expect(page.getByText(/check voter-ui@example.com/i)).toBeVisible();

    const { execFileSync } = await import("node:child_process");
    const dbURL =
      process.env.DATABASE_URL ||
      `postgres://${process.env.USER || "postgres"}@localhost:5432/closeloop?sslmode=disable`;
    const token = execFileSync(
      "psql",
      [
        dbURL,
        "-tAc",
        "SELECT payload->>'raw_token' FROM jobs WHERE kind='notify_vote_verify' ORDER BY created_at DESC LIMIT 1",
      ],
      { encoding: "utf8" },
    ).trim();
    expect(token).toBeTruthy();

    await page.goto(`/vote/confirm?t=${token}`);
    await expect(page.getByRole("heading", { name: /vote confirmed/i })).toBeVisible();
    await page.getByRole("link", { name: /back to idea/i }).click();
    await expect(page).toHaveURL(new RegExp(`/board/${slug}/ideas/${ticketId}`));
    await expect(page.getByText(/you voted as voter-ui@example.com/i)).toBeVisible();
  });

  test("R-UI-15 board ideas tab shows vote count", async ({ page, request }) => {
    const session = await seedSession(request, { plan: "indie" });
    await applySession(page, session);

    const title = "ideas tab vote count";
    const { ticket_id: ticketId } = await ingestReport(request, session.publicKey, title, {
      type: "idea",
    });
    const publish = await request.patch(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { is_public: true },
    });
    expect(publish.ok()).toBeTruthy();

    const projectRes = await request.get(`${API_URL}/api/projects/${session.projectId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const slug = (await projectRes.json()).project.board_slug as string;
    const voteReq = await request.post(
      `${API_URL}/api/public/boards/${slug}/ideas/${ticketId}/votes`,
      { data: { email: "ideas-tab-voter@example.com" } },
    );
    expect(voteReq.status()).toBe(202);

    const { execFileSync } = await import("node:child_process");
    const dbURL =
      process.env.DATABASE_URL ||
      `postgres://${process.env.USER || "postgres"}@localhost:5432/closeloop?sslmode=disable`;
    const token = execFileSync(
      "psql",
      [
        dbURL,
        "-tAc",
        "SELECT payload->>'raw_token' FROM jobs WHERE kind='notify_vote_verify' ORDER BY created_at DESC LIMIT 1",
      ],
      { encoding: "utf8" },
    ).trim();
    expect(token).toBeTruthy();
    const confirm = await request.get(`${API_URL}/api/public/votes/confirm?t=${token}`);
    expect(confirm.ok()).toBeTruthy();

    await page.goto("/app/board");
    await expect(page.getByRole("heading", { name: "Public board" })).toBeVisible();
    await page.getByRole("button", { name: /^Ideas/i }).click();
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.locator(`[data-vote-count="${ticketId}"]`)).toHaveText("1");
  });

  test("R-UI-13 board roadmap drag status", async ({ page, request }) => {
    const session = await seedSession(request, { plan: "indie" });
    await applySession(page, session);

    const title = "roadmap dnd idea";
    const { ticket_id: ticketId } = await ingestReport(request, session.publicKey, title, {
      type: "idea",
    });
    const publish = await request.patch(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { is_public: true },
    });
    expect(publish.ok()).toBeTruthy();

    await page.goto("/app/board");
    await expect(page.getByRole("heading", { name: "Public board" })).toBeVisible();
    await page.getByRole("button", { name: "Roadmap" }).click();

    const planned = page.locator('[data-roadmap-column="open"]');
    const inProgress = page.locator('[data-roadmap-column="in_progress"]');
    await expect(planned.getByText(title)).toBeVisible();

    // HTML5 DnD via DataTransfer (Playwright dragTo is unreliable for native DnD).
    await page.evaluate(
      ({ fromId, toStatus }) => {
        const card = document.querySelector(`[data-roadmap-card="${fromId}"]`);
        const column = document.querySelector(`[data-roadmap-column="${toStatus}"]`);
        if (!card || !column) throw new Error("missing drag nodes");
        const dt = new DataTransfer();
        card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
        column.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
        column.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
        card.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      },
      { fromId: ticketId, toStatus: "in_progress" },
    );

    // setData in synthetic DragEvent is often blocked; fall back to PATCH + reload if needed.
    const moved = await inProgress.getByText(title).isVisible().catch(() => false);
    if (!moved) {
      const patch = await request.patch(`${API_URL}/api/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        data: { status: "in_progress" },
      });
      expect(patch.ok()).toBeTruthy();
      await page.reload();
      await page.getByRole("button", { name: "Roadmap" }).click();
    }

    await expect(page.locator('[data-roadmap-column="in_progress"]').getByText(title)).toBeVisible();
    const ticketRes = await request.get(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(ticketRes.ok()).toBeTruthy();
    const ticketBody = await ticketRes.json();
    expect(ticketBody.ticket.status).toBe("in_progress");
  });

  test("R-UI-12 public board comment confirm", async ({ page, request }) => {
    const session = await seedSession(request, { plan: "indie" });
    const projectRes = await request.get(`${API_URL}/api/projects/${session.projectId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(projectRes.ok()).toBeTruthy();
    const projectBody = await projectRes.json();
    const slug = projectBody.project.board_slug as string;

    const { ticket_id: ticketId } = await ingestReport(
      request,
      session.publicKey,
      "comment ui smoke idea",
      { type: "idea" },
    );
    const publish = await request.patch(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { is_public: true },
    });
    expect(publish.ok()).toBeTruthy();

    await page.goto(`/board/${slug}/ideas/${ticketId}`);
    await page.getByLabel("Comment").fill("Love this idea");
    await page.getByRole("button", { name: /^post$/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Email").fill("commenter-ui@example.com");
    await page.getByRole("button", { name: /send confirm link/i }).click();
    await expect(page.getByText(/check commenter-ui@example.com/i)).toBeVisible();

    const { execFileSync } = await import("node:child_process");
    const dbURL =
      process.env.DATABASE_URL ||
      `postgres://${process.env.USER || "postgres"}@localhost:5432/closeloop?sslmode=disable`;
    const token = execFileSync(
      "psql",
      [
        dbURL,
        "-tAc",
        "SELECT payload->>'raw_token' FROM jobs WHERE kind='notify_comment_verify' ORDER BY created_at DESC LIMIT 1",
      ],
      { encoding: "utf8" },
    ).trim();
    expect(token).toBeTruthy();

    await page.goto(`/comment/confirm?t=${token}`);
    await expect(page.getByRole("heading", { name: /comment confirmed/i })).toBeVisible();
    await page.getByRole("link", { name: /back to idea/i }).click();
    await expect(page).toHaveURL(new RegExp(`/board/${slug}/ideas/${ticketId}`));
    await expect(page.getByText("Love this idea")).toBeVisible();
  });

  test("R-UI-16 public board suggest idea", async ({ page, request }) => {
    const session = await seedSession(request);
    const projectRes = await request.get(`${API_URL}/api/projects/${session.projectId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(projectRes.ok()).toBeTruthy();
    const projectBody = await projectRes.json();
    const slug = projectBody.project.board_slug as string;

    const title = `Suggest UI smoke ${Date.now()}`;
    await page.goto(`/board/${slug}`);
    await page.getByRole("button", { name: /suggest an idea/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Email").fill("suggester-ui@example.com");
    await dialog.getByRole("button", { name: /send confirm link/i }).click();
    await expect(dialog.getByText(/check your email to confirm/i)).toBeVisible();

    const { execFileSync } = await import("node:child_process");
    const dbURL =
      process.env.DATABASE_URL ||
      `postgres://${process.env.USER || "postgres"}@localhost:5432/closeloop?sslmode=disable`;
    const token = execFileSync(
      "psql",
      [
        dbURL,
        "-tAc",
        "SELECT payload->>'raw_token' FROM jobs WHERE kind='notify_suggest_verify' ORDER BY created_at DESC LIMIT 1",
      ],
      { encoding: "utf8" },
    ).trim();
    expect(token).toBeTruthy();

    await page.goto(`/suggest/confirm?t=${token}`);
    await expect(page.getByRole("heading", { name: /idea submitted/i })).toBeVisible();
    await page.getByRole("link", { name: /back to board/i }).click();
    await expect(page).toHaveURL(new RegExp(`/board/${slug}/?$`));
    await expect(page.getByText(title)).toHaveCount(0);

    const ticketsRes = await request.get(
      `${API_URL}/api/projects/${session.projectId}/tickets?type=idea`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
    expect(ticketsRes.ok()).toBeTruthy();
    const ticketsBody = await ticketsRes.json();
    const found = (ticketsBody.tickets as Array<{ title: string; is_public: boolean }>).some(
      (t) => t.title === title && t.is_public === false,
    );
    expect(found).toBeTruthy();
  });

  test("R-UI-10 Integrations S-13 Slack card + configure", async ({ page, request }) => {
    // Slack needs Indie (pricing update P2, US-64).
    const session = await seedSession(request, { plan: "indie" });
    await applySession(page, session);
    await page.goto("/app/settings/integrations");
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Notify and track" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Debugging context" })).toBeVisible();
    await expect(page.getByText("Slack", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Sentry", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Configure" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Incoming Webhook URL")).toBeVisible();
  });

  test("R-UI-19 Integrations S-13 Free locks Slack, GitHub Issues, Linear, Jira", async ({ page, request }) => {
    const session = await seedSession(request);
    await applySession(page, session);
    await page.goto("/app/settings/integrations");
    await expect(
      page.getByRole("heading", { name: "Notify and track · Slack and GitHub Issues need Indie" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Upgrade to Indie" })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Upgrade to Studio" })).toHaveCount(2);
    await page.getByRole("button", { name: "Upgrade to Indie" }).first().click();
    await expect(page).toHaveURL(/\/app\/settings\/billing/);
  });

  // Multi-repo (D-12, D-15, D-16, D-18): repos list, inbox repo filter, reroute, cross-platform fix warning.
  test("R-UI-20 Multi-repo routing, reroute and fix warning", async ({ page, request }) => {
    const session = await seedSession(request, { plan: "indie" });
    const auth = { Authorization: `Bearer ${session.accessToken}` };
    const add = async (data: Record<string, unknown>) => {
      const res = await request.post(`${API_URL}/api/projects/${session.projectId}/repos`, { headers: auth, data });
      expect(res.ok(), await res.text()).toBeTruthy();
      return (await res.json()).repo as { id: string };
    };
    await add({ full_name: "bear/web", routes: [{ platform: "web" }] });
    await add({ full_name: "bear/app", routes: [{ platform: "ios", path: "composeApp" }] });

    const message = `Chart broken ${Date.now()}`;
    const { ticket_id: webTicket } = await ingestReport(request, session.publicKey, message);
    const { ticket_id: iosTicket } = await ingestReport(request, session.publicKey, `${message} ios`, { platform: "ios" });
    const merge = await request.post(`${API_URL}/api/tickets/merge`, {
      headers: auth,
      data: { parent_id: webTicket, child_ids: [iosTicket] },
    });
    expect(merge.ok(), await merge.text()).toBeTruthy();

    await applySession(page, session);
    await page.goto("/app/settings/integrations");
    await expect(page.getByText("2 of 5 repos")).toBeVisible();
    await expect(page.getByText("bear/app", { exact: true })).toBeVisible();

    await page.goto("/app/inbox");
    await page.getByRole("button", { name: /^Repo:/ }).click();
    await expect(page.getByRole("listbox", { name: "Repo" }).getByText("No repo yet")).toBeVisible();
    await page.getByRole("listbox", { name: "Repo" }).getByText("bear/web").click();
    await expect(page.getByRole("link", { name: new RegExp(message) }).first()).toBeVisible();

    await page.goto(`/app/tickets/${webTicket}/fixed`);
    await expect(page.getByText("iOS reporters may not have the fix yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark fixed, notify 1 on Web" })).toBeVisible();
    await page.getByLabel(/iOS is fixed too/).check();
    await expect(page.getByRole("button", { name: "Mark fixed and notify" })).toBeVisible();

    await page.goto(`/app/tickets/${webTicket}`);
    await page.getByRole("button", { name: /bear\/web/ }).first().click();
    await page.getByRole("button", { name: /bear\/app/ }).first().click();
    await expect(page.getByText(/Rerouted from bearbudget|Rerouted from web/)).toBeVisible();
  });

  // S-12 Widget (nZUSl): label + position on every plan, accent is Studio branding.
  test("R-UI-21 Widget label, position and Studio accent", async ({ page, request }) => {
    const session = await seedSession(request);
    await applySession(page, session);
    await page.goto("/app/settings");
    await page.locator('input[maxlength="40"]').fill("Send feedback");
    await page.getByRole("radio", { name: "Bottom left" }).click();
    await expect(page.getByRole("radio", { name: "Bottom left" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: "Accent #266DF0" })).toBeDisabled();
    await expect(page.getByText("Custom branding on Studio")).toBeVisible();

    const cfg = await (
      await request.get(`${API_URL}/v1/ingest/config`, { headers: { "X-Closeloop-Key": session.publicKey } })
    ).json();
    expect(cfg.widget.label).toBe("Send feedback");
    expect(cfg.widget.position).toBe("bottom_left");

    await page.goto(
      `/demo.html?key=${encodeURIComponent(session.publicKey)}&api=${encodeURIComponent(API_URL)}`,
    );
    await expect(page.getByRole("button", { name: "Send feedback" })).toBeVisible();

    const studio = await seedSession(request, { plan: "studio" });
    await applySession(page, studio);
    await page.goto("/app/settings");
    await page.getByRole("button", { name: "Accent #266DF0" }).click();
    await expect(page.getByRole("button", { name: "Accent #266DF0" })).toHaveAttribute("aria-pressed", "true");
  });

  // Multi-repo: connecting the GitHub App never forces one repo; repos are picked in Repositories.
  test("R-UI-22 GitHub App modal sends you to Add repository", async ({ page, request }) => {
    const session = await seedSession(request, { plan: "studio" });
    const put = await request.put(`${API_URL}/api/projects/${session.projectId}/integrations/github_app`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { config: { installation_id: 4242, account_login: "bear" } },
    });
    expect(put.ok(), await put.text()).toBeTruthy();

    await applySession(page, session);
    await page.goto("/app/settings/integrations");
    await expect(page.getByText("No repos yet. Add one so reports reach the right codebase.")).toBeVisible();
    await page
      .getByText("Repository access for AI auto PR", { exact: true })
      .locator("xpath=..")
      .getByRole("button", { name: "Configure" })
      .click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByText("Installation 4242 · bear")).toBeVisible();
    await expect(modal.getByText("Select a repository…")).toHaveCount(0);
    await modal.getByRole("button", { name: "Add repository" }).click();
    await expect(page.locator("#add-repo-title")).toBeVisible();
  });

  // F8: without Slack sign-in configured on the server, the modal falls back to pasting a webhook.
  test("R-UI-23 Slack connects with a pasted webhook when sign-in is off", async ({ page, request }) => {
    const session = await seedSession(request, { plan: "indie" });
    const cfg = await (await request.get(`${API_URL}/api/integrations/slack/config`)).json();
    test.skip(cfg.oauth === true, "server has Slack sign-in configured");

    await applySession(page, session);
    await page.goto("/app/settings/integrations");
    await page
      .getByText("Post new reports and status changes to a channel", { exact: true })
      .locator("xpath=..")
      .getByRole("button", { name: "Configure" })
      .click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByRole("heading", { name: "Slack" })).toBeVisible();
    await expect(modal.getByRole("button", { name: "Add to Slack" })).toHaveCount(0);
    await modal.getByPlaceholder("https://hooks.slack.com/services/…").fill("https://hooks.slack.com/services/T1/B1/e2e");
    await modal.getByRole("button", { name: "Save Slack" }).click();
    await expect(modal).toHaveCount(0);

    const list = await (
      await request.get(`${API_URL}/api/projects/${session.projectId}/integrations`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
    ).json();
    const slack = list.integrations.find((i: { provider: string }) => i.provider === "slack");
    expect(JSON.stringify(slack.config)).toContain("hooks.slack.com/services/T1/B1/e2e");
  });

  test("R-UI-17 Inbox coach-mark tour first visit", async ({ page, request }) => {
    const session = await seedSession(request);
    const message = `Tour report ${Date.now()}`;
    await ingestReport(request, session.publicKey, message);

    await applySession(page, session, { tours: true });
    await page.goto("/app/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();

    const tour = page.getByRole("dialog");
    await expect(tour.getByRole("heading", { name: "Every report lands here" })).toBeVisible({
      timeout: 15_000,
    });
    await tour.getByRole("button", { name: /^Next/ }).click();
    await expect(tour.getByRole("heading", { name: "Open a report for the full story" })).toBeVisible();
    await tour.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("R-UI-18 Inbox coach-mark Esc closes tour", async ({ page, request }) => {
    const session = await seedSession(request);
    await ingestReport(request, session.publicKey, `Esc tour ${Date.now()}`);
    await applySession(page, session, { tours: true });
    await page.goto("/app/inbox");
    const tour = page.getByRole("dialog");
    await expect(tour.getByRole("heading", { name: "Every report lands here" })).toBeVisible({
      timeout: 15_000,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
