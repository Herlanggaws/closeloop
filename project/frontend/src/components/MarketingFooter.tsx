import Link from "next/link";
import { SaidloopLogo } from "@/components/SaidloopLogo";
import { MARKETING_FOOTER_COLUMNS } from "@/lib/marketing-links";

const linkClass =
  "text-[13px]/[normal] box-border text-[#FFFFFF80] font-ds-ui font-normal text-left no-underline transition-opacity duration-150 hover:opacity-80 [white-space:nowrap]";

const headingClass =
  "text-[13px]/[normal] box-border text-[#FFFFFF] font-ds-ui font-medium text-left [white-space:nowrap]";

export function MarketingFooter() {
  return (
    <footer
      id="footer"
      data-pencil-name="Footer"
      className="box-border flex w-full shrink-0 flex-col items-start justify-start gap-[48px] bg-[#0A0A0A] px-6 pb-8 pt-16 sm:px-12 lg:px-20"
    >
      <div
        data-pencil-name="Top"
        className="box-border flex w-full shrink-0 flex-col items-start justify-between gap-10 lg:flex-row"
      >
        <div
          data-pencil-name="Brand"
          className="box-border flex h-fit w-fit shrink-0 flex-col items-start justify-start gap-[16px]"
        >
          <SaidloopLogo height={22} onDark href="/" />
          <div
            data-pencil-name="Tag"
            className="text-[14px]/[normal] box-border text-left font-ds-ui font-normal text-[#FFFFFFB3] [white-space:nowrap]"
          >
            Feedback your AI agent can close.
          </div>
        </div>
        <div
          data-pencil-name="Link Columns"
          className="box-border flex h-fit w-fit shrink-0 flex-col items-start justify-start gap-10 sm:flex-row sm:gap-[80px]"
        >
          {MARKETING_FOOTER_COLUMNS.map((column) => (
            <div
              key={column.title}
              data-pencil-name={column.title}
              className="box-border flex h-fit w-fit shrink-0 flex-col items-start justify-start gap-[12px]"
            >
              <div data-pencil-name="H" className={headingClass}>
                {column.title}
              </div>
              {column.links.map((link) =>
                link.href.startsWith("/#") ? (
                  <a
                    key={link.href}
                    href={link.href}
                    data-pencil-name={link.label}
                    className={linkClass}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-pencil-name={link.label}
                    className={linkClass}
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div
        data-pencil-name="Bottom"
        className="box-border flex w-full shrink-0 flex-col items-start justify-between gap-3 border-t border-solid border-[#FFFFFF1A] pt-5 sm:flex-row sm:items-start"
      >
        <div
          data-pencil-name="C"
          className="text-[12px]/[normal] box-border text-left font-ds-ui font-normal text-[#FFFFFF80]"
        >
          Made by a{" "}
          <a
            href="https://xerv-project.id/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFFFFF80] no-underline transition-opacity duration-150 hover:opacity-80"
          >
            Xerv
          </a>
          .
        </div>
        <div
          data-pencil-name="S"
          className="text-[12px]/[normal] box-border text-left font-ds-ui font-normal text-[#FFFFFF80] [white-space:nowrap]"
        >
          Status · X · GitHub
        </div>
      </div>
    </footer>
  );
}
