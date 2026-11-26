import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REACT_NATIVE_PUBLISHED, SDK_DEFAULT_API, buildMobileSdkGuides } from "./mobile-sdk.ts";

function guide(id: string, key = "pk_test", api?: string) {
  const g = buildMobileSdkGuides(key, api).find((x) => x.id === id);
  assert.ok(g, `missing guide ${id}`);
  return g;
}

describe("buildMobileSdkGuides", () => {
  it("lists iOS, Android, Flutter, React Native in order", () => {
    assert.deepEqual(
      buildMobileSdkGuides("pk_test").map((g) => g.id),
      ["ios", "android", "flutter", "react-native"],
    );
  });

  it("gives every available platform install, init and show steps with the project key", () => {
    for (const g of buildMobileSdkGuides("pk_live_123")) {
      if (!g.available) continue;
      assert.equal(g.steps.length, 3, g.id);
      assert.match(g.steps[1].code, /pk_live_123/, g.id);
      assert.match(g.steps[2].code, /Saidloop\.show\(\)/, g.id);
      assert.match(g.repoUrl, /^https:\/\/github\.com\/XERV-Project\/saidloop-/, g.id);
    }
  });

  it("uses the published coordinates", () => {
    assert.match(guide("ios").steps[0].code, /github\.com\/XERV-Project\/saidloop-ios/);
    assert.match(guide("ios").steps[0].code, /:tag => '0\.1\.0'/);
    assert.match(guide("android").steps[0].code, /implementation\("com\.saidloop:android:0\.1\.0"\)/);
    assert.match(guide("flutter").steps[0].code, /saidloop_flutter: \^0\.1\.0/);
  });

  it("matches the README init calls", () => {
    assert.match(guide("ios").steps[1].code, /Saidloop\.start\(key: "pk_test"\)/);
    assert.match(guide("android").steps[1].code, /Saidloop\.init\(this, "pk_test"\)/);
    assert.match(guide("flutter").steps[1].code, /await Saidloop\.init\(key: "pk_test"\);/);
  });

  it("omits api for the default host and passes it for self-hosted", () => {
    assert.doesNotMatch(guide("android", "pk_test", SDK_DEFAULT_API).steps[1].code, /api =/);
    assert.match(
      guide("android", "pk_test", "http://localhost:8080").steps[1].code,
      /Saidloop\.init\(this, "pk_test", api = "http:\/\/localhost:8080"\)/,
    );
    assert.match(
      guide("ios", "pk_test", "https://self.example.com/").steps[1].code,
      /api: URL\(string: "https:\/\/self\.example\.com"\)!/,
    );
  });

  it("falls back to a placeholder key", () => {
    assert.match(guide("flutter", "").steps[1].code, /pk_…/);
  });

  it("hides the React Native install command until the npm package is published", () => {
    const rn = guide("react-native");
    assert.equal(rn.available, REACT_NATIVE_PUBLISHED);
    if (!REACT_NATIVE_PUBLISHED) {
      assert.equal(rn.steps.length, 0);
      assert.equal(rn.repoUrl, "https://github.com/XERV-Project/saidloop-react-native");
    }
  });
});
