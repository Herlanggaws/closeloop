import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { JoinWaitlist } from "@/design-screens/JoinWaitlist";
import type { WaitlistModalView } from "@/components/WaitlistModal";

export const metadata: Metadata = {
  title: "Join Waitlist · Saidloop",
};

const variants: { id: WaitlistModalView; label: string }[] = [
  { id: "enter", label: "S-28a · Enter Email" },
  { id: "invalid", label: "S-28b · Invalid Email" },
  { id: "joined", label: "S-28c · Joined" },
  { id: "already", label: "S-28d · Already Joined" },
];

export default function Page() {
  return (
    <main className="flex flex-col gap-16 bg-[var(--bg-page)] py-12">
      {variants.map((v) => (
        <section key={v.id} className="flex flex-col gap-4">
          <h2 className="mx-auto w-[1440px] font-ds-sans text-lg font-medium tracking-tight text-[#171717]">
            {v.label}
          </h2>
          <DesignFrame height={900}>
            <JoinWaitlist variant={v.id} />
          </DesignFrame>
        </section>
      ))}
    </main>
  );
}
