/**
 * The last known good copy of the user's data, kept on the device.
 *
 * Field service happens in stairwells, car parks and rural roads - the app has to open
 * and take a record with no signal at all, so every screen reads from here first and
 * treats the network as a refresh rather than a prerequisite.
 */
const CACHE_PREFIX = 'fieldServiceOfflineCache';

const cacheKey = (name: string, userId: string) => `${CACHE_PREFIX}:${name}:${userId}`;

export const readCache = <T>(name: string, userId: string): T | null => {
  try {
    const stored = localStorage.getItem(cacheKey(name, userId));
    return stored ? (JSON.parse(stored) as T) : null;
  } catch (err) {
    console.warn(`Could not read ${name} cache:`, err);
    return null;
  }
};

export const writeCache = <T>(name: string, userId: string, value: T): void => {
  try {
    localStorage.setItem(cacheKey(name, userId), JSON.stringify(value));
  } catch (err) {
    // A full or blocked store costs the user their offline copy, not their session
    console.warn(`Could not write ${name} cache:`, err);
  }
};

export const clearCache = (name: string, userId: string): void => {
  try {
    localStorage.removeItem(cacheKey(name, userId));
  } catch (err) {
    console.warn(`Could not clear ${name} cache:`, err);
  }
};
