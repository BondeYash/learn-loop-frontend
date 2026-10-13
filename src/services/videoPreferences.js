export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export const SKIP_SECONDS = [5, 10, 30];
const KEY = "learnloop:video-controls:v1";
const DEFAULTS = { speed: 1, skip: 10 };

export function readVideoPreferences() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) || "null");
    return {
      speed: PLAYBACK_SPEEDS.includes(saved?.speed) ? saved.speed : DEFAULTS.speed,
      skip: SKIP_SECONDS.includes(saved?.skip) ? saved.skip : DEFAULTS.skip,
    };
  } catch { return { ...DEFAULTS }; }
}

export function saveVideoPreferences(preferences) {
  // Device preferences only; never store a private URL or account data here.
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(preferences)); } catch { /* Playback still works when storage is blocked. */ }
}
