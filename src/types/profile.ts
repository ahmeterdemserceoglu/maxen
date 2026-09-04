export type Profile = {
  id: string;
  name: string;
  letter: string;
  color: string;
  avatarUrl?: string;
  isKids?: boolean;
  pin?: string;
  createdAt?: number;
};

export const PROFILE_COLORS = [
  '#E50914',
  '#1E40AF',
  '#059669',
  '#D97706',
  '#7C3AED',
  '#DB2777',
  '#0891B2',
  '#CA8A04',
];

export const MAX_PROFILES = 5;

export function profileLetter(name: string): string {
  return (name.trim()[0] || '?').toUpperCase();
}
