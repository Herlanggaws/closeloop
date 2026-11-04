import Link from "next/link";

export function CloseloopLogo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      data-pencil-name="Logo"
      className="box-border flex h-fit w-fit shrink-0 flex-row items-center justify-start gap-[8px] no-underline"
    >
      <div data-pencil-name="Mark" className="relative box-border h-[22px] w-[22px] shrink-0">
        <div
          data-pencil-name="Loop"
          className="absolute top-0 left-0 z-0 box-border h-[22px] w-[22px] bg-[#0A0A0A] [clip-path:path('M7.238_0.663_C2.892_2.245_0_6.376_0_11_C0_17.075_4.925_22_11_22_C17.075_22_22_17.075_22_11_C22_7.748_20.561_4.664_18.071_2.574_L14.96_6.281_C16.354_7.452_17.16_9.179_17.16_11_C17.16_14.402_14.402_17.16_11_17.16_C7.598_17.16_4.84_14.402_4.84_11_C4.84_8.41_6.46_6.097_8.893_5.211_L7.238_0.663_Z')]"
        />
        <div
          data-pencil-name="Dot"
          className="absolute top-[1px] left-[15px] z-1 box-border h-[7px] w-[7px] rounded-[50%] bg-[#22C55E]"
        />
      </div>
      <div
        data-pencil-name="Wordmark"
        className="font-ds-sans box-border text-[20px] leading-[normal] font-semibold tracking-[-0.6px] whitespace-nowrap text-[#0A0A0A]"
      >
        Closeloop
      </div>
    </Link>
  );
}
