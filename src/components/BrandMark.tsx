import logoAsset from "@/assets/iskra-fon-logo.png.asset.json";

interface BrandMarkProps {
  height?: number;
  className?: string;
}

/**
 * ISKRA FON brand logo — rendered from the CDN-hosted asset.
 */
export function BrandMark({ height = 36, className }: BrandMarkProps) {
  return (
    <img
      src={logoAsset.url}
      width={Math.round((height * 1920) / 737)}
      height={height}
      alt="ISKRA FON"
      className={className}
      style={{ display: "inline-block", objectFit: "contain" }}
    />
  );
}
