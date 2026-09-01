import { useEffect, useState } from 'react';

/**
 * Whether the browser currently believes it has a connection.
 *
 * It is a hint, not a guarantee - a phone can hold a signal that goes nowhere - so
 * everything that writes still has to survive a request failing while this says true.
 */
export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
};
