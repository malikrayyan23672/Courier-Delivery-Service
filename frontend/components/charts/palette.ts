// Chart color palette - validated with the dataviz skill's validate_palette.js
// (light mode, all checks pass; the one CVD WARN between success/orange is
// covered by always pairing color with a legend + tooltip, never color alone).
//
// Fixed categorical order - assign by this order, never cycle or reassign per filter.
export const CATEGORICAL = [
  '#2563EB', // blue
  '#F2701A', // brand orange
  '#1E8E5A', // success green
  '#7C3AED', // purple
  '#D8432C', // danger red
  '#0891B2', // teal
] as const;

// Reserved status colors - never reused as "series N" in a categorical chart.
export const STATUS = {
  good: '#1E8E5A',
  warning: '#B9770E',
  critical: '#D8432C',
  neutral: '#8A94A6',
} as const;

// Single-hue sequential ramp (magnitude) - light to dark orange.
export const SEQUENTIAL_ORANGE = ['#FFE3C7', '#FFB570', '#F2701A', '#C1550C'] as const;

export const GRID_COLOR = '#E4E8F0'; // matches --line token
export const AXIS_TEXT_COLOR = '#6B7686'; // matches muted-foreground

export function colorForIndex(i: number): string {
  return CATEGORICAL[i % CATEGORICAL.length];
}
