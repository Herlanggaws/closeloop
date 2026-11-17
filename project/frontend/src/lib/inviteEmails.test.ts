import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  drainInviteDraft,
  isLikelyEmail,
  mergeInviteEmails,
  normalizeInviteEmail,
  splitInviteEmails,
} from "./inviteEmails.ts";

describe("inviteEmails", () => {
  it("normalizes and splits pasted lists", () => {
    assert.equal(normalizeInviteEmail("  Mirza@Gmail.com "), "mirza@gmail.com");
    assert.deepEqual(splitInviteEmails("a@b.com, c@d.com;e@f.com"), [
      "a@b.com",
      "c@d.com",
      "e@f.com",
    ]);
  });

  it("drains completed chips on delimiter while keeping the trailing fragment", () => {
    assert.deepEqual(drainInviteDraft("mirza@gmail.com,", "delimiter"), {
      completed: ["mirza@gmail.com"],
      remainder: "",
    });
    assert.deepEqual(
      drainInviteDraft("mirza@gmail.com,herlangga.dev@gmail.com", "delimiter"),
      {
        completed: ["mirza@gmail.com"],
        remainder: "herlangga.dev@gmail.com",
      },
    );
    assert.deepEqual(drainInviteDraft("mirza@gmail.com", "delimiter"), {
      completed: [],
      remainder: "mirza@gmail.com",
    });
  });

  it("commits the whole draft on Enter/blur", () => {
    assert.deepEqual(drainInviteDraft("a@b.com, c@d.com", "all"), {
      completed: ["a@b.com", "c@d.com"],
      remainder: "",
    });
  });

  it("merges without duplicates", () => {
    assert.deepEqual(
      mergeInviteEmails(["a@b.com"], ["A@b.com", "c@d.com"]),
      ["a@b.com", "c@d.com"],
    );
  });

  it("recognizes likely emails before space-commit", () => {
    assert.equal(isLikelyEmail("mirza@gmail.com"), true);
    assert.equal(isLikelyEmail("mirza@"), false);
  });
});
