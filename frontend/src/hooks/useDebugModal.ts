import { useState, useEffect, useCallback } from 'react';

export const useDebugModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  const openDebugModal = useCallback(() => setIsOpen(true), []);
  const closeDebugModal = useCallback(() => setIsOpen(false), []);
  const toggleDebugModal = useCallback(() => setIsOpen(prev => !prev), []);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Toggle debug modal with 'D' key (not in input fields)
      if (
        event.key.toLowerCase() === 'd' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        event.preventDefault();
        toggleDebugModal();
      }

      // Close debug modal with Escape key
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        closeDebugModal();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, toggleDebugModal, closeDebugModal]);

  return {
    isOpen,
    openDebugModal,
    closeDebugModal,
    toggleDebugModal,
  };
};
