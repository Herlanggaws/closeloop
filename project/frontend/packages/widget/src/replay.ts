import { record } from "rrweb";

const BUFFER_MS = 2 * 60 * 1000;

type RrwebEvent = { timestamp: number; [key: string]: unknown };

let events: RrwebEvent[] = [];
let stopFn: (() => void) | null = null;
let started = false;

function trimBuffer(now = Date.now()) {
  const cutoff = now - BUFFER_MS;
  while (events.length > 0 && events[0].timestamp < cutoff) {
    events.shift();
  }
}

export function startReplayRecording(opts: {
  maskSelectors: string[];
  maskTextInputs: boolean;
}) {
  if (started) return;
  started = true;
  events = [];

  const maskTextSelector = [
    ...(opts.maskTextInputs
      ? [
          "input",
          "textarea",
          "[contenteditable]",
        ]
      : ["input[type=password]", "input[autocomplete^=cc-]"]),
    ...opts.maskSelectors,
    ".closeloop-mask",
    "[data-closeloop-mask]",
  ].join(",");

  stopFn = record({
    emit(event) {
      events.push(event as RrwebEvent);
      trimBuffer(event.timestamp);
    },
    maskAllInputs: true,
    maskTextSelector,
    blockClass: "closeloop-block",
    ignoreClass: "closeloop-ignore",
  }) as unknown as (() => void) | undefined || null;

  // rrweb record may return stop function directly
  if (typeof stopFn !== "function") {
    stopFn = null;
  }
}

export function stopReplayRecording() {
  if (stopFn) {
    try {
      stopFn();
    } catch {
      // ignore
    }
  }
  stopFn = null;
  started = false;
}

export function snapshotReplayEvents(): RrwebEvent[] {
  trimBuffer();
  return events.slice();
}

export async function gzipEventsBase64(list: RrwebEvent[]): Promise<string> {
  const json = JSON.stringify(list);
  if (typeof CompressionStream === "undefined") {
    return btoa(unescape(encodeURIComponent(json)));
  }
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return bytesToBase64(new Uint8Array(buf));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
