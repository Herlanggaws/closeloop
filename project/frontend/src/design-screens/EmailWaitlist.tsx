export function EmailWaitlist() {
  return (
    <>
      <div
        data-pencil-name="Email: Waitlist"
        className="box-border w-[1440px] h-[900px] flex flex-row gap-[32px] p-[64px_0px] justify-center items-start bg-[#F5F5F5]"
      >
        <div
          data-pencil-name="You're on the Saidloop waitlist"
          className="box-border w-[600px] shrink-0 h-fit [box-shadow:0px_4px_12px_#1717170F] flex flex-col gap-0 justify-start items-start bg-[#FFFFFF] [outline:1px_solid_#17171714] [outline-offset:-0.5px] rounded-[12px]"
        >
          <div
            data-pencil-name="Mail Header"
            className="box-border w-[600px] h-[63.5px] shrink-0 flex flex-col gap-[4px] p-[14px_24px] justify-start items-start bg-[#FAFAFA] [border-width:0px_0px_1px_0px] [border-style:solid] [border-color:#17171714]"
          >
            <div className="text-[14px]/[normal] box-border text-[#171717] font-ds-ui font-semibold text-left [white-space:nowrap]">
              You&apos;re on the Saidloop waitlist
            </div>
            <div className="text-[12px]/[normal] box-border text-[#A3A3A3] font-ds-ui font-normal text-left [white-space:nowrap]">
              Saidloop &lt;updates@saidloop.dev&gt;
            </div>
          </div>
          <div
            data-pencil-name="Body"
            className="box-border w-full h-fit shrink-0 flex flex-col gap-[20px] p-[32px_40px] justify-start items-start"
          >
            <div className="box-border w-fit h-fit shrink-0 flex flex-row gap-[8px] justify-start items-center">
              <div className="box-border w-[28px] shrink-0 h-[28px] flex flex-row gap-0 justify-center items-center bg-[#F59E0B] rounded-[8px]">
                <div className="text-[15px]/[normal] box-border text-[#FFFFFF] font-[Nunito,system-ui,sans-serif] font-extrabold text-left [white-space:nowrap]">
                  S
                </div>
              </div>
              <div className="text-[17px]/[normal] box-border text-[#3B2F2F] font-[Nunito,system-ui,sans-serif] font-extrabold text-left [white-space:nowrap]">
                Saidloop
              </div>
            </div>
            <div className="text-[26px]/[normal] box-border text-[#171717] font-ds-sans font-medium tracking-[-0.5px] text-left [white-space:nowrap]">
              Hi Rina, you&apos;re on the list.
            </div>
            <div className="text-[15px]/[24px] box-border w-full text-[#737373] font-ds-ui font-normal text-left">
              Thanks for signing up. We&apos;ll email you when it&apos;s your turn to try Saidloop — close
              the loop between users and your product.
            </div>
            <div className="text-[13px]/[21px] box-border w-full text-[#A3A3A3] font-ds-ui font-normal text-left">
              No spam. Just one note when a spot opens.
            </div>
          </div>
          <div
            data-pencil-name="Footer"
            className="box-border w-[600px] h-fit shrink-0 flex flex-col gap-[6px] p-[18px_40px] justify-start items-start [border-width:1px_0px_0px_0px] [border-style:solid] [border-color:#17171714]"
          >
            <div className="text-[12px]/[18px] box-border w-full text-[#A3A3A3] font-ds-ui font-normal text-left">
              You&apos;re getting this because you joined the Saidloop waitlist.
            </div>
            <div className="text-[12px]/[normal] box-border text-[#A3A3A3] font-ds-ui font-normal text-left [white-space:nowrap]">
              Sent with Saidloop
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
