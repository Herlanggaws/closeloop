import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInstallSteps,
  buildSnippet,
  isWebInstallMethod,
  methodsForPlatforms,
  pickDefaultMethod,
  platformLabelForMethod,
} from "./widget-install.ts";

describe("methodsForPlatforms", () => {
  it("maps web to the script tab only until npm ships", () => {
    assert.deepEqual(methodsForPlatforms(["web"]), ["script"]);
  });

  it("includes native methods for selected platforms", () => {
    assert.deepEqual(methodsForPlatforms(["android", "ios"]), ["android", "ios", "flutter", "react-native"]);
    assert.deepEqual(methodsForPlatforms(["web", "ios"]), ["script", "ios", "flutter", "react-native"]);
  });

  it("defaults to script when empty", () => {
    assert.deepEqual(methodsForPlatforms([]), ["script"]);
  });
});

describe("pickDefaultMethod", () => {
  it("prefers script when present", () => {
    assert.equal(pickDefaultMethod(["npm", "script", "android"]), "script");
  });

  it("falls back to the first method", () => {
    assert.equal(pickDefaultMethod(["android", "ios"]), "android");
  });
});

describe("platformLabelForMethod", () => {
  it("labels script and npm as Web", () => {
    assert.equal(platformLabelForMethod("script"), "Web");
    assert.equal(platformLabelForMethod("npm"), "Web");
  });

  it("labels react-native in full", () => {
    assert.equal(platformLabelForMethod("react-native"), "React Native");
  });
});

describe("isWebInstallMethod", () => {
  it("treats script and npm as web", () => {
    assert.equal(isWebInstallMethod("script"), true);
    assert.equal(isWebInstallMethod("npm"), true);
    assert.equal(isWebInstallMethod("android"), false);
  });
});

describe("buildInstallSteps", () => {
  it("returns three S-04 steps with tour targets on add and mask", () => {
    const steps = buildInstallSteps("script", "pk_test");
    assert.equal(steps.length, 3);
    assert.equal(steps[0].title, "Add the widget");
    assert.equal(steps[0].tourTarget, "install-script");
    assert.equal(steps[0].fileLabel, "index.html");
    assert.match(steps[0].code, /data-key="pk_test"/);
    assert.equal(steps[1].title, "Identify the user");
    assert.match(steps[1].code, /Saidloop\.identify/);
    assert.equal(steps[2].title, "Mask sensitive elements");
    assert.equal(steps[2].tourTarget, "install-mask");
    assert.match(steps[2].code, /data-closeloop-mask/);
  });

  it("builds an npm init snippet for the add step", () => {
    const [add] = buildInstallSteps("npm", "pk_live");
    assert.match(add.code, /npm install @closeloop\/widget/);
    assert.match(add.code, /Saidloop\.init/);
    assert.match(add.code, /pk_live/);
  });
});

describe("buildSnippet", () => {
  it("keeps the legacy web one-liner for onboarding and docs", () => {
    const snippet = buildSnippet("web", "pk_legacy");
    assert.match(snippet, /<script src=/);
    assert.match(snippet, /data-key="pk_legacy"/);
  });
});

describe("mobile snippets pass the API host", () => {
  it("fills api for every native SDK", async () => {
    const { buildSnippet } = await import("./widget-install.ts");
    for (const p of ["android", "ios", "flutter", "react-native"]) {
      assert.ok(buildSnippet(p, "pk_test").includes("api"), p);
    }
  });
});
