'use client';

// Files dropped anywhere in the app are parked here and picked up by the Import page.
let pending: File[] = [];
export const setPendingFiles = (f: File[]) => {
  pending = f;
};
export const takePendingFiles = (): File[] => {
  const f = pending;
  pending = [];
  return f;
};
