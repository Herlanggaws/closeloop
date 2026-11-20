const mockCalls: { method: string; args: unknown[] }[] = [];
const mockNative = Object.fromEntries(
  ["start", "identify", "setMaskRects", "show"].map((m) => [
    m,
    (...args: unknown[]) => {
      mockCalls.push({ method: m, args });
      return Promise.resolve();
    },
  ]),
);

jest.mock(
  "react-native",
  () => ({ NativeModules: { Saidloop: mockNative }, View: "View" }),
  { virtual: true },
);

// Required after the mock is set up (imports are hoisted above it).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Saidloop, masks } = require("../src/index") as typeof import("../src/index");

beforeEach(() => {
  mockCalls.length = 0;
  masks.reset();
});

test("init forwards key, api and defaults", async () => {
  await Saidloop.init({ key: "pk_test", api: "http://localhost:8080" });
  expect(mockCalls).toEqual([
    { method: "start", args: [{ key: "pk_test", api: "http://localhost:8080", shakeToReport: true, maskTextInputs: true }] },
  ]);
});

test("init rejects secret-looking keys", () => {
  expect(() => Saidloop.init({ key: "cl_mcp_secret" })).toThrow("public key");
});

test("identify drops empty fields", async () => {
  await Saidloop.identify({ userId: "rina", email: "" });
  expect(mockCalls[0]).toEqual({ method: "identify", args: [{ userId: "rina" }] });
});

test("show measures masks before opening the sheet", async () => {
  masks.register(async () => ({ x: 24, y: 120, w: 200, h: 40 }));
  masks.register(async () => null);
  await Saidloop.show();
  expect(mockCalls.map((c) => c.method)).toEqual(["setMaskRects", "show"]);
  expect(mockCalls[0].args[0]).toEqual([{ x: 24, y: 120, w: 200, h: 40 }]);
});

test("unchanged masks are not resent", async () => {
  masks.register(async () => ({ x: 1, y: 2, w: 3, h: 4 }));
  await Saidloop.show();
  await Saidloop.show();
  expect(mockCalls.map((c) => c.method)).toEqual(["setMaskRects", "show", "show"]);
});
