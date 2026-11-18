/** Normalize API integration config (object or JSON string) to a plain object. */
export function parseIntegrationConfig(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Flatten scalar config fields to strings for form state.
 * Backend stores some IDs as numbers (e.g. GitHub installation_id).
 */
export function asConfig(raw: unknown): Record<string, string> {
  const obj = parseIntegrationConfig(raw);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = String(v);
    else if (typeof v === "boolean") out[k] = String(v);
  }
  return out;
}
