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

export type TicketDetailResponse = {
  ticket: TicketDetail;
  reports: TicketReport[];
  attachments: TicketAttachment[];
  events: TicketEvent[];
  reporters: { total: number; with_email: number };
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
  if (event.kind === "created") return "reported this";
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

export function primaryReport(reports: TicketReport[]) {
  return reports[0];
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
