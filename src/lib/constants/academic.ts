export interface LevelOption {
  value: string;
  label: string;
}

// `value` must match the backend's strict enum for the `level` field
// exactly (rounds.level, prizes.level, users.level); `label` is what's
// shown in the dropdown. Mirrors the student frontend's own
// lib/constants/academic.ts — keep both in sync.
export const LEVEL_OPTIONS: LevelOption[] = [
  { value: "Junior", label: "Junior (Class 6 - 8)" },
  { value: "Secondary", label: "Secondary (Class 9 - 10)" },
  { value: "Higher Secondary", label: "Higher Secondary (Class 11 - 12 / HSC)" },
];

export function levelLabel(value?: string): string | undefined {
  return LEVEL_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
