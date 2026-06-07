/**
 * Small formatting / validation helpers shared across the booking funnel.
 * Pure functions — no React, no side effects.
 */

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function formatCad(n: number) {
  try {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)} $`;
  }
}

export function prettyKm(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function normalizePostal(p: string) {
  return p.toUpperCase().replace(/\s+/g, "").slice(0, 6);
}

// Lenient client-side check (>= 3 chars unlocks the slot UI). The edge
// function enforces the strict A1A 1A1 format server-side.
export function isValidPostal(p: string) {
  return normalizePostal(p).length >= 3;
}

export function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
