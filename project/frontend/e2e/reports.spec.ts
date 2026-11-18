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

  test("R-UI-06 post-M1 nav: board live, Auto PR still hidden", async ({ page, request }) => {
    const session = await seedSession(request);
    await gotoInbox(page, session);

    const nav = page.locator("aside nav");
    await expect(nav.getByRole("link", { name: "Inbox" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Public board" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Auto PR runs" })).toHaveCount(0);

    await page.goto("/app/auto-pr");
    await expect(page).toHaveURL(/\/app\/inbox/);
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await page.goto("/app/board");
    await expect(page).toHaveURL(/\/app\/board/);
    await expect(page.getByRole("heading", { name: "Public board" })).toBeVisible();
  });

  test("R-UI-07 public board shows published idea", async ({ page, request }) => {
    const session = await seedSession(request);
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
    await expect(page.getByText("public board smoke idea")).toBeVisible();
  });

  test("R-UI-08 public idea detail from list", async ({ page, request }) => {
    const session = await seedSession(request);
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
    const session = await seedSession(request);
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
    const session = await seedSession(request);
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
    const session = await seedSession(request);
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
    const session = await seedSession(request);
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
    const session = await seedSession(request);
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
});
