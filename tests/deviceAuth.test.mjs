import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Use the project's compiler so this also runs on CI's Node 20.
const source = readFileSync(
  new URL("../src/lib/deviceAuth.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const {
  deviceNameFromUserAgent,
  formatPairingCode,
  hasPairPart,
  hashWithoutPair,
  normalizePairingCode,
  pairCodeFromHash,
  readDeviceToken,
  writeDeviceToken,
} = await import(`data:text/javascript,${encodeURIComponent(outputText)}`);

// A minimal in-memory localStorage, as the browser provides.
const memoryStorage = () => {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    items,
  };
};

// Runs fn with the given object as localStorage. defineProperty, because some
// Node versions ship a read-only localStorage of their own.
const withStorage = (storage, fn) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
};

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  samsungAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  firefoxLinux:
    "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  firefoxWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  operaWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

test("names the browser and the system from the user agent", () => {
  assert.equal(deviceNameFromUserAgent(UA.chromeMac), "Chrome on macOS");
  assert.equal(deviceNameFromUserAgent(UA.safariMac), "Safari on macOS");
  assert.equal(deviceNameFromUserAgent(UA.safariIphone), "Safari on iOS");
  assert.equal(deviceNameFromUserAgent(UA.chromeIphone), "Chrome on iOS");
  assert.equal(deviceNameFromUserAgent(UA.chromeAndroid), "Chrome on Android");
  assert.equal(
    deviceNameFromUserAgent(UA.samsungAndroid),
    "Samsung Internet on Android",
  );
  assert.equal(deviceNameFromUserAgent(UA.edgeWindows), "Edge on Windows");
  assert.equal(deviceNameFromUserAgent(UA.firefoxLinux), "Firefox on Linux");
  assert.equal(
    deviceNameFromUserAgent(UA.firefoxWindows),
    "Firefox on Windows",
  );
  assert.equal(deviceNameFromUserAgent(UA.operaWindows), "Opera on Windows");
  assert.equal(deviceNameFromUserAgent(UA.chromeOs), "Chrome on ChromeOS");
});

test("tells an iPad that reports a Mac user agent by its touch points", () => {
  assert.equal(deviceNameFromUserAgent(UA.safariMac, 5), "Safari on iPadOS");
  assert.equal(deviceNameFromUserAgent(UA.safariMac, 0), "Safari on macOS");
});

test("falls back to a generic name for unknown user agents", () => {
  assert.equal(deviceNameFromUserAgent(""), "Web browser");
  assert.equal(deviceNameFromUserAgent("curl/8.7.1"), "Web browser");
  assert.equal(
    deviceNameFromUserAgent("Something (X11; Linux x86_64)"),
    "Web browser on Linux",
  );
});

test("normalises pairing codes the way the machine does", () => {
  assert.equal(normalizePairingCode("ABCD-EFGH"), "ABCDEFGH");
  assert.equal(normalizePairingCode(" abcd efgh "), "ABCDEFGH");
  assert.equal(normalizePairingCode("abcdefgh"), "ABCDEFGH");
  // I and L read as 1, O as 0.
  assert.equal(normalizePairingCode("ilo2-3456"), "11023456");
  // U is not in the alphabet; wrong lengths are refused.
  assert.equal(normalizePairingCode("ABCD-EFGU"), null);
  assert.equal(normalizePairingCode("ABCD-EFG"), null);
  assert.equal(normalizePairingCode("ABCD-EFGHJ"), null);
  assert.equal(normalizePairingCode(""), null);
  assert.equal(normalizePairingCode("ABCD_EFGH"), null);
});

test("formats a canonical code with a dash in the middle", () => {
  assert.equal(formatPairingCode("ABCDEFGH"), "ABCD-EFGH");
  assert.equal(formatPairingCode("ABC"), "ABC");
});

test("reads the pairing code from a pair URL fragment", () => {
  assert.equal(pairCodeFromHash("#pair=ABCDEFGH"), "ABCDEFGH");
  assert.equal(pairCodeFromHash("#pair=abcd-efgh"), "ABCDEFGH");
  assert.equal(pairCodeFromHash("#pair=ABCD%2DEFGH"), "ABCDEFGH");
  assert.equal(pairCodeFromHash("#/settings&pair=ABCDEFGH"), "ABCDEFGH");
  assert.equal(pairCodeFromHash("#pair=ABCDEFGH&x=1"), "ABCDEFGH");
  assert.equal(pairCodeFromHash("#pair=nope"), null);
  assert.equal(pairCodeFromHash("#pair=%E0%A4%A"), null);
  assert.equal(pairCodeFromHash("#/machine"), null);
  assert.equal(pairCodeFromHash(""), null);
  assert.equal(pairCodeFromHash("#repair=ABCDEFGH"), null);
});

test("removes the pair part from the fragment and keeps the rest", () => {
  assert.equal(hashWithoutPair("#pair=ABCDEFGH"), "");
  assert.equal(hashWithoutPair("#/settings&pair=ABCDEFGH"), "#/settings");
  assert.equal(hashWithoutPair("#pair=ABCDEFGH&x=1"), "#x=1");
  assert.equal(hashWithoutPair("#/machine"), "#/machine");
  assert.equal(hashWithoutPair(""), "");
  assert.equal(hasPairPart("#pair=bad"), true);
  assert.equal(hasPairPart("#/machine"), false);
});

test("keeps one token per machine address", () => {
  const storage = memoryStorage();
  withStorage(storage, () => {
    assert.equal(readDeviceToken("http://10.0.0.2"), undefined);
    writeDeviceToken("http://10.0.0.2", "token-a");
    writeDeviceToken("http://10.0.0.3", "token-b");
    assert.equal(readDeviceToken("http://10.0.0.2"), "token-a");
    assert.equal(readDeviceToken("http://10.0.0.3"), "token-b");
    assert.deepEqual(
      Object.keys(JSON.parse(storage.items.get("meticulous:device-tokens"))),
      ["http://10.0.0.2", "http://10.0.0.3"],
    );

    writeDeviceToken("http://10.0.0.2");
    assert.equal(readDeviceToken("http://10.0.0.2"), undefined);
    assert.equal(readDeviceToken("http://10.0.0.3"), "token-b");

    // Forgetting the last token removes the key.
    writeDeviceToken("http://10.0.0.3", "");
    assert.equal(storage.items.has("meticulous:device-tokens"), false);
  });
});

test("ignores broken stored data and storage that throws", () => {
  const storage = memoryStorage();
  withStorage(storage, () => {
    storage.items.set("meticulous:device-tokens", "not json");
    assert.equal(readDeviceToken("http://10.0.0.2"), undefined);
    storage.items.set("meticulous:device-tokens", '["token"]');
    assert.equal(readDeviceToken("http://10.0.0.2"), undefined);
    storage.items.set("meticulous:device-tokens", '{"http://10.0.0.2":42}');
    assert.equal(readDeviceToken("http://10.0.0.2"), undefined);
    assert.equal(readDeviceToken("toString"), undefined);
  });

  const blocked = () => {
    throw new Error("blocked");
  };
  withStorage(
    { getItem: blocked, setItem: blocked, removeItem: blocked },
    () => {
      assert.equal(readDeviceToken("http://10.0.0.2"), undefined);
      assert.doesNotThrow(() => writeDeviceToken("http://10.0.0.2", "token"));
    },
  );
});
