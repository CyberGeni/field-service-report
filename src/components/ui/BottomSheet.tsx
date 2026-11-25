import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, PanInfo, useDragControls } from 'motion/react';
import { dur, ease, softSpring } from '../../lib/motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
}

// A pull this far down, or a flick this fast, closes the sheet
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 500;

/**
 * A drawer that slides up from the bottom of the screen and back down again.
 *
 * It stays mounted while it leaves, so closing is animated rather than a cut. It can
 * be dragged down by its handle to dismiss, the way a phone's own sheets work, and
 * the page behind it stops scrolling while it is up.
 */
const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, labelledBy, children }) => {
  const drag = useDragControls();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet"
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: dur.base, ease } }}
            exit={{ opacity: 0, transition: { duration: dur.fast, ease } }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className="relative bg-white w-full max-w-md rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: softSpring }}
            exit={{ y: '100%', transition: { duration: dur.base, ease } }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={handleDragEnd}
          >
            {/* The handle is where a drag starts, so scrolling the form never closes it */}
            <div
              className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={event => drag.start(event)}
            >
              <span className="w-10 h-1.5 rounded-full bg-gray-300" />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;
