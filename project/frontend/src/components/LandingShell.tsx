"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LandingPageDesign } from "@/app/LandingPage";
import { WaitlistModal } from "@/components/WaitlistModal";

export function LandingShell() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("join") === "1") {
      setOpen(true);
    }
  }, [searchParams]);

  return (
    <>
      <LandingPageDesign onJoinWaitlist={() => setOpen(true)} />
      <WaitlistModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
