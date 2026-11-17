import type { ReactNode } from "react";

export function MarketingPageHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <header className="mb-10 flex flex-col gap-3">
      {eyebrow ? (
        <p className="font-ds-ui m-0 text-[13px] font-medium tracking-[-0.1px] text-[var(--text-secondary)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-ds-sans m-0 text-[36px] font-semibold leading-tight tracking-[-0.8px] text-[var(--text-primary)] sm:text-[40px]">
        {title}
      </h1>
      {description ? (
        <p className="font-ds-ui m-0 max-w-[560px] text-[16px] leading-relaxed text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function MarketingProse({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-prose font-ds-ui flex flex-col gap-5 text-[15px] leading-relaxed text-[var(--text-secondary)] [&_a]:text-[var(--text-primary)] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-4 [&_h2]:font-ds-sans [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.3px] [&_h2]:text-[var(--text-primary)] [&_h3]:mt-2 [&_h3]:font-ds-sans [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-[var(--text-primary)] [&_li]:ml-5 [&_li]:list-disc [&_ol]:m-0 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-2 [&_ol_li]:list-decimal [&_p]:m-0 [&_strong]:font-medium [&_strong]:text-[var(--text-primary)] [&_ul]:m-0 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">
      {children}
    </div>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="font-ds-mono m-0 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-[13px] leading-relaxed text-[var(--text-primary)] whitespace-pre">
      <code>{children}</code>
    </pre>
  );
}
