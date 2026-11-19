export type TicketStatus =
  | "open"
  | "in_progress"
  | "fixed"
  | "wont_fix"
  | "duplicate";

export type TicketDetail = {
  id: string;
  project_id: string;
  type: string;
  status: string;
  title: string;
  report_count: number;
  fixed_at: string | null;
  fixed_note: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketReport = {
  id: string;
  ticket_id: string;
  reporter_id?: string | null;
  reporter_email?: string | null;
  external_user_id?: string | null;
  message: string;
  platform: string;
  context: Record<string, unknown> | null;
  app_version?: string | null;
  created_at: string;
};

export type TicketAttachment = {
  id: string;
  report_id: string;
  kind: string;
  uploaded: boolean;
  url?: string;
};

export type TicketEvent = {
  id: string;
  ticket_id: string;
  actor: string;
  kind: string;
  payload: Record<string, unknown> | string | null;
  created_at: string;
};

export type IntegrationConfig = {
  id?: string;
  provider: string;
  config: Record<string, unknown> | string;
};

export type TicketDetailResponse = {
  ticket: TicketDetail;
  reports: TicketReport[];
  attachments: TicketAttachment[];
  events: TicketEvent[];
  integrations?: IntegrationConfig[];
  reporters: {
    total: number;
    with_email: number;
    items?: TicketReporterItem[];
    by_platform?: Record<string, number>;
  };
};

export const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  bug: { bg: "#FEF2F2", text: "#DA314A", label: "Bug" },
  idea: { bg: "#FFF7ED", text: "#EA6C0C", label: "Idea" },
  question: { bg: "#EFF6FF", text: "#266DF0", label: "Question" },
};

export const STATUS_META: Record<
  string,
  { label: string; dot: string }
> = {
  open: { label: "Open", dot: "#266DF0" },
  in_progress: { label: "In progress", dot: "#EA6C0C" },
  fixed: { label: "Fixed", dot: "#16A34A" },
  wont_fix: { label: "Won't fix", dot: "#A3A3A3" },
  duplicate: { label: "Duplicate", dot: "#A3A3A3" },
};

export const STATUS_OPTIONS: { id: TicketStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "fixed", label: "Fixed" },
  { id: "wont_fix", label: "Won't fix" },
  { id: "duplicate", label: "Duplicate" },
];

export function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 6);
}

export function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export function projectInitial(name: string) {
  return (name.trim()[0] || "P").toUpperCase();
}

export type TicketReporterItem = {
  reporter_id?: string;
  email?: string;
  external_user_id?: string;
  platform: string;
};

const PLATFORM_LABEL: Record<string, string> = { web: "Web", ios: "iOS", android: "Android" };

