interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * CredSeal brand mark — outlined credential-card frame with an "MC" monogram.
 * The card's rounded border and the letter strokes share a blue → lilac → mint
 * gradient. Light interior keeps it legible at favicon sizes.
 */
export function BrandMark({ size = 36, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="CredSeal"
    >
      <defs>
        <linearGradient
          id="credseal-stroke"
          x1="4"
          y1="6"
          x2="44"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="55%" stopColor="#8B7CF6" />
          <stop offset="100%" stopColor="#5BC8A5" />
        </linearGradient>
      </defs>

      {/* Credential-card frame */}
      <rect
        x="3.25"
        y="6.25"
        width="41.5"
        height="35.5"
        rx="9"
        fill="white"
        stroke="url(#credseal-stroke)"
        strokeWidth="2.5"
      />

      {/* "M" — two peaks, inner V-notch */}
      <path
        d="M12 32 L12 17 L18 25 L24 17 L24 32"
        stroke="url(#credseal-stroke)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* "C" — open arc, mint-side of the gradient */}
      <path
        d="M39 19.5 A7.5 7.5 0 1 0 39 28.5"
        stroke="url(#credseal-stroke)"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
