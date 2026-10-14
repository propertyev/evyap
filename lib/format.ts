// Shared client/server formatting + input conversion helpers.
import { toSen, senToDecimal } from './money';

/** User types RM in an input -> sen (0 when blank/invalid). */
export const rmToSen = (s: string): number => toSen(s) ?? 0;
export const senToInput = (sen: number): string => (sen ? senToDecimal(sen) : '');
export const today = () => new Date().toISOString().slice(0, 10);
