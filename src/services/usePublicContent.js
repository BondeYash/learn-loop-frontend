import { useCallback, useSyncExternalStore } from "react";
const EMPTY = Object.freeze({ data: null, refreshing: false, waiting: false });
export default function usePublicContent(resource, enabled = true) {
  const subscribe = useCallback(listener => enabled ? resource.subscribe(listener) : () => {}, [resource, enabled]);
  const snapshot = useCallback(() => enabled ? resource.getSnapshot() : EMPTY, [resource, enabled]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
