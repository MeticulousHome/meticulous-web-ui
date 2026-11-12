// The rules behind the connect screen (src/lib/accessGate.ts).
//
// Which regression would a user see without these tests?
// - After pairing from a #pair= link, or with Request access, a refusal the
//   machine sent for the browser's old (missing) token wipes the token that
//   was just issued: the success toast shows, then the connect screen again.
// - One failed check while the connect screen is up (the machine rebooting
//   after an update, a Wi-Fi blip) leaves it up until a reload, even after
//   authorization is turned off on the machine.
// - Request access, Cancel, Request access again gets "Another request is
//   waiting on the machine" about the browser's own request, and an Allow
//   pressed on the machine afterwards is lost.
//
// Where do the expected values come from? The device authorization
// contract: GET /auth/validate answers 200 (allowed), 401 (needs pairing) or
// 404 (no device authorization); an access request stays open for the
// `expires_in` the machine returns (60 s) and the machine refuses a second
// one with 409 while it is open, with no way to withdraw it.
//
// Which bug do they catch that the suite missed? Each case pins a rule the
// code before this change broke, with no test: the provider compared
// refusals against a copy of the token updated only after React
// re-rendered, re-checked only after a 401, and the connect screen dropped
// the request id on Cancel. The provider and the screen now take these rules
// from the library instead of encoding them inline.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Use the project's compiler so this also runs on CI's Node 20.
const source = readFileSync(
  new URL("../src/lib/accessGate.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const {
  RECHECK_MS,
  accessFromStatus,
  afterAccessCheck,
  createDeviceSession,
  requestDeadline,
  resumableRequest,
} = await import(`data:text/javascript,${encodeURIComponent(outputText)}`);

const MACHINE = "http://192.168.1.20";
const OTHER = "http://192.168.1.21";

test("a refusal of the old token is ignored once a new token is applied", () => {
  // Tokenless page: the socket's handshake goes out without a token.
  const session = createDeviceSession(MACHINE, undefined);
  assert.equal(session.isCurrent(MACHINE, undefined), true);
  // The pair link's exchange lands and applies the token before React
  // re-renders; the socket's "unauthorized" for the tokenless handshake
  // arrives after that and must not wipe it.
  session.apply(MACHINE, "T1");
  assert.equal(session.isCurrent(MACHINE, undefined), false);
  assert.equal(session.isCurrent(MACHINE, "T1"), true);
  assert.deepEqual(session.current, { machineUrl: MACHINE, token: "T1" });
});

test("a refusal from the previous machine is ignored after switching", () => {
  const session = createDeviceSession(MACHINE, "T1");
  session.apply(OTHER, undefined);
  assert.equal(session.isCurrent(MACHINE, "T1"), false);
  assert.equal(session.isCurrent(OTHER, undefined), true);
});

test("a token forgotten after a refusal is not refused twice", () => {
  const session = createDeviceSession(MACHINE, "T1");
  assert.equal(session.isCurrent(MACHINE, "T1"), true);
  session.apply(MACHINE, undefined);
  // A second 401 for T1 (another query in flight) is already handled.
  assert.equal(session.isCurrent(MACHINE, "T1"), false);
});

test("reads validate's answers the way the contract defines them", () => {
  assert.equal(accessFromStatus(200), "allowed");
  assert.equal(accessFromStatus(401), "denied");
  assert.equal(accessFromStatus(404), "absent");
  assert.equal(accessFromStatus(500), "unknown");
  assert.equal(accessFromStatus(502), "unknown");
  assert.equal(accessFromStatus(undefined), "unknown");
});

test("keeps asking while the connect screen is up and the machine is silent", () => {
  // A network error or timeout reaches the provider as "unknown"; a 5xx too.
  assert.deepEqual(afterAccessCheck("unknown", true), {
    forgetToken: false,
    clearGate: false,
    recheck: true,
  });
  assert.equal(RECHECK_MS, 5000);
});

test("a machine without device authorization clears the connect screen", () => {
  assert.deepEqual(afterAccessCheck("absent", true), {
    forgetToken: false,
    clearGate: true,
    recheck: false,
  });
});

test("without the connect screen, silence and 404 change nothing", () => {
  // Older machines and unreachable ones behave as before device auth.
  const nothing = { forgetToken: false, clearGate: false, recheck: false };
  assert.deepEqual(afterAccessCheck("unknown", false), nothing);
  assert.deepEqual(afterAccessCheck("absent", false), nothing);
});

test("a refusal forgets the token and keeps asking; allowed clears", () => {
  for (const gated of [false, true]) {
    assert.deepEqual(afterAccessCheck("denied", gated), {
      forgetToken: true,
      clearGate: false,
      recheck: true,
    });
    assert.deepEqual(afterAccessCheck("allowed", gated), {
      forgetToken: false,
      clearGate: true,
      recheck: false,
    });
  }
});

test("waits a little longer than the machine keeps a request open", () => {
  const now = 1_000_000;
  // 60 s from the machine, plus 10 s so its own "expired" arrives first.
  assert.equal(requestDeadline(60, now), now + 70_000);
  // No usable expires_in: the contract's 60 s.
  assert.equal(requestDeadline(0, now), now + 70_000);
  assert.equal(requestDeadline(-5, now), now + 70_000);
  assert.ok(requestDeadline(30, now) > now + 30_000);
});

test("asking again before the deadline resumes the cancelled request", () => {
  const now = 1_000_000;
  const cancelled = { id: "req-1", deadline: requestDeadline(60, now) };
  // Cancel, then Request access again 20 s later: same request, no new POST.
  assert.deepEqual(resumableRequest(cancelled, now + 20_000), cancelled);
  assert.equal(resumableRequest(cancelled, now + 69_999), cancelled);
});

test("asking again after the deadline starts a new request", () => {
  const now = 1_000_000;
  const cancelled = { id: "req-1", deadline: requestDeadline(60, now) };
  assert.equal(resumableRequest(cancelled, now + 70_000), null);
  assert.equal(resumableRequest(null, now), null);
});
