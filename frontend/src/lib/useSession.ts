import { useSyncExternalStore } from 'react';
import { getSession, subscribe, getSnapshot } from './store';

/** Re-render a component whenever the demo session changes. */
export function useSession() {
  useSyncExternalStore(subscribe, getSnapshot);
  return getSession();
}