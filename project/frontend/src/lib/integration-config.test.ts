import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asConfig, parseIntegrationConfig } from "./integration-config.ts";

describe("parseIntegrationConfig", () => {
  it("parses JSON strings and objects", () => {
    assert.deepEqual(parseIntegrationConfig('{"a":1}'), { a: 1 });
    assert.deepEqual(parseIntegrationConfig({ a: 1 }), { a: 1 });
    assert.deepEqual(parseIntegrationConfig("not-json"), {});
    assert.deepEqual(parseIntegrationConfig(null), {});
  });
});

describe("asConfig", () => {
  it("keeps string fields and coerces numeric installation_id", () => {
    const config = asConfig({
      installation_id: 183297175,
      account_login: "Herlanggaws",
      repo_full_name: "Herlanggaws/closeloop",
      default_branch: "main",
      empty: "",
      nested: { skip: true },
    });
    assert.deepEqual(config, {
      installation_id: "183297175",
      account_login: "Herlanggaws",
      repo_full_name: "Herlanggaws/closeloop",
      default_branch: "main",
    });
  });

  it("reads installation_id from a JSON string payload", () => {
    const config = asConfig(
      JSON.stringify({ installation_id: 42, repo_full_name: "acme/app" }),
    );
    assert.equal(config.installation_id, "42");
    assert.equal(config.repo_full_name, "acme/app");
  });
});
