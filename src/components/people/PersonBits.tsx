import React, { useEffect, useRef, useState } from 'react';
import { Building2, Camera, UserRound, X } from 'lucide-react';
import { PersonStatus } from '../../types';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';

/**
 * A small contact icon: enough to say "this is a person" at a glance without the
 * room an initials circle takes. Its colour carries what they are - purple for a
 * study, blue for a return visit - so no separate tag is needed.
 */
export const PersonAvatar: React.FC<{ status: PersonStatus; size?: 'md' | 'lg' }> = ({ status, size = 'md' }) => (
  <UserRound
    size={size === 'lg' ? 28 : 20}
    aria-hidden="true"
    className={`flex-shrink-0 ${status === 'study' ? 'text-purple-700' : 'text-blue-600'}`}
  />
);

/** A photo of where someone lives, or a quiet placeholder until it is on the phone. */
export const PersonPhoto: React.FC<{ path: string; className?: string }> = ({ path, className = '' }) => {
  const url = usePhotoUrl(path);
  return url ? (
    <img src={url} alt="Photo of the building" className={`object-cover bg-gray-200 ${className}`} />
  ) : (
    <div
      role="img"
      aria-label="Photo of the building (not loaded - it shows once you have signal)"
      className={`bg-gray-200 text-gray-500 flex items-center justify-center ${className}`}
    >
      <Building2 size={28} aria-hidden="true" />
    </div>
  );
};

interface PhotoFieldProps {
  // A stored photo already on the person
  path?: string;
  // A photo just taken in this form, not saved yet
  pending: File | null;
  onPick: (file: File) => void;
  onRemove: () => void;
  // 'actions': just Retake and Remove, for under a photo already shown large
  variant?: 'full' | 'actions';
}

/**
 * Take or replace a photo of the building. On a phone the button opens the back
 * camera straight away; elsewhere it opens a file picker.
 */
export const PhotoField: React.FC<PhotoFieldProps> = ({ path, pending, onPick, onRemove, variant = 'full' }) => {
  const input = useRef<HTMLInputElement>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) {
      setPendingUrl(null);
      return;
    }
    const url = URL.createObjectURL(pending);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  const hasPhoto = Boolean(pending || path);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          // Let the same photo be picked again after a remove
          event.target.value = '';
        }}
      />
      {hasPhoto && variant === 'actions' ? (
        <div className="flex justify-end gap-1 -mt-2">
          <button type="button" onClick={() => input.current?.click()} className="h-11 px-3 text-sm font-semibold text-blue-700 rounded-lg hover:bg-blue-50">
            Retake photo
          </button>
          <button type="button" onClick={onRemove} className="h-11 px-3 text-sm font-semibold text-gray-600 rounded-lg hover:bg-gray-100">
            Remove
          </button>
        </div>
      ) : hasPhoto ? (
        <div className="flex items-center gap-3 p-2 border border-gray-200 rounded-xl">
          {pendingUrl ? (
            <img src={pendingUrl} alt="Photo of the building" className="w-[72px] h-14 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <PersonPhoto path={path!} className="w-[72px] h-14 rounded-lg flex-shrink-0" />
          )}
          <span className="flex-1 text-sm text-gray-600">Photo kept with their details</span>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="h-11 px-2.5 text-sm font-semibold text-blue-700"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove photo"
            className="w-11 h-11 flex items-center justify-center text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="w-full h-12 border border-dashed border-gray-400 rounded-xl bg-white text-gray-700 text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-gray-50"
        >
          <Camera size={20} aria-hidden="true" />
          Add a photo of the building
        </button>
      )}
    </>
  );
};
