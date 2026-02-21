import { useCallback, useState } from 'react';

const GUIDE_DISMISSED_KEY = 'guide-dismissed';

export function useGuide() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_DISMISSED_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const dismiss = useCallback(() => {
    setShow(false);
    try {
      localStorage.setItem(GUIDE_DISMISSED_KEY, 'true');
    } catch {
      // localStorage が使えない場合は無視
    }
  }, []);

  return { showGuide: show, dismissGuide: dismiss };
}
