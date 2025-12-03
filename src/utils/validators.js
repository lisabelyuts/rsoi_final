export const isNonEmpty = v => typeof v === 'string' && v.trim().length > 0;
export const isEmail = v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const clampRating = n => {
  const x = Number(n);
  return Number.isFinite(x) && x >= 1 && x <= 5 ? x | 0 : null;
};
