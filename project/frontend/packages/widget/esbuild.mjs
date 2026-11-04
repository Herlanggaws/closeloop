import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.resolve(__dirname, "../../public/w.js");
const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: [path.resolve(__dirname, "src/index.tsx")],
  bundle: true,
  outfile,
  format: "iife",
  target: ["es2019"],
  minify: !watch,
  sourcemap: watch,
  jsx: "automatic",
  jsxImportSource: "preact",
  define: { "process.env.NODE_ENV": watch ? '"development"' : '"production"' },
});

if (watch) {
  await ctx.watch();
  console.log("watching widget →", outfile);
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("built", outfile);
}
