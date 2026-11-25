import { supabase } from '../lib/supabase';

/**
 * Photos of where people live, kept on the phone.
 *
 * A photo is taken on a doorstep, often with no signal, and has to show again on the
 * next visit - also often with no signal. So the phone keeps its own copy of every
 * photo it has taken or shown, and the upload to Supabase is a queued step like any
 * other change. Photos are far too big for localStorage (a few MB in all), so they
 * live in IndexedDB, keyed by their path in the storage bucket.
 */

export const PHOTO_BUCKET = 'people-photos';

const DB_NAME = 'fieldServicePhotos';
const STORE = 'photos';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
};

const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const savePhotoLocally = (path: string, photo: Blob) => run('readwrite', store => store.put(photo, path));

export const readLocalPhoto = async (path: string): Promise<Blob | null> => {
  try {
    return (await run<Blob | undefined>('readonly', store => store.get(path))) ?? null;
  } catch (err) {
    console.warn('Could not read photo from the device:', err);
    return null;
  }
};

export const removeLocalPhoto = async (path: string) => {
  try {
    await run('readwrite', store => store.delete(path));
  } catch (err) {
    console.warn('Could not remove photo from the device:', err);
  }
};

// Phone cameras take 4000px, 4MB pictures; a door needs a fraction of that to be
// recognised, and every byte has to go up over a weak signal
const MAX_EDGE = 1280;
const QUALITY = 0.8;

/** Shrink a camera photo to a JPEG small enough to store and upload cheaply. */
export const compressPhoto = async (file: File): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not process the photo'))), 'image/jpeg', QUALITY)
  );
};

// One object URL per photo for the life of the page, so every screen showing the same
// photo shares it and none of them has to fetch it twice
const urlCache = new Map<string, Promise<string | null>>();

/**
 * A URL the page can show for a photo: the phone's copy if it has one, otherwise the
 * one in Supabase, fetched once and then kept on the phone for next time.
 */
export const getPhotoUrl = (path: string): Promise<string | null> => {
  const cached = urlCache.get(path);
  if (cached) return cached;

  const loading = (async () => {
    let photo = await readLocalPhoto(path);
    if (!photo) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
      if (error || !data) {
        // Not cached: offline now is not offline forever, so let a later look retry
        urlCache.delete(path);
        return null;
      }
      photo = data;
      await savePhotoLocally(path, photo).catch(() => undefined);
    }
    return URL.createObjectURL(photo);
  })();

  urlCache.set(path, loading);
  return loading;
};

/** Seed the URL for a photo just taken, so it shows at once without a round trip. */
export const primePhotoUrl = (path: string, photo: Blob) => {
  urlCache.set(path, Promise.resolve(URL.createObjectURL(photo)));
};

export const forgetPhotoUrl = (path: string) => {
  const cached = urlCache.get(path);
  urlCache.delete(path);
  cached?.then(url => url && URL.revokeObjectURL(url));
};
