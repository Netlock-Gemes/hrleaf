import type katexType from 'katex';

/**
 * KaTeX is ~270 KB with fonts, so it's only loaded when a note actually
 * contains an equation (via the dynamically imported EquationRenderer).
 * Once loaded, it's cached here for synchronous use (e.g. copy/export).
 */
let instance: typeof katexType | null = null;

export const setKatex = (k: typeof katexType) => {
  instance = k;
};

export const getKatex = () => instance;

/** Unicode-safe base64 for storing equations in DOM attributes. */
export const encodeEquation = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));

export const decodeEquation = (s: string) => {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  } catch {
    return '';
  }
};
