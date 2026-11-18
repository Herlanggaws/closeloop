export type AnnotateTool = "pen" | "rect" | "mask" | "undo";

export type Stroke =
  | { kind: "pen"; color: string; width: number; points: { x: number; y: number }[] }
  | { kind: "rect"; color: string; width: number; x: number; y: number; w: number; h: number }
  | { kind: "mask"; x: number; y: number; w: number; h: number };

const INK = "#DA314A";

export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  draft: Stroke | null,
) {
  const all = draft ? [...strokes, draft] : strokes;
  for (const stroke of all) {
    if (stroke.kind === "pen") {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      continue;
    }

    const x = Math.min(stroke.x, stroke.x + stroke.w);
    const y = Math.min(stroke.y, stroke.y + stroke.h);
    const w = Math.abs(stroke.w);
    const h = Math.abs(stroke.h);

    if (stroke.kind === "mask") {
      ctx.fillStyle = "rgba(23,23,23,0.55)";
      ctx.fillRect(x, y, w, h);
      continue;
    }

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.strokeRect(x, y, w, h);
  }
}

export async function compositeAnnotatedPng(
  baseDataUrl: string,
  strokes: Stroke[],
  displayWidth: number,
  displayHeight: number,
): Promise<string> {
  if (strokes.length === 0) return baseDataUrl;

  const img = await loadImage(baseDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return baseDataUrl;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const scaleX = canvas.width / Math.max(displayWidth, 1);
  const scaleY = canvas.height / Math.max(displayHeight, 1);

  const scaled = strokes.map((stroke) => scaleStroke(stroke, scaleX, scaleY));
  drawStrokes(ctx, scaled, null);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function scaleStroke(stroke: Stroke, sx: number, sy: number): Stroke {
  if (stroke.kind === "pen") {
    return {
      kind: "pen",
      color: stroke.color,
      width: stroke.width * ((sx + sy) / 2),
      points: stroke.points.map((p) => ({ x: p.x * sx, y: p.y * sy })),
    };
  }
  if (stroke.kind === "rect") {
    return {
      kind: "rect",
      color: stroke.color,
      width: stroke.width * ((sx + sy) / 2),
      x: stroke.x * sx,
      y: stroke.y * sy,
      w: stroke.w * sx,
      h: stroke.h * sy,
    };
  }
  return {
    kind: "mask",
    x: stroke.x * sx,
    y: stroke.y * sy,
    w: stroke.w * sx,
    h: stroke.h * sy,
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load screenshot"));
    img.src = src;
  });
}

export function startStroke(
  tool: AnnotateTool,
  x: number,
  y: number,
): Stroke | null {
  if (tool === "pen") {
    return { kind: "pen", color: INK, width: 3, points: [{ x, y }] };
  }
  if (tool === "rect") {
    return { kind: "rect", color: INK, width: 2, x, y, w: 0, h: 0 };
  }
  if (tool === "mask") {
    return { kind: "mask", x, y, w: 0, h: 0 };
  }
  return null;
}

export function moveStroke(stroke: Stroke, x: number, y: number): Stroke {
  if (stroke.kind === "pen") {
    return { ...stroke, points: [...stroke.points, { x, y }] };
  }
  return { ...stroke, w: x - stroke.x, h: y - stroke.y };
}
