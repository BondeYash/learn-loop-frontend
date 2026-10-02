export function isMp4Header(bytes) {
  if (bytes.length < 16 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") return false;
  const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const brands = [];
  for (let i = 8; i + 4 <= Math.min(size, bytes.length); i += 4) if (i !== 12) brands.push(String.fromCharCode(...bytes.slice(i, i + 4)));
  return !brands.includes("qt  ") && brands.some((brand) => /^(isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(brand));
}
export async function validateVideo(file, signal) {
  const guidance = "Convert the video to H.264 video with AAC audio in an MP4 container before uploading. WebM, MOV and MKV cannot be converted here. Preview with sound before sharing; the first-frame check does not verify the audio codec.";
  if (!/\.mp4$/i.test(file.name) || file.size < 16 || file.size > 2 * 1024 ** 3) throw new Error(`Choose a precompressed MP4 up to 2 GB. ${guidance}`);
  if (!isMp4Header(new Uint8Array(await file.slice(0, 64).arrayBuffer()))) throw new Error(`The file contents are not an accepted MP4. ${guidance}`);
  if (signal?.aborted) throw new DOMException("Upload stopped", "AbortError");
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (error, value) => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal?.removeEventListener("abort", stop);
      video.onloadeddata = null; video.onerror = null;
      video.pause(); video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(value);
    };
    const stop = () => finish(new DOMException("Upload stopped", "AbortError"));
    const timer = setTimeout(() => finish(new Error(`The browser could not decode the first video frame. ${guidance}`)), 30000);
    video.preload = "auto"; video.muted = true; video.playsInline = true;
    video.onerror = () => finish(new Error(`This browser cannot play the selected MP4. ${guidance}`));
    video.onloadeddata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 14400 || video.videoWidth < 1 || video.videoHeight < 1) return finish(new Error("Choose a playable MP4 video up to four hours long."));
      finish(null, { duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    };
    signal?.addEventListener("abort", stop, { once: true });
    video.src = url;
  });
}
