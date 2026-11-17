"use client";

import { LandingPageDesign } from "@/app/LandingPage";
import { WaitlistModal, type WaitlistModalView } from "@/components/WaitlistModal";

const DEMO_EMAIL = "rina@bearbudget.app";
const INVALID_EMAIL = "rina@bearbudget";
const JOINED_ON = "2025-11-12T00:00:00.000Z";

type Props = {
  variant?: WaitlistModalView;
};

export function JoinWaitlist({ variant = "enter" }: Props) {
  const email = variant === "invalid" ? INVALID_EMAIL : DEMO_EMAIL;

  return (
    <div
      data-pencil-name={
        variant === "enter"
          ? "S-28a Join Waitlist — Enter Email"
          : variant === "invalid"
            ? "S-28b Join Waitlist — Invalid Email"
            : variant === "joined"
              ? "S-28c Join Waitlist — Joined"
              : "S-28d Join Waitlist — Already Joined"
      }
      className="relative h-[900px] w-[1440px] overflow-hidden bg-[#F7F7F7]"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <LandingPageDesign />
      </div>
      <WaitlistModal
        open
        contained
        onClose={() => {}}
        initialView={variant}
        initialEmail={email}
        initialCreatedAt={variant === "already" ? JOINED_ON : ""}
        source="preview-waitlist"
      />
    </div>
  );
}
