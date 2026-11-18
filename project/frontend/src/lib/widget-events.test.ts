import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EventEmitter } from "node:events";
import { CLOSELOOP_SUBMITTED_EVENT } from "./widget-events.ts";

describe("widget events", () => {
  it("uses a stable submitted event name for inbox refresh", () => {
    assert.equal(CLOSELOOP_SUBMITTED_EVENT, "closeloop:submitted");
  });

  it("can fan out submitted detail through an EventTarget-like emitter", () => {
    const bus = new EventEmitter();
    const seen: unknown[] = [];
    const onSubmitted = (detail: unknown) => seen.push(detail);
    bus.on(CLOSELOOP_SUBMITTED_EVENT, onSubmitted);
    bus.emit(CLOSELOOP_SUBMITTED_EVENT, { ticket_id: "t1" });
    assert.deepEqual(seen, [{ ticket_id: "t1" }]);
  });
});
