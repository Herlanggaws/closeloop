import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  areToursDisabled,
  disableAllTours,
  getTourState,
  isTourSeen,
  markTourSeen,
  resetTourState,
  setTourStorageForTests,
  tourStorageKey,
} from "./tour-store.ts";
import {
  availableTourSteps,
  canStartTour,
  tourFooterLabels,
  type TourStep,
} from "./tours.ts";

const USER = "user-test-1";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

beforeEach(() => {
  setTourStorageForTests(memoryStorage());
});

afterEach(() => {
  resetTourState(USER);
  setTourStorageForTests(null);
  if (typeof document !== "undefined") {
    document.body.innerHTML = "";
  }
});

describe("tour side defaults", () => {
  it("keeps MCP steps off the cramped right edge", async () => {
    const { TOURS } = await import("./tours.ts");
    assert.equal(TOURS.mcp.steps[0].side, "below");
    assert.equal(TOURS.mcp.steps[1].side, "below");
    assert.equal(TOURS.mcp.steps[2].side, "above");
  });
});

describe("tourFooterLabels", () => {
  it("labels the first step of a multi-step tour", () => {
    const footer = tourFooterLabels(0, 3);
    assert.equal(footer.kind, "first");
    assert.equal(footer.counter, "1 of 3");
    assert.equal(footer.secondary, "Skip tour");
    assert.equal(footer.primary, "Next");
    assert.equal(footer.showArrow, true);
  });

  it("labels middle steps", () => {
    const footer = tourFooterLabels(1, 3);
    assert.equal(footer.kind, "middle");
    assert.equal(footer.counter, null);
    assert.equal(footer.secondary, "Back");
    assert.equal(footer.primary, "Next");
    assert.equal(footer.showArrow, true);
  });

  it("labels the last step", () => {
    const footer = tourFooterLabels(2, 3);
    assert.equal(footer.kind, "last");
    assert.equal(footer.counter, null);
    assert.equal(footer.secondary, "Back");
    assert.equal(footer.primary, "Done");
    assert.equal(footer.showArrow, false);
  });

  it("labels a single-step tour", () => {
    const footer = tourFooterLabels(0, 1);
    assert.equal(footer.kind, "single");
    assert.equal(footer.counter, null);
    assert.equal(footer.secondary, "Turn off tips");
    assert.equal(footer.primary, "Got it");
    assert.equal(footer.showArrow, false);
  });
});

describe("tour store persistence", () => {
  it("persists seen tours per user", () => {
    assert.equal(isTourSeen(USER, "inbox"), false);
    markTourSeen(USER, "inbox");
    assert.equal(isTourSeen(USER, "inbox"), true);
    assert.deepEqual(getTourState(USER).seen, ["inbox"]);
    assert.equal(tourStorageKey(USER), `saidloop.tours.v1.${USER}`);
  });

  it("Turn off tips disables every tour", () => {
    disableAllTours(USER);
    assert.equal(areToursDisabled(USER), true);
    assert.equal(isTourSeen(USER, "inbox"), true);
    assert.equal(isTourSeen(USER, "mcp"), true);
  });
});

describe("availableTourSteps", () => {
  it("skips steps whose targets are missing", () => {
    const steps: TourStep[] = [
      {
        target: "inbox-filters",
        side: "below",
        tag: "INBOX",
        title: "Filters",
        body: "Filter bar",
      },
      {
        target: "inbox-bulk",
        side: "above",
        tag: "INBOX",
        title: "Bulk",
        body: "Bulk bar",
      },
    ];

    const previous = (globalThis as { document?: unknown }).document;
    (globalThis as { document: { querySelector: (sel: string) => unknown } }).document = {
      querySelector(sel: string) {
        return sel === '[data-tour="inbox-filters"]' ? { ok: true } : null;
      },
    };
    try {
      const available = availableTourSteps(steps);
      assert.equal(available.length, 1);
      assert.equal(available[0].target, "inbox-filters");
    } finally {
      if (previous === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = previous;
      }
    }
  });

  it("does not start when every target is missing", () => {
    const tour = {
      id: "inbox",
      routes: ["/app/inbox"],
      steps: [
        {
          target: "missing",
          side: "below" as const,
          tag: "INBOX",
          title: "Missing",
          body: "Gone",
        },
      ],
    };
    assert.equal(
      canStartTour(tour, {
        userId: USER,
        isSeen: () => false,
        isDisabled: false,
      }),
      false,
    );
  });

  it("Turn off tips suppresses canStartTour", () => {
    disableAllTours(USER);
    const tour = {
      id: "inbox",
      routes: ["/app/inbox"],
      steps: [
        {
          target: "inbox-filters",
          side: "below" as const,
          tag: "INBOX",
          title: "Filters",
          body: "Filter bar",
        },
      ],
    };
    if (typeof document !== "undefined") {
      document.body.innerHTML = `<div data-tour="inbox-filters"></div>`;
    }
    assert.equal(
      canStartTour(tour, {
        userId: USER,
        isSeen: (id) => isTourSeen(USER, id),
        isDisabled: areToursDisabled(USER),
      }),
      false,
    );
  });
});
