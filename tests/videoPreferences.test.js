import test from "node:test";
import assert from "node:assert/strict";
import { readVideoPreferences, saveVideoPreferences } from "../src/services/videoPreferences.js";

test("obsolete or corrupt video preferences fall back safely, and device choices can be saved", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let stored;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => stored, setItem: (_key, value) => { stored = value; } } });
  try {
    for (const value of [null, "{bad json", '"not an object"', '{"speed":-1,"skip":999}', '{"speed":"2","skip":"30"}']) {
      stored = value;
      assert.deepEqual(readVideoPreferences(), { speed: 1, skip: 10 });
    }
    saveVideoPreferences({ speed: 1.5, skip: 30 });
    assert.deepEqual(readVideoPreferences(), { speed: 1.5, skip: 30 });
    stored = '{"speed":1.25,"skip":null}';
    assert.deepEqual(readVideoPreferences(), { speed: 1.25, skip: 10 });
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});

test("browser storage denial cannot prevent video playback preferences from loading", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("Storage disabled"); } });
  try {
    assert.deepEqual(readVideoPreferences(), { speed: 1, skip: 10 });
    assert.doesNotThrow(() => saveVideoPreferences({ speed: 2, skip: 5 }));
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});
