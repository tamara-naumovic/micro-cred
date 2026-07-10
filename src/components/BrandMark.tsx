interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * CredSeal brand mark — abstract "MC" monogram reading as a credential card
 * with a verification arc and a chained-node motif for blockchain anchoring.
 */
export function BrandMark({ size = 36, className }: BrandMarkProps) {
  // Stable gradient IDs are fine here — the component is rendered once per header.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="CredSeal"
    >
      <defs>
        <linearGradient id="credseal-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="55%" stopColor="#8B7CF6" />
          <stop offset="100%" stopColor="#5BC8A5" />
        </linearGradient>
      </defs>

      {/* Credential-card container */}
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#credseal-bg)" />

      {/* "M" strokes — two peaks with a slight inner notch */}
      <path
        d="M10 28 L10 13 L15.5 20 L20 15 L20 28"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* "C" arc — doubles as a verification tick / open chain link */}
      <path
        d="M31 15.5 A7.5 7.5 0 1 0 31 24.5"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Chained-node dots (blockchain motif) */}
      <circle cx="27.5" cy="30" r="1.15" fill="white" />
      <circle cx="30.8" cy="30" r="1.15" fill="white" fillOpacity="0.75" />
      <circle cx="34.1" cy="30" r="1.15" fill="white" fillOpacity="0.5" />
    </svg>
  );
}
