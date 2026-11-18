import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { domToPng } from "modern-screenshot";
import {
  compositeAnnotatedPng,
  drawStrokes,
  moveStroke,
  startStroke,
  type AnnotateTool,
  type Stroke,
} from "./annotate";

type State = "launcher" | "form" | "sent" | "banner";

type Config = {
  key: string;
  api: string;
  userId?: string;
  email?: string;
  appVersion?: string;
  selectors: string[];
};

type BannerUpdate = {
  body: string;
  ticketId: string;
  projectName: string;
};

function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 6);
}

function uniqueSelectors(...lists: string[][]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const sel = raw.trim();
      if (!sel || seen.has(sel)) continue;
      seen.add(sel);
      out.push(sel);
    }
  }
  return out;
}

function readConfig(): Config {
  const script = document.currentScript as HTMLScriptElement | null;
  const el =
    script ||
    (document.querySelector("script[data-key]") as HTMLScriptElement | null);
  return {
    key: el?.dataset.key || "",
    api: el?.dataset.api || "http://localhost:8080",
    userId: el?.dataset.userId,
    email: el?.dataset.email,
    appVersion: el?.dataset.appVersion,
    selectors: uniqueSelectors(
      (el?.dataset.mask || "").split(",").map((s) => s.trim()).filter(Boolean),
    ),
  };
}

