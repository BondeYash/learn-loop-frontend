import test from "node:test";
import assert from "node:assert/strict";
import { isMp4Header, validateVideo } from "../src/services/validateVideo.js";
const header = (brand) => { const bytes = new Uint8Array(24); new DataView(bytes.buffer).setUint32(0, 24); bytes.set(new TextEncoder().encode(`ftyp${brand}`), 4); bytes.set(new TextEncoder().encode(brand), 16); return bytes; };
test("accepts MP4 brands and rejects QuickTime or WebM bytes", () => {
  assert.equal(isMp4Header(header("isom")), true);
  assert.equal(isMp4Header(header("mp42")), true);
  assert.equal(isMp4Header(header("qt  ")), false);
  assert.equal(isMp4Header(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])), false);
});
test("renaming arbitrary content to MP4 does not pass validation", async () => {
  await assert.rejects(validateVideo(new File(["This is not an MP4 container or a video."], "renamed.mp4")), /file contents/);
});
test("WebM, MOV and MKV show external conversion guidance before any upload", async () => {
  for (const name of ["video.webm", "video.mov", "video.mkv"]) await assert.rejects(validateVideo(new File([header("isom")], name)), /Convert.*H.264.*AAC/);
});
