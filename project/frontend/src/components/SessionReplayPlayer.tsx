"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
};

async function loadReplayEvents(url: string): Promise<unknown[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`replay fetch failed (${res.status})`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let text: string;
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("gzip replay needs DecompressionStream");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("invalid replay payload");
  return parsed;
}

export function SessionReplayPlayer({ url }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let player: { $destroy?: () => void } | null = null;

    async function mount() {
      setLoading(true);
      setError("");
      try {
        const events = await loadReplayEvents(url);
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = "";
        const { default: rrwebPlayer } = await import("rrweb-player");
        await import("rrweb-player/dist/style.css");
        if (cancelled || !hostRef.current) return;
        player = new rrwebPlayer({
          target: hostRef.current,
          props: {
            events: events as never[],
            width: hostRef.current.clientWidth || 640,
            height: 360,
            autoPlay: false,
            showController: true,
          },
        }) as { $destroy?: () => void };
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load replay");
          setLoading(false);
        }
      }
    }

    void mount();
    return () => {
      cancelled = true;
      try {
        player?.$destroy?.();
      } catch {
        // ignore
      }
    };
  }, [url]);

  return (
    <div className="overflow-hidden rounded-xl border border-[#17171714] bg-[#FAFAFA]">
      {loading && (
        <div className="grid h-[360px] place-items-center font-ds-ui text-[13px] text-[#A3A3A3]">
          Loading session replay…
        </div>
      )}
      {error && (
        <div className="grid h-[120px] place-items-center px-4 font-ds-ui text-[13px] text-[#DA314A]">
          {error}
        </div>
      )}
      <div ref={hostRef} className={loading || error ? "hidden" : "w-full"} />
    </div>
  );
}