async function fetchProjectSelectors(cfg: Config): Promise<string[]> {
  if (!cfg.key) return [];
  try {
    const res = await fetch(`${cfg.api}/v1/ingest/config`, {
      headers: { "X-Closeloop-Key": cfg.key },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.sensitive_selectors;
    if (!Array.isArray(list)) return [];
    return list.filter((s: unknown): s is string => typeof s === "string" && s.trim() !== "");
  } catch {
    return [];
  }
}

async function maskAndShot(selectors: string[]) {
  const nodes: HTMLElement[] = [];
  for (const sel of [".closeloop-mask", "[data-closeloop-mask]", ...selectors]) {
    try {
      document.querySelectorAll(sel).forEach((n) => nodes.push(n as HTMLElement));
    } catch {
      // ignore invalid selectors from project settings
    }
  }
  const prev = nodes.map((n) => n.style.filter);
  nodes.forEach((n) => (n.style.filter = "blur(8px)"));
  try {
    return await domToPng(document.body, { scale: 1, quality: 0.9 });
  } finally {
    nodes.forEach((n, i) => (n.style.filter = prev[i]));
  }
}

function screenshotBase64(dataUrl: string) {
  const marker = ";base64,";
  const i = dataUrl.indexOf(marker);
  return i >= 0 ? dataUrl.slice(i + marker.length) : dataUrl;
}

function harvestContextIds() {
  const context: Record<string, unknown> = {
    url: location.href,
    userAgent: navigator.userAgent,
    viewport: { w: innerWidth, h: innerHeight },
  };

  try {
    const sentry = (window as any).Sentry;
    const last =
      sentry?.lastEventId?.() ||
      sentry?.getCurrentHub?.()?.lastEventId?.() ||
      sentry?.getClient?.()?.getOptions?.()?.lastEventId;
    if (typeof last === "string" && last) context.sentry_event_id = last;
  } catch {
    // optional host integration
  }

  try {
    const posthog = (window as any).posthog;
    const session =
      posthog?.get_session_id?.() ||
      posthog?.sessionManager?.checkAndGetSessionAndWindowId?.()?.sessionId;
    if (typeof session === "string" && session) context.posthog_session_id = session;
  } catch {
    // optional host integration
  }

  return context;
}

async function submitReport(
  cfg: Config,
  payload: { type: string; message: string; email: string; screenshot: string },
) {
  const res = await fetch(`${cfg.api}/v1/ingest/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Closeloop-Key": cfg.key,
    },
    body: JSON.stringify({
      type: payload.type,
      message: payload.message,
      platform: "web",
      email: payload.email || cfg.email,
      user_id: cfg.userId,
      app_version: cfg.appVersion,
      context: harvestContextIds(),
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (data.upload_url) {
    // DNSCloud WAF blocks raw image bodies and any JSON that contains the
    // literal "image/png" (including data URLs). Send bare base64 only.
    const up = await fetch(data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: screenshotBase64(payload.screenshot) }),
    });
    if (!up.ok) throw new Error(await up.text());
  }
  await fetch(`${cfg.api}/v1/ingest/reports/${data.report_id}/complete`, {
    method: "POST",
    headers: { "X-Closeloop-Key": cfg.key },
  });
  return data as { ticket_id: string; report_id: string };
}

async function fetchUpdates(cfg: Config): Promise<BannerUpdate | null> {
  if (!cfg.userId && !cfg.email) return null;
  const q = new URLSearchParams();
  if (cfg.userId) q.set("user_id", cfg.userId);
  if (cfg.email) q.set("email", cfg.email);
  const res = await fetch(`${cfg.api}/v1/ingest/updates?${q}`, {
    headers: { "X-Closeloop-Key": cfg.key },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const update = data.updates?.[0];
  if (!update?.body) return null;
  return {
    body: update.body,
    ticketId: update.ticket_id || "",
    projectName: update.project_name || "the team",
  };
}

function Widget({ cfg }: { cfg: Config }) {
  const [state, setState] = useState<State>("launcher");
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(cfg.email || "");
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [banner, setBanner] = useState<BannerUpdate | null>(null);
  const [error, setError] = useState("");
  const [shot, setShot] = useState<string>("");
  const [tool, setTool] = useState<AnnotateTool>("pen");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [sentTicketId, setSentTicketId] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConfigAndUpdates() {
      const projectSelectors = await fetchProjectSelectors(cfg);
      if (!cancelled && projectSelectors.length) {
        cfg.selectors = uniqueSelectors(cfg.selectors, projectSelectors);
      }
      try {
        const update = await fetchUpdates(cfg);
        if (cancelled || !update) return;
        setBanner(update);
        setState("banner");
      } catch {
        // ignore poll errors
      }
    }

    loadConfigAndUpdates();
    const onIdentify = () => {
      void loadConfigAndUpdates();
    };
    const onShow = () => {
      setSentTicketId("");
      setError("");
      setShot("");
      setStrokes([]);
      setDraft(null);
      setState("form");
    };
    document.addEventListener("closeloop:identify", onIdentify);
    document.addEventListener("closeloop:show", onShow);
    return () => {
      cancelled = true;
      document.removeEventListener("closeloop:identify", onIdentify);
      document.removeEventListener("closeloop:show", onShow);
    };
  }, [cfg]);

  useEffect(() => {
    if (state !== "form" || shot || capturing) return;
    void captureShot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = previewRef.current;
    if (!canvas || !wrap || !shot) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const width = wrap.clientWidth || 360;
      const height = Math.max(160, Math.round((width * img.naturalHeight) / Math.max(img.naturalWidth, 1)));
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      drawStrokes(ctx, strokes, draft);
    };
    img.src = shot;
  }, [shot, strokes, draft]);

  const host = useMemo(() => {
    const root = document.createElement("div");
    root.id = "closeloop-root";
    document.body.appendChild(root);
    return root;
  }, []);

  useEffect(() => () => host.remove(), [host]);

  async function captureShot() {
    setCapturing(true);
    setError("");
    try {
      const projectSelectors = await fetchProjectSelectors(cfg);
      const selectors = uniqueSelectors(cfg.selectors, projectSelectors);
      cfg.selectors = selectors;
      const next = await maskAndShot(selectors);
      setShot(next);
      setStrokes([]);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screenshot failed");
    } finally {
      setCapturing(false);
    }
  }

  function openForm() {
    setError("");
    setSentTicketId("");
    setShot("");
    setStrokes([]);
    setDraft(null);
    setState("form");
  }

  function pointerPos(e: PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e: PointerEvent) {
    if (tool === "undo") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pointerPos(e, canvas);
    setDraft(startStroke(tool, x, y));
  }

  function onPointerMove(e: PointerEvent) {
    if (!drawing.current || !draft) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = pointerPos(e, canvas);
    setDraft(moveStroke(draft, x, y));
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (draft) {
      setStrokes((prev) => [...prev, draft]);
      setDraft(null);
    }
  }

  function undoStroke() {
    setStrokes((prev) => prev.slice(0, -1));
    setDraft(null);
  }

  async function send() {
    if (!shot) {
      setError("Screenshot missing — tap Retake");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const canvas = canvasRef.current;
      const annotated = await compositeAnnotatedPng(
        shot,
        strokes,
        canvas?.width || 360,
        canvas?.height || 200,
      );
      const data = await submitReport(cfg, {
        type,
        message,
        email,
        screenshot: annotated,
      });
      setSentTicketId(data.ticket_id || "");
      setState("sent");
      setMessage("");
      setShot("");
      setStrokes([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: Inter, Geist, system-ui, sans-serif; }
    .btn { background:#171717; color:#fff; border:0; border-radius:8px; padding:10px 14px; cursor:pointer; font-size:13px; font-weight:500; }
    .btn:disabled { opacity:.5; cursor:default; }
    .fab {
      position:fixed; right:20px; bottom:20px; z-index:2147483000;
      display:inline-flex; align-items:center; gap:8px;
      background:#171717; color:#fff; border:0; border-radius:999px;
      padding:11px 16px; cursor:pointer; font-size:13px; font-weight:500;
      box-shadow:0 8px 24px rgba(0,0,0,.18);
    }
    .scrim {
      position:fixed; inset:0; background:rgba(23,23,23,.28); z-index:2147482990;
    }
    .panel {
      position:fixed; right:20px; bottom:76px; width:min(400px, calc(100vw - 24px));
      max-height:calc(100vh - 100px); overflow:auto;
      background:#fff; border:1px solid #1717171f; border-radius:16px;
      box-shadow:0 12px 40px rgba(0,0,0,.14); padding:16px; z-index:2147483000;
    }
    .title { font-size:15px; font-weight:600; color:#171717; margin:0 0 4px; }
    .sub { color:#737373; font-size:12px; margin:0 0 12px; }
    .row { display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; align-items:center; }
    .chip { border:1px solid #1717171f; background:#fafafa; border-radius:999px; padding:6px 10px; font-size:12px; cursor:pointer; text-transform:capitalize; }
    .chip.on { background:#171717; color:#fff; }
    .shot-head { display:flex; justify-content:space-between; align-items:center; margin:4px 0 8px; }
    .shot-label { font-size:12px; font-weight:600; color:#171717; }
    .link { background:none; border:0; color:#2563eb; font-size:12px; font-weight:500; cursor:pointer; padding:0; }
    .preview {
      position:relative; width:100%; border-radius:12px; overflow:hidden;
      border:1px solid #17171714; background:#f5f5f5; min-height:160px;
    }
    .preview canvas { display:block; width:100%; height:auto; cursor:crosshair; touch-action:none; }
    .preview .empty { padding:28px 12px; text-align:center; color:#a3a3a3; font-size:12px; }
    .dock {
      position:absolute; left:50%; bottom:10px; transform:translateX(-50%);
      display:flex; gap:4px; padding:4px; background:#171717; border-radius:999px;
    }
    .dock button {
      width:32px; height:32px; border:0; border-radius:999px; background:transparent;
      color:#fff; cursor:pointer; display:grid; place-items:center;
    }
    .dock button.on { background:#404040; }
    .note { color:#a3a3a3; font-size:11px; margin:8px 0 10px; }
    textarea, input { width:100%; border:1px solid #1717171f; border-radius:10px; padding:10px; font-size:13px; margin-bottom:10px; }
    .muted { color:#737373; font-size:12px; }
    .err { color:#da314a; font-size:12px; margin-bottom:8px; }
    .pill {
      display:inline-flex; align-items:center; gap:6px;
      margin:10px 0 14px; padding:6px 10px; border-radius:999px;
      background:#f5f5f5; border:1px solid #17171714;
      font-size:12px; font-weight:500; color:#171717;
    }
    .powered { margin-top:12px; text-align:center; color:#a3a3a3; font-size:11px; }
    .banner {
      position:fixed; left:50%; top:24px; transform:translateX(-50%);
      display:flex; align-items:center; gap:14px;
      width:min(560px, calc(100vw - 32px));
      padding:14px 16px; background:#fff;
      border:1px solid #17171714; border-radius:12px;
      box-shadow:0 16px 40px #1717171f, 0 4px 8px #1717170f;
      z-index:2147483000;
    }
    .banner-icon {
      width:36px; height:36px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      background:#f0fdf4; border-radius:999px;
    }
    .banner-text { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
    .banner-title { font-size:14px; font-weight:600; color:#171717; }
    .banner-body { font-size:13px; line-height:19px; color:#737373; }
    .banner-meta { font-size:11.5px; color:#a3a3a3; }
    .banner-x {
      width:16px; height:16px; flex-shrink:0; padding:0; border:0;
      background:transparent; cursor:pointer; color:#a3a3a3;
    }
  `;

  const reportMeta = banner
    ? `Report #${shortId(banner.ticketId) || "—"} · from the ${banner.projectName} team`
    : "";

  const ui = (
    <>
      <style>{css}</style>
      {state === "launcher" && (
        <button class="fab" type="button" onClick={openForm}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Report a problem
        </button>
      )}
      {state === "form" && (
        <>
          <div class="scrim" onClick={() => setState("launcher")} />
          <div class="panel">
            <p class="title">Send feedback</p>
            <p class="sub">Screenshot is attached automatically. Annotate before you send.</p>
            <div class="row">
              {(["bug", "idea", "question"] as const).map((t) => (
                <button type="button" class={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>
                  {t}
                </button>
              ))}
            </div>

            <div class="shot-head">
              <span class="shot-label">Screenshot</span>
              <button type="button" class="link" disabled={capturing || busy} onClick={() => void captureShot()}>
                {capturing ? "Capturing…" : "Retake"}
              </button>
            </div>
            <div class="preview" ref={previewRef}>
              {!shot && <div class="empty">{capturing ? "Capturing page…" : "No screenshot yet"}</div>}
              {shot && (
                <>
                  <canvas
                    ref={canvasRef}
                    onPointerDown={(e) => onPointerDown(e as unknown as PointerEvent)}
                    onPointerMove={(e) => onPointerMove(e as unknown as PointerEvent)}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  />
                  <div class="dock" role="toolbar" aria-label="Annotate">
                    <button type="button" class={tool === "pen" ? "on" : ""} title="Draw" onClick={() => setTool("pen")}>
                      ✎
                    </button>
                    <button type="button" class={tool === "rect" ? "on" : ""} title="Box" onClick={() => setTool("rect")}>
                      ▢
                    </button>
                    <button type="button" class={tool === "mask" ? "on" : ""} title="Mask" onClick={() => setTool("mask")}>
                      ▮
                    </button>
                    <button type="button" title="Undo" onClick={undoStroke}>
                      ↶
                    </button>
                  </div>
                </>
              )}
            </div>
            <p class="note">Sensitive selectors are blurred before capture. Use mask for anything left.</p>

            <textarea
              rows={3}
              placeholder="What happened?"
              value={message}
              onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
            />
            <input
              placeholder="Email (optional)"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            />
            {error && <div class="err">{error}</div>}
            <div class="row">
              <button class="btn" disabled={busy || capturing || !message || !shot} onClick={() => void send()}>
                {busy ? "Sending…" : "Send report"}
              </button>
              <button
                type="button"
                class="chip"
                onClick={() => {
                  setState("launcher");
                  setDraft(null);
                }}
              >
                Cancel
              </button>
            </div>
            <div class="powered">Powered by Saidloop</div>
          </div>
        </>
      )}
      {state === "sent" && (
        <div class="panel">
          <p class="title">Report sent</p>
          <p class="muted">Thanks — we attached a screenshot and context for your team.</p>
          {sentTicketId && <div class="pill">Report #{shortId(sentTicketId)}</div>}
          <button
            class="btn"
            onClick={() => {
              setState("launcher");
              setSentTicketId("");
            }}
          >
            Done
          </button>
          <div class="powered">Powered by Saidloop</div>
        </div>
      )}
      {state === "banner" && banner && (
        <div class="banner" role="status">
          <div class="banner-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div class="banner-text">
            <div class="banner-title">Your report was fixed</div>
            <div class="banner-body">{banner.body}</div>
            <div class="banner-meta">{reportMeta}</div>
          </div>
          <button
            type="button"
            class="banner-x"
            aria-label="Dismiss"
            onClick={() => {
              setBanner(null);
              setState("launcher");
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );

  const shadowHost = useMemo(() => {
    const el = document.createElement("div");
    host.appendChild(el);
    const shadow = el.attachShadow({ mode: "open" });
    const mount = document.createElement("div");
    shadow.appendChild(mount);
    return mount;
  }, [host]);

  useEffect(() => {
    render(ui, shadowHost);
  });

  return null;
}

const cfg = readConfig();
if (cfg.key) {
  const mount = document.createElement("div");
  document.documentElement.appendChild(mount);
  render(<Widget cfg={cfg} />, mount);

  const api = {
    show() {
      document.dispatchEvent(new CustomEvent("closeloop:show"));
    },
    identify(data: { userId?: string; email?: string; appVersion?: string }) {
      Object.assign(cfg, {
        userId: data.userId || cfg.userId,
        email: data.email || cfg.email,
        appVersion: data.appVersion || cfg.appVersion,
      });
      fetch(`${cfg.api}/v1/ingest/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Closeloop-Key": cfg.key },
        body: JSON.stringify({
          user_id: cfg.userId,
          email: cfg.email,
          app_version: cfg.appVersion,
        }),
      }).catch(() => undefined);
      document.dispatchEvent(new CustomEvent("closeloop:identify"));
    },
  };
  (window as any).Saidloop = api;
  (window as any).Closeloop = api;
}
