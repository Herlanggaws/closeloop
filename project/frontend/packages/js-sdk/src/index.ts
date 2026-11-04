export type CloseloopConfig = {
  apiUrl: string;
  publicKey: string;
};

export async function createReport(
  cfg: CloseloopConfig,
  body: Record<string, unknown>,
) {
  const res = await fetch(`${cfg.apiUrl}/v1/ingest/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Closeloop-Key": cfg.publicKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
