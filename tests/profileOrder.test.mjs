import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Use the project's compiler so this also runs on CI's Node 20.
const source = readFileSync(
  new URL("../src/lib/profileOrder.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { normalizeProfileOrder } = await import(
  `data:text/javascript,${encodeURIComponent(outputText)}`
);

test("repairs repeated IDs without moving their first occurrence", () => {
  const saved = ["espresso", "filter", "espresso", "manual", "filter"];
  const repaired = normalizeProfileOrder(saved);
  assert.deepEqual(repaired, ["espresso", "filter", "manual"]);
  assert.deepEqual(saved, [
    "espresso",
    "filter",
    "espresso",
    "manual",
    "filter",
  ]);
  // A deduplicated draft differs from persisted data, so Save can repair it.
  assert.notEqual(repaired.join(), saved.join());
});

test("keeps distinct IDs for identically named profiles and unknown/manual IDs", () => {
  const saved = [
    "same-name-profile-a",
    "manual",
    "unknown-id",
    "same-name-profile-b",
  ];
  assert.deepEqual(normalizeProfileOrder(saved), saved);
});

test("keeps empty and already unique orders unchanged", () => {
  assert.deepEqual(normalizeProfileOrder([]), []);
  assert.deepEqual(normalizeProfileOrder(["one", "two"]), ["one", "two"]);
});
