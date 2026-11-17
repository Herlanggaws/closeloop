import Image from "next/image";
import Link from "next/link";

type SaidloopLogoProps = {
  href?: string | null;
  /** Visual height in px; width follows the wordmark aspect ratio. */
  height?: number;
  /** Use the white mark for dark backgrounds. */
  onDark?: boolean;
  className?: string;
};

export function SaidloopLogo({
  href = "/",
  height = 22,
  onDark = false,
  className = "",
}: SaidloopLogoProps) {
  const src = onDark ? "/brand/saidloop-logo-on-dark.png" : "/brand/saidloop-logo.png";
  const width = Math.round(height * (399 / 78));

  const mark = (
    <Image
      src={src}
      alt="Saidloop"
      width={width}
      height={height}
      priority
      className="h-auto w-auto"
      style={{ height, width: "auto" }}
    />
  );

  if (href == null) {
    return (
      <span data-pencil-name="Logo" className={`inline-flex items-center ${className}`}>
        {mark}
      </span>
    );
  }

  return (
    <Link
      href={href}
      data-pencil-name="Logo"
      className={`inline-flex shrink-0 items-center no-underline ${className}`}
    >
      {mark}
    </Link>
  );
}

/** @deprecated Use SaidloopLogo — kept so existing imports keep working. */
export function CloseloopLogo(props: SaidloopLogoProps) {
  return <SaidloopLogo {...props} />;
}
