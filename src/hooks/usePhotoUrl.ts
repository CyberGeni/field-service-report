import { useEffect, useState } from 'react';
import { getPhotoUrl } from '../utils/photoStore';

/** The URL to show a stored photo with, or null while it loads or when it cannot. */
export const usePhotoUrl = (path?: string): string | null => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!path) return;
    let live = true;
    getPhotoUrl(path).then(found => {
      if (live) setUrl(found);
    });
    return () => {
      live = false;
    };
  }, [path]);

  return url;
};
