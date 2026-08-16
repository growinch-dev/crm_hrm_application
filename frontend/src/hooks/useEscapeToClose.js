import { useEffect } from 'react';

// Closes a modal when Escape is pressed - shared by every modal-overlay component.
export default function useEscapeToClose(onClose) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
}
