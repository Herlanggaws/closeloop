import Link from "next/link";

type SaidloopLogoProps = {
  href?: string | null;
  /** Visual height of the mark in px; wordmark scales with it. */
  height?: number;
  /** Use white mark + wordmark for dark backgrounds. */
  onDark?: boolean;
  className?: string;
};

/** Open-loop mark from Brand Guidelines (TQYXQ): ring with gap at ~11 o'clock. */
export const SAIDLOOP_MARK_PATH =
  "M2.574 3.927A11 11 0 1 0 11.957 0.044L11.479 5.522A5.5 5.5 0 1 1 6.787 7.464Z";

export function SaidloopLogo({
  href = "/",
  height = 22,
  onDark = false,
  className = "",
}: SaidloopLogoProps) {
  const color = onDark ? "#FFFFFF" : "#0A0A0A";
  const fontSize = Math.round(height * (20 / 22) * 10) / 10;
  const gap = Math.round(height * (7 / 22) * 10) / 10;

  const content = (
    <>
      <svg
        width={height}
        height={height}
        viewBox="0 0 22 22"
        fill={color}
        aria-hidden="true"
        className="shrink-0"
      >
        <path d={SAIDLOOP_MARK_PATH} />
      </svg>
      <span
        className="font-[family-name:var(--font-geist-sans)] font-bold leading-none tracking-tight"
        style={{ fontSize, letterSpacing: "-0.035em" }}
      >
        Saidloop
      </span>
    </>
  );

  const sharedClass = `inline-flex shrink-0 items-center ${className}`;
  const sharedStyle = { gap, color };

  if (href == null) {
    return (
      <span
        data-pencil-name="Logo"
        className={sharedClass}
        style={sharedStyle}
        role="img"
        aria-label="Saidloop"
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      data-pencil-name="Logo"
      className={`${sharedClass} no-underline`}
      style={sharedStyle}
    >
      {content}
    </Link>
  );
}

/** @deprecated Use SaidloopLogo — kept so existing imports keep working. */
export function CloseloopLogo(props: SaidloopLogoProps) {
  return <SaidloopLogo {...props} />;
}
