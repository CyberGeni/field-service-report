/**
 * Motion timings, in one place so every part of the app moves the same way.
 *
 * UI motion is quick and springy - it acknowledges a tap rather than performs for
 * it - and nothing here runs past half a second. Exits are faster than entrances: by
 * the time something is leaving, the user has already moved on.
 */

// Ease-out for fades and small moves
export const ease = [0.22, 1, 0.36, 1] as const;

// Tab pills, the nav highlight, toggles: settles fast with no wobble
export const spring = { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 } as const;

// Drawers and dialogs: a touch softer, so a large surface arrives with weight
export const softSpring = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 } as const;

export const dur = { fast: 0.15, base: 0.22, slow: 0.32 } as const;
