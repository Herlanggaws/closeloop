import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { domToPng } from "modern-screenshot";

type State = "launcher" | "form" | "sent" | "banner";

type Config = {
  key: string;
  api: string;
  userId?: string;
  email?: string;
  appVersion?: string;
  selectors: string[];
};

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
    selectors: (el?.dataset.mask || "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

async function maskAndShot(selectors: string[]) {
  const nodes: HTMLElement[] = [];
  for (const sel of [".closeloop-mask", "[data-closeloop-mask]", ...selectors]) {
    document.querySelectorAll(sel).forEach((n) => nodes.push(n as HTMLElement));
  }
  const prev = nodes.map((n) => n.style.filter);
  nodes.forEach((n) => (n.style.filter = "blur(8px)"));
  try {
    return await domToPng(document.body, { scale: 1, quality: 0.9 });
  } finally {
    nodes.forEach((n, i) => (n.style.filter = prev[i]));
  }
}

function dataURLtoBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function submitReport(cfg: Config, payload: { type: string; message: string; email: string }) {
  const screenshot = await maskAndShot(cfg.selectors);
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
      context: {
        url: location.href,
        userAgent: navigator.userAgent,
        viewport: { w: innerWidth, h: innerHeight },
      },
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (data.upload_url) {
    await fetch(data.upload_url, {
      method: "PUT",
      body: dataURLtoBlob(screenshot),
    });
  }
  await fetch(`${cfg.api}/v1/ingest/reports/${data.report_id}/complete`, {
    method: "POST",
    headers: { "X-Closeloop-Key": cfg.key },
  });
  return data;
}

function Widget({ cfg }: { cfg: Config }) {
  const [state, setState] = useState<State>("launcher");
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(cfg.email || "");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cfg.userId && !cfg.email) return;
    const q = new URLSearchParams();
    if (cfg.userId) q.set("user_id", cfg.userId);
    if (cfg.email) q.set("email", cfg.email);
    fetch(`${cfg.api}/v1/ingest/updates?${q}`, {
      headers: { "X-Closeloop-Key": cfg.key },
    })
      .then((r) => r.json())
      .then((d) => {
        const u = d.updates?.[0];
        if (u?.body) {
          setBanner(u.body);
          setState("banner");
        }
      })
      .catch(() => undefined);
  }, [cfg]);

  const host = useMemo(() => {
    const root = document.createElement("div");
    root.id = "closeloop-root";
    document.body.appendChild(root);
    return root;
  }, []);

  useEffect(() => () => host.remove(), [host]);

  async function send() {
    setBusy(true);
    setError("");
    try {
      await submitReport(cfg, { type, message, email });
      setState("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: Inter, Geist, system-ui, sans-serif; }
    .btn { background:#171717; color:#fff; border:0; border-radius:999px; padding:10px 14px; cursor:pointer; font-size:13px; }
    .fab { position:fixed; right:20px; bottom:20px; z-index:2147483000; }
    .panel { position:fixed; right:20px; bottom:76px; width:340px; background:#fff; border:1px solid #1717171f; border-radius:16px; box-shadow:0 12px 40px rgba(0,0,0,.12); padding:16px; z-index:2147483000; }
    .title { font-size:15px; font-weight:600; color:#171717; margin:0 0 12px; }
    .row { display:flex; gap:6px; margin-bottom:10px; }
    .chip { border:1px solid #1717171f; background:#fafafa; border-radius:999px; padding:6px 10px; font-size:12px; cursor:pointer; }
    .chip.on { background:#171717; color:#fff; }
    textarea, input { width:100%; border:1px solid #1717171f; border-radius:10px; padding:10px; font-size:13px; margin-bottom:10px; }
    .muted { color:#737373; font-size:12px; }
    .err { color:#da314a; font-size:12px; margin-bottom:8px; }
    .banner { position:fixed; left:50%; transform:translateX(-50%); bottom:24px; background:#171717; color:#fff; border-radius:12px; padding:12px 16px; z-index:2147483000; max-width:480px; }
  `;

  const ui = (
    <>
      <style>{css}</style>
      {state === "launcher" && (
        <button class="btn fab" onClick={() => setState("form")}>
          Report
        </button>
      )}
      {state === "form" && (
        <div class="panel">
          <p class="title">Send feedback</p>
          <div class="row">
            {(["bug", "idea", "question"] as const).map((t) => (
              <button class={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>
                {t}
              </button>
            ))}
          </div>
          <textarea rows={4} placeholder="What happened?" value={message} onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)} />
          <input placeholder="Email (optional)" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
          {error && <div class="err">{error}</div>}
          <div class="row">
            <button class="btn" disabled={busy || !message} onClick={send}>
              {busy ? "Sending…" : "Send"}
            </button>
            <button class="chip" onClick={() => setState("launcher")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {state === "sent" && (
        <div class="panel">
          <p class="title">Report sent</p>
          <p class="muted">Thanks — we attached a screenshot and context.</p>
          <button class="btn" style={{ marginTop: 12 }} onClick={() => setState("launcher")}>
            Done
          </button>
        </div>
      )}
      {state === "banner" && banner && (
        <div class="banner">
          <strong>Your report was fixed</strong>
          <div class="muted" style={{ color: "#fff", opacity: 0.8, marginTop: 4 }}>
            {banner}
          </div>
          <button class="chip" style={{ marginTop: 8 }} onClick={() => setState("launcher")}>
            Dismiss
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

  (window as any).Closeloop = {
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
    },
  };
}
