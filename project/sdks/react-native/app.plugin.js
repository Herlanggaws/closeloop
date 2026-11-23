// Expo config plugin: `plugins: ["@saidloop/react-native"]` in app.json.
// Saidloop needs Android minSdk 24 and iOS 15; everything else autolinks.
const { withGradleProperties, withPodfileProperties } = (() => {
  try {
    return require("@expo/config-plugins");
  } catch {
    return {};
  }
})();

function withSaidloop(config) {
  if (!withGradleProperties) return config;
  config = withGradleProperties(config, (c) => {
    const props = c.modResults.filter((p) => p.key !== "android.minSdkVersion");
    const current = c.modResults.find((p) => p.key === "android.minSdkVersion");
    const min = Math.max(24, Number(current?.value ?? 0));
    props.push({ type: "property", key: "android.minSdkVersion", value: String(min) });
    c.modResults = props;
    return c;
  });
  config = withPodfileProperties(config, (c) => {
    // Only raise an explicit lower target; unset means Expo's default, which is already >= 15.
    const raw = c.modResults["ios.deploymentTarget"];
    if (raw != null && parseFloat(raw) < 15) c.modResults["ios.deploymentTarget"] = "15.0";
    return c;
  });
  return config;
}

module.exports = withSaidloop;
