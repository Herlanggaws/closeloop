const DEFAULT_POST_AUTH_PATH = "/app/inbox";

/** Relative in-app path only — blocks open redirects via ?next=. */
export function safePostAuthPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_POST_AUTH_PATH;
  if (!next.startsWith("/") || next.startsWith("//")) return DEFAULT_POST_AUTH_PATH;
  if (next.includes("://") || next.includes("\\")) return DEFAULT_POST_AUTH_PATH;
  return next;
}