export function platformLabel(platform: string) {
  return PLATFORM_LABEL[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

/** "3 · Web 2, iOS 1" summary for the S-07 Reporters header. */
export function reportersSummary(items: TicketReporterItem[], byPlatform?: Record<string, number>) {
  const counts = byPlatform && Object.keys(byPlatform).length ? byPlatform : items.reduce<Record<string, number>>((acc, item) => {
    acc[item.platform] = (acc[item.platform] || 0) + 1;
    return acc;
  }, {});
  const order = ["web", "ios", "android"];
  const parts = Object.entries(counts)
    .sort(([a], [b]) => (order.indexOf(a) + 99) % 100 - (order.indexOf(b) + 99) % 100)
    .map(([platform, n]) => `${platformLabel(platform)} ${n}`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return parts.length ? `${total} · ${parts.join(", ")}` : `${total}`;
}

export function displayName(email: string) {
  const local = email.split("@")[0] || "You";
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function initials(email: string) {
  const name = displayName(email);
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function actorLabel(actor: string) {
  if (actor.startsWith("user:")) return displayName(actor.slice(5));
  if (actor === "agent") return "Agent";
  if (actor === "user") return "Reporter";
  return actor;
}

function asPayload(payload: TicketEvent["payload"]): Record<string, unknown> {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return payload;
}

export function eventDescription(event: TicketEvent) {
  const payload = asPayload(event.payload);
  if (event.kind === "note") {
    const body = typeof payload.body === "string" ? payload.body : "";
    return body ? `added a note: "${body}"` : "added a note";
  }
  if (event.kind === "status_changed") {
    const from = typeof payload.from === "string" ? payload.from : "";
    const to = typeof payload.to === "string" ? payload.to : "";
    const fromLabel = STATUS_META[from]?.label || from || "?";
    const toLabel = STATUS_META[to]?.label || to || "?";
    return `changed status ${fromLabel} → ${toLabel}`;
  }
  if (event.kind === "merged") {
    const childIds = Array.isArray(payload.child_ids) ? payload.child_ids : [];
    const n = childIds.length;
    return n > 0
      ? `merged ${n} duplicate${n === 1 ? "" : "s"} into this ticket`
      : "merged duplicates into this ticket";
  }
  if (event.kind === "created") return "reported this";
  if (event.kind === "github_issue_created") {
    const number = typeof payload.number === "number" ? payload.number : null;
    const url = typeof payload.html_url === "string" ? payload.html_url : "";
    if (number != null && url) {
      return `created GitHub issue #${number}`;
    }
    return "created a GitHub issue";
  }
  return event.kind.replace(/_/g, " ");
}

export function contextEntries(
  report: TicketReport | undefined,
): { key: string; value: string }[] {
  if (!report) return [];
  const ctx = report.context || {};
  const preferred = ["path", "route", "url", "browser", "userAgent", "os", "screen", "viewport"];
  const seen = new Set<string>();
  const rows: { key: string; value: string }[] = [];

  function push(key: string, value: unknown) {
    if (value == null || value === "") return;
    const label = key === "userAgent" ? "Browser" : key[0].toUpperCase() + key.slice(1);
    if (seen.has(label)) return;
    seen.add(label);
    rows.push({
      key: label,
      value: typeof value === "string" ? value : JSON.stringify(value),
    });
  }

  for (const key of preferred) {
    if (key in ctx) push(key, ctx[key]);
  }
  for (const [key, value] of Object.entries(ctx)) {
    if (preferred.includes(key)) continue;
    if (typeof value === "object" && value !== null) continue;
    push(key, value);
  }

  if (report.platform) push("Platform", report.platform);
  if (report.app_version) push("App version", report.app_version);
  if (report.external_user_id) push("User id", report.external_user_id);

  return rows;
}

export function screenshotUrl(attachments: TicketAttachment[]) {
  const shot = attachments.find((a) => a.kind === "screenshot" && a.uploaded && a.url);
  return shot?.url || "";
}

export function replayUrl(attachments: TicketAttachment[]) {
  const replay = attachments.find((a) => a.kind === "replay" && a.uploaded && a.url);
  return replay?.url || "";
}

export function primaryReport(reports: TicketReport[]) {
  return reports[0];
}

function integrationConfigMap(
  raw: IntegrationConfig["config"] | undefined,
): Record<string, string> {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") {
    obj = raw;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

function contextString(ctx: Record<string, unknown> | null | undefined, key: string) {
  const value = ctx?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function buildSentryUrl(
  report: TicketReport | undefined,
  integrations: IntegrationConfig[] | undefined,
): string | null {
  const eventId = contextString(report?.context, "sentry_event_id");
  if (!eventId) return null;
  const cfg = integrationConfigMap(
    integrations?.find((i) => i.provider === "sentry")?.config,
  );
  const org = cfg.org || cfg.organization;
  if (!org) return null;
  const project = cfg.project;
  const base = project
    ? `https://${org}.sentry.io/projects/${encodeURIComponent(project)}/`
    : `https://${org}.sentry.io/issues/`;
  return `${base}?query=${encodeURIComponent(eventId)}`;
}

export function buildPosthogUrl(
  report: TicketReport | undefined,
  integrations: IntegrationConfig[] | undefined,
): string | null {
  const sessionId = contextString(report?.context, "posthog_session_id");
  if (!sessionId) return null;
  const cfg = integrationConfigMap(
    integrations?.find((i) => i.provider === "posthog")?.config,
  );
  const host = (cfg.host || "").replace(/\/$/, "");
  const projectId = cfg.project_id || cfg.project;
  if (!host || !projectId) return null;
  return `${host}/project/${encodeURIComponent(projectId)}/replay/${encodeURIComponent(sessionId)}`;
}

export function reporterLine(report: TicketReport | undefined, createdAt: string) {
  if (!report) return relativeTime(createdAt);
  const parts: string[] = [];
  if (report.reporter_email) {
    parts.push(displayName(report.reporter_email));
    parts.push(report.reporter_email);
  }
  if (report.external_user_id) parts.push(report.external_user_id);
  parts.push(relativeTime(report.created_at || createdAt));
  return parts.join(" · ");
}
