type ActivityListener = () => void;
const listeners = new Set<ActivityListener>();

export function reportUserActivity() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

export function onUserActivity(callback: ActivityListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
