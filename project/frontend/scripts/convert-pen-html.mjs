#!/usr/bin/env node
/**
 * Convert pen.dev html-tailwind exports into React TSX screen components.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const exportDir = path.join(root, "src/design-exports");
const outDir = path.join(root, "src/design-screens");

const ATTR = [
  ["class=", "className="],
  ["stroke-width=", "strokeWidth="],
  ["stroke-linecap=", "strokeLinecap="],
  ["stroke-linejoin=", "strokeLinejoin="],
  ["stroke-miterlimit=", "strokeMiterlimit="],
  ["fill-rule=", "fillRule="],
  ["clip-rule=", "clipRule="],
  ["clip-path=", "clipPath="],
  ["fill-opacity=", "fillOpacity="],
  ["stroke-opacity=", "strokeOpacity="],
  ["font-family=", "fontFamily="],
  ["font-size=", "fontSize="],
  ["font-weight=", "fontWeight="],
  ["letter-spacing=", "letterSpacing="],
  ["stop-color=", "stopColor="],
  ["stop-opacity=", "stopOpacity="],
  ["xlink:href=", "xlinkHref="],
  ["xmlns:xlink=", "xmlnsXlink="],
  ["tabindex=", "tabIndex="],
  ["autocomplete=", "autoComplete="],
  ["crossorigin", "crossOrigin"],
];

const FONT_REPLACEMENTS = [
  [/font-\[Geist,system-ui,sans-serif\]/g, "font-ds-sans"],
  [/font-\['Geist_Mono',system-ui,sans-serif\]/g, "font-ds-mono"],
  [/font-\["Geist_Mono",system-ui,sans-serif\]/g, "font-ds-mono"],
  [/font-\[Inter,system-ui,sans-serif\]/g, "font-ds-ui"],
];

const VOID_TAGS = ["path", "circle", "rect", "line", "polyline", "polygon", "stop", "use", "ellipse", "img", "br", "hr", "input"];

function toComponentName(fileBase) {
  return fileBase
    .replace(/^S-\d+-/, "")
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

function htmlToJsx(body) {
  let s = body;
  for (const [a, b] of ATTR) s = s.split(a).join(b);
  for (const [pat, rep] of FONT_REPLACEMENTS) s = s.replace(pat, rep);
  s = s.split("[box-sizing:content-box]").join("box-border");
  s = s.replace(/\sbg-\[#[0-9A-Fa-f]+\] overflow-hidden"/, (m) => m.replace(" overflow-hidden", ""));
  s = s.replace(/\soverflow-hidden"/, '"');

  s = s.replace(/style="([^"]*)"/g, (_, css) => {
    const parts = {};
    for (const piece of css.split(";")) {
      const t = piece.trim();
      if (!t || !t.includes(":")) continue;
      const [k, ...rest] = t.split(":");
      const ck = k
        .trim()
        .split("-")
        .map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join("");
      parts[ck] = rest.join(":").trim();
    }
    const obj = Object.entries(parts)
      .map(([k, v]) => `${k}: "${v}"`)
      .join(", ");
    return `style={{${obj}}}`;
  });

  for (const tag of VOID_TAGS) {
    const re1 = new RegExp(`<${tag}([^>]*?)>\\s*</${tag}>`, "gi");
    s = s.replace(re1, `<${tag}$1 />`);
    const re2 = new RegExp(`<${tag}([^>]*?[^/])>`, "gi");
    s = s.replace(re2, `<${tag}$1 />`);
  }

  s = s.replace(/\breadonly\b/g, "readOnly");
  return s;
}

function convertFile(file) {
  const html = fs.readFileSync(file, "utf8");
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!m) throw new Error(`No body in ${file}`);
  const jsx = htmlToJsx(m[1].trim());
  const base = path.basename(file, ".html");
  const name = toComponentName(base);
  const out = path.join(outDir, `${name}.tsx`);
  const code = `/* Auto-converted from closeloop.pen export: ${base} */\nexport function ${name}() {\n  return (\n    <>\n${jsx}\n    </>\n  );\n}\n`;
  fs.writeFileSync(out, code);
  return { base, name, out, bytes: code.length };
}

fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(exportDir).filter((f) => f.endsWith(".html")).sort();
const results = [];
for (const f of files) {
  try {
    results.push(convertFile(path.join(exportDir, f)));
    console.log("ok", f);
  } catch (e) {
    console.error("fail", f, e.message);
  }
}

const index = results
  .map((r) => `export { ${r.name} } from "./${r.name}";`)
  .join("\n");
fs.writeFileSync(path.join(outDir, "index.ts"), index + "\n");
console.log(`converted ${results.length} screens`);
