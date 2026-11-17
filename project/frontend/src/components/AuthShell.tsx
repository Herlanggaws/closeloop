import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { AuthStory } from "@/components/AuthStory";
import { GoogleOneTap } from "@/components/GoogleOneTap";

export function AuthShell({ mode }: { mode: "login" | "signup" }) {
  return (
    <main className="min-h-screen overflow-x-auto bg-[var(--surface)]">
      <GoogleOneTap />
      <div
        data-pencil-name="S-02 Sign Up and Log In"
        className="mx-auto box-border flex h-[900px] w-[1440px] flex-row items-start justify-start gap-0 overflow-hidden bg-[#FFFFFF]"
      >
        <Suspense fallback={null}>
          <AuthForm mode={mode} />
        </Suspense>
        <AuthStory />
      </div>
    </main>
  );
}
