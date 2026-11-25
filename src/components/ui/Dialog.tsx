import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { dur, ease, softSpring } from '../../lib/motion';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  role?: 'dialog' | 'alertdialog';
  // Classes for the panel: width, padding, scrolling
  className?: string;
  children: React.ReactNode;
}

/**
 * A centred popup that fades and scales up into place, and back out on close.
 * For questions and short forms; anything long or tall belongs in a BottomSheet.
 */
const Dialog: React.FC<DialogProps> = ({ open, onClose, labelledBy, role = 'dialog', className = '', children }) => {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4" exit={{ opacity: 1 }}>
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: dur.base, ease } }}
            exit={{ opacity: 0, transition: { duration: dur.fast, ease } }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role={role}
            aria-modal="true"
            aria-labelledby={labelledBy}
            className={`relative bg-white rounded-2xl w-full shadow-2xl ${className}`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: softSpring }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: dur.fast, ease } }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Dialog;
