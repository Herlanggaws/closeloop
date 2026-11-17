const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeInviteEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function splitInviteEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map(normalizeInviteEmail)
    .filter(Boolean);
}

export function isLikelyEmail(raw: string): boolean {
  return LOOKS_LIKE_EMAIL.test(normalizeInviteEmail(raw));
}

/** Pull finished addresses out of the draft; keep an unfinished trailing fragment. */
export function drainInviteDraft(
  draft: string,
  mode: "delimiter" | "all",
): { completed: string[]; remainder: string } {
  if (!draft.trim()) {
    return { completed: [], remainder: "" };
  }

  if (mode === "all") {
    return { completed: splitInviteEmails(draft), remainder: "" };
  }

  const endsWithDelimiter = /[,;\s]$/.test(draft);
  const parts = splitInviteEmails(draft);
  if (parts.length === 0) {
    return { completed: [], remainder: "" };
  }
  if (endsWithDelimiter) {
    return { completed: parts, remainder: "" };
  }
  return {
    completed: parts.slice(0, -1),
    remainder: parts[parts.length - 1] || "",
  };
}

export function mergeInviteEmails(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map(normalizeInviteEmail));
  const next = [...existing];
  for (const email of incoming.map(normalizeInviteEmail).filter(Boolean)) {
    if (seen.has(email)) continue;
    seen.add(email);
    next.push(email);
  }
  return next;
}

export function avatarTone(email: string): string {
  const tones = ["#2563EB", "#0F766E", "#B45309", "#BE123C", "#4338CA", "#047857"];
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash + email.charCodeAt(i) * (i + 1)) % 997;
  }
  return tones[hash % tones.length];
}
