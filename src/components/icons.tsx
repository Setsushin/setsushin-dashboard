// Inline SVG icon primitives. Inherit `currentColor` from their parent so
// they survive light/dark mode without filter hacks, and render dead-center
// inside any flex/grid box (text glyphs like "+"/"×" sit off-center).

export function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}

export function XIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}
