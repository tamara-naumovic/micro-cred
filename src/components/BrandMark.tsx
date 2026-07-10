interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * CredSeal brand mark — rendered from the uploaded PNG asset.
 */
export function BrandMark({ size = 36, className }: BrandMarkProps) {
  return (
    <img
      src="/brand-mark.png"
      width={size}
      height={size}
      alt="CredSeal"
      className={className}
      style={{ display: "inline-block", objectFit: "contain" }}
    />
  );
}
