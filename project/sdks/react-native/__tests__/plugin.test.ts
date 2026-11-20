jest.mock(
  "@expo/config-plugins",
  () => ({
    withGradleProperties: (config: any, fn: any) => {
      const r = fn({ modResults: config._gradle });
      return { ...config, _gradle: r.modResults };
    },
    withPodfileProperties: (config: any, fn: any) => {
      const r = fn({ modResults: config._pods });
      return { ...config, _pods: r.modResults };
    },
  }),
  { virtual: true },
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withSaidloop = require("../app.plugin.js");

test("raises Android minSdk to 24 but never lowers it", () => {
  const low = withSaidloop({ _gradle: [{ type: "property", key: "android.minSdkVersion", value: "21" }], _pods: {} });
  expect(low._gradle.find((p: any) => p.key === "android.minSdkVersion").value).toBe("24");
  const high = withSaidloop({ _gradle: [{ type: "property", key: "android.minSdkVersion", value: "26" }], _pods: {} });
  expect(high._gradle.find((p: any) => p.key === "android.minSdkVersion").value).toBe("26");
});

test("iOS target is only raised when set below 15", () => {
  expect(withSaidloop({ _gradle: [], _pods: {} })._pods["ios.deploymentTarget"]).toBeUndefined();
  expect(withSaidloop({ _gradle: [], _pods: { "ios.deploymentTarget": "13.4" } })._pods["ios.deploymentTarget"]).toBe("15.0");
  expect(withSaidloop({ _gradle: [], _pods: { "ios.deploymentTarget": "16.4" } })._pods["ios.deploymentTarget"]).toBe("16.4");
});
