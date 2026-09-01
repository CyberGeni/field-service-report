import { useCallback, useEffect, useRef, useState } from 'react';

// Older iOS Safari and any non-HTTPS origin have no navigator.clipboard, and this app
// is installed as a PWA on phones - so keep the execCommand path around.
const legacyCopy = (text: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch {
    succeeded = false;
  }

  document.body.removeChild(textarea);

  if (previousRange && selection) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }

  return succeeded;
};

export const useCopyToClipboard = (resetDelay = 2000) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      let succeeded = false;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          succeeded = true;
        } else {
          succeeded = legacyCopy(text);
        }
      } catch (err) {
        console.error('Copy to clipboard failed:', err);
        succeeded = legacyCopy(text);
      }

      setCopied(succeeded);

      if (succeeded) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), resetDelay);
      }

      return succeeded;
    },
    [resetDelay]
  );

  return { copy, copied };
};
