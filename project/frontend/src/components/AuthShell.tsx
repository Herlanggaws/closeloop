import { AuthForm } from "@/components/AuthForm";
import { AuthStory } from "@/components/AuthStory";

export function AuthShell({ mode }: { mode: "login" | "signup" }) {
  return (
    <main className="min-h-screen overflow-x-auto bg-[var(--surface)]">
      <div
        data-pencil-name="S-02 Sign Up and Log In"
        className="mx-auto box-border flex h-[900px] w-[1440px] flex-row items-start justify-start gap-0 overflow-hidden bg-[#FFFFFF]"
      >
        <AuthForm mode={mode} />
        <AuthStory />
      </div>
    </main>
  );
}
