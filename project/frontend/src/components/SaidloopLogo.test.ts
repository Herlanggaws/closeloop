import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";
import { SAIDLOOP_MARK_PATH } from "./SaidloopLogo.tsx";

describe("SaidloopLogo mark", () => {
  it("exports the Brand Guidelines open-loop path", () => {
    assert.ok(SAIDLOOP_MARK_PATH.startsWith("M"));
    assert.match(SAIDLOOP_MARK_PATH, /A11 11 0 1 0/);
    assert.match(SAIDLOOP_MARK_PATH, /A5\.5 5\.5 0 1 1/);
  });
});

describe("Saidloop brand assets", () => {
  const root = join(process.cwd(), "public", "brand");
  const app = join(process.cwd(), "src", "app");

  for (const file of [
    "saidloop-logo.png",
    "saidloop-logo-on-dark.png",
    "saidloop-mark.png",
    "saidloop-mark-on-dark.png",
  ]) {
    it(`ships ${file}`, () => {
      assert.ok(existsSync(join(root, file)), file);
    });
  }

  for (const file of ["favicon.ico", "icon.png", "apple-icon.png"]) {
    it(`ships app/${file}`, () => {
      assert.ok(existsSync(join(app, file)), file);
    });
  }
});
