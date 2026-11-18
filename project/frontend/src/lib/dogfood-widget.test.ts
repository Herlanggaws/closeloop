import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOGFOOD_WIDGET_API,
  DOGFOOD_WIDGET_KEY,
  DOGFOOD_WIDGET_SRC,
  isDogfoodWidgetEnabled,
} from "./dogfood-widget.ts";

describe("dogfood widget", () => {
  it("points at production Saidloop script, key, and API", () => {
    assert.equal(DOGFOOD_WIDGET_SRC, "https://saidloop.com/w.js");
    assert.equal(DOGFOOD_WIDGET_KEY, "pk_3e71e4db-b8b5-4896-ab7b-23d6f7521d62");
    assert.equal(DOGFOOD_WIDGET_API, "https://api.saidloop.com");
  });

  it("is enabled by default", () => {
    assert.equal(isDogfoodWidgetEnabled(), true);
  });
});
