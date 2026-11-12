// Device authorization helpers with no dependencies, so tests can load them
// on their own. The machine hands out a token to each device it allows; this
// browser keeps one per machine address.

const TOKENS_KEY = "meticulous:device-tokens";

const readTokens = (): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(TOKENS_KEY) ?? "{}",
    );
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
};

// The token this browser holds for a machine, if any.
export const readDeviceToken = (machineUrl: string): string | undefined => {
  const tokens = readTokens();
  const token = Object.hasOwn(tokens, machineUrl)
    ? tokens[machineUrl]
    : undefined;
  return typeof token === "string" && token ? token : undefined;
};

// Saves a machine's token, or forgets it (undefined or empty).
export const writeDeviceToken = (machineUrl: string, token?: string) => {
  const tokens = readTokens();
  if (token) tokens[machineUrl] = token;
  else delete tokens[machineUrl];
  try {
    if (Object.keys(tokens).length) {
      localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    } else {
      localStorage.removeItem(TOKENS_KEY);
    }
  } catch {
    // Not persisted; the token still works until the page is reloaded.
  }
};

// Pairing codes are 8 Crockford base32 characters (no I, L, O or U).
const PAIRING_CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

// "abcd-efgh", "ABCD EFGH" or "ABCDEFGH" -> "ABCDEFGH". I and L read as 1 and
// O as 0, like the machine does, so a code copied by hand still works. Null
// when the result can't be a pairing code.
export const normalizePairingCode = (input: string): string | null => {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  return PAIRING_CODE.test(code) ? code : null;
};

// "ABCDEFGH" -> "ABCD-EFGH", the way the machine shows codes.
export const formatPairingCode = (code: string) =>
  code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

const isPairPart = (part: string) => part.startsWith("pair=");

// The pairing code a pair URL (http://<machine>/#pair=ABCDEFGH) carries in
// its fragment, or null when there is none or it isn't a valid code.
export const pairCodeFromHash = (hash: string): string | null => {
  const part = hash.replace(/^#/, "").split("&").find(isPairPart);
  if (!part) return null;
  let value = part.slice("pair=".length);
  try {
    value = decodeURIComponent(value);
  } catch {
    // Use it as typed; normalising rejects anything odd.
  }
  return normalizePairingCode(value);
};

// The fragment with any pair=... part removed ("" when nothing is left).
export const hashWithoutPair = (hash: string): string => {
  const rest = hash
    .replace(/^#/, "")
    .split("&")
    .filter((part) => part && !isPairPart(part))
    .join("&");
  return rest ? `#${rest}` : "";
};

export const hasPairPart = (hash: string) =>
  hash.replace(/^#/, "").split("&").some(isPairPart);

// "Chrome on macOS" from a user agent, the name the machine shows when this
// browser asks for access. maxTouchPoints tells an iPad, which reports itself
// as a Mac, from a real Mac.
export const deviceNameFromUserAgent = (
  userAgent: string,
  maxTouchPoints = 0,
): string => {
  const ua = userAgent;
  const browser = /Edg(?:e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\/|Chromium\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  const os = /iPad/.test(ua)
    ? "iPadOS"
    : /iPhone|iPod/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /CrOS/.test(ua)
          ? "ChromeOS"
          : /Windows/.test(ua)
            ? "Windows"
            : /Macintosh|Mac OS X/.test(ua)
              ? maxTouchPoints > 1
                ? "iPadOS"
                : "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  if (browser && os) return `${browser} on ${os}`;
  if (os) return `Web browser on ${os}`;
  return browser ?? "Web browser";
};
