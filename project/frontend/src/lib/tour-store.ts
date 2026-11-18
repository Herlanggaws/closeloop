export type TourStoreState = {
  seen: string[];
  disabled: boolean;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const EMPTY: TourStoreState = { seen: [], disabled: false };

let storageOverride: StorageLike | null = null;

export function tourStorageKey(userId: string) {
  return `saidloop.tours.v1.${userId}`;
}

/** Test hook — pass null to restore the browser localStorage path. */
export function setTourStorageForTests(storage: StorageLike | null) {
  storageOverride = storage;
}

function getStorage(): StorageLike | null {
  if (storageOverride) return storageOverride;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(userId: string): TourStoreState {
  const storage = getStorage();
  if (!storage) return { ...EMPTY, seen: [] };
  try {
    const raw = storage.getItem(tourStorageKey(userId));
    if (!raw) return { ...EMPTY, seen: [] };
    const parsed = JSON.parse(raw) as Partial<TourStoreState>;
    return {
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((id) => typeof id === "string") : [],
      disabled: Boolean(parsed.disabled),
    };
  } catch {
    return { ...EMPTY, seen: [] };
  }
}

function writeRaw(userId: string, state: TourStoreState) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(tourStorageKey(userId), JSON.stringify(state));
}

export function getTourState(userId: string): TourStoreState {
  return readRaw(userId);
}

export function isTourSeen(userId: string, tourId: string): boolean {
  const state = readRaw(userId);
  return state.disabled || state.seen.includes(tourId);
}

export function areToursDisabled(userId: string): boolean {
  return readRaw(userId).disabled;
}

export function markTourSeen(userId: string, tourId: string): TourStoreState {
  const state = readRaw(userId);
  if (state.seen.includes(tourId)) return state;
  const next = { ...state, seen: [...state.seen, tourId] };
  writeRaw(userId, next);
  return next;
}

export function disableAllTours(userId: string): TourStoreState {
  const state = readRaw(userId);
  const next = { ...state, disabled: true };
  writeRaw(userId, next);
  return next;
}

export function resetTourState(userId: string): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(tourStorageKey(userId));
}
