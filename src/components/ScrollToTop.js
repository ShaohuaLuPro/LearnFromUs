import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    const previousMode = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    return () => {
      window.history.scrollRestoration = previousMode;
    };
  }, [location.pathname]);

  return null;
}
