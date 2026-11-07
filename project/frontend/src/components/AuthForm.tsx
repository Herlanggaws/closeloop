"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { API_URL, api, setAccessToken } from "@/lib/api";
import { CloseloopLogo } from "@/components/CloseloopLogo";

type AuthMode = "login" | "signup";

const COPY: Record<
  AuthMode,
  { title: string; subtitle: string; submit: string; alt: { text: string; href: string; link: string }; showHelp: boolean }
> = {
  signup: {
    title: "Create your account",
    subtitle: "Free plan: 1 project, 50 reports a month. No card needed.",
    submit: "Create account",
    alt: { text: "Have an account?", href: "/login", link: "Log in" },
    showHelp: true,
  },
  login: {
    title: "Welcome back",
    subtitle: "Log in to triage reports and close the loop with your agents.",
    submit: "Log in",
    alt: { text: "No account?", href: "/signup", link: "Sign up" },
    showHelp: false,
  },
};

function MailIcon() {
  return (
    <svg
                    data-pencil-name="I"
                    data-icon-name="mail"
                    data-icon-set="lucide"
                    viewBox="0 0 13.99993896484375 14"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                    className="box-border w-[15px] shrink-0 h-[15px]"
                  >
                    <path
                      d="M2.05762 1.77734q-0.28027 0.04102-0.53321 0.16748-0.34863 0.19824-0.58789 0.50586-0.23584 0.30762-0.32129 0.70069-0.01367 0.10938-0.02734 0.66992l0 3.17871 0 3.17871q0.01367 0.56055 0.02734 0.66992 0.11279 0.5332 0.50245 0.90577 0.39307 0.36914 0.92627 0.46826 0.16748 0.02734 4.95605 0.02734 4.78857 0 4.95605-0.02734 0.5332-0.09912 0.92286-0.46826 0.39307-0.37256 0.50586-0.90577 0.01367-0.10938 0.02734-0.66992l0-3.17871 0-3.17871q-0.01367-0.56055-0.02734-0.66992-0.12647-0.54688-0.53321-0.92285-0.40674-0.37939-0.95019-0.46485-0.1709-0.01367-4.93897-0.01367-4.76465 0-4.90478 0.02734z m9.81298 1.17579q0.09912 0.04443 0.18116 0.12304 0.08545 0.0752 0.12646 0.16065 0.04443 0.08203 0.05127 0.12988 0.00684 0.04785 0.00684 0.18799l0 0.21191-2.46436 1.58252q-2.46436 1.56543-2.53613 1.60303-0.06836 0.03418-0.16748 0.03418l-0.02734 0.01367q-0.0957 0.01367-0.2085-0.04102-0.15381-0.07178-0.65967-0.37939l-4.40918-2.81299 0-0.21191q0-0.14014 0.00684-0.18799 0.00684-0.04785 0.04101-0.12305 0.0376-0.07861 0.12647-0.16064 0.09229-0.08545 0.16748-0.1128 0.07861-0.03076 0.70752-0.04443l4.18701 0 4.18701 0q0.61523 0 0.68359 0.02735z m-5.63964 5.02783q0.22217 0.10938 0.46142 0.15381 0.09912 0.02734 0.30762 0.02734 0.2085 0 0.30762-0.02734 0.30762-0.05811 0.54687-0.19825 0.14014-0.08203 2.26612-1.42529l2.12939-1.36035-0.01367 5.50293-0.04102 0.09912q-0.11279 0.2085-0.3247 0.29395l-0.09571 0.02734-9.5498 0-0.09571-0.02734q-0.21191-0.08545-0.3247-0.29395l-0.04102-0.09912-0.01367-5.50293 2.17041 1.37402q2.17041 1.38428 2.31055 1.45606z"
                      fill="#A3A3A3"
                     />
                  </svg>
  );
}

function LockIcon() {
  return (
    <svg
                    data-pencil-name="I"
                    data-icon-name="lock"
                    data-icon-set="lucide"
                    viewBox="0 0 13.99993896484375 14"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                    className="box-border w-[15px] shrink-0 h-[15px]"
                  >
                    <path
                      d="M6.77441 0.60156q-0.72803 0.02734-1.38769 0.3794-0.65625 0.34863-1.12451 0.92285-0.46826 0.57422-0.64942 1.28857l0 0.01367q-0.07178 0.29395-0.08545 0.48536-0.01367 0.18799-0.02734 1.02539l0 1.10742-0.2666 0q-0.40674 0-0.63916 0.04443-0.229 0.04102-0.45117 0.15039-0.32471 0.16748-0.56397 0.44776-0.23584 0.28027-0.34863 0.64599l-0.05469 0.15381 0 4.7168 0.05469 0.15381q0.15723 0.51953 0.56055 0.86132 0.40674 0.3418 0.93994 0.39991 0.14014 0.02734 4.26904 0.02734 4.12891 0 4.26904-0.02734 0.30762-0.02734 0.58789-0.16748 0.32471-0.15381 0.56055-0.44092 0.23926-0.28711 0.35205-0.65283l0.05469-0.15381 0-4.7168-0.05469-0.15381q-0.11279-0.36572-0.35205-0.64599-0.23584-0.28027-0.56055-0.44776-0.22217-0.10938-0.45459-0.15039-0.229-0.04443-0.63574-0.04443l-0.2666 0 0-1.13477q-0.01367-0.81006-0.02734-0.99804-0.01367-0.19141-0.08545-0.47168l0-0.02735q-0.18115-0.71436-0.66651-1.30224-0.48193-0.58789-1.15185-0.93653-0.82715-0.40674-1.79444-0.35205z m0.70069 1.20313q0.75537 0.15381 1.2749 0.7417 0.3623 0.40674 0.50244 0.92627 0.05811 0.19482 0.06494 0.41357 0.00684 0.21533 0.00684 0.9707l0 0.96729-4.64844 0 0-1.06299q0-0.82715 0.01367-1.0083 0.01367-0.18457 0.09912-0.40674 0.22217-0.64258 0.74854-1.06982 0.52637-0.42725 1.19629-0.5127 0.14014-0.01367 0.3623 0 0.22559 0.01367 0.3794 0.04102z m3.85205 5.25q0.08203 0.04443 0.15723 0.12304 0.07861 0.0752 0.11279 0.15381 0.0376 0.0752 0.0581 0.19483 0.02051 0.11621 0.00684 2.19092l0 1.6372q0 0.3623-0.02734 0.48877-0.01367 0.08545-0.07178 0.14014l-0.01367 0.02734q-0.11279 0.12646-0.26661 0.19824l-0.0957 0.04102-8.37402 0-0.0957-0.04102q-0.15381-0.0581-0.26661-0.19824l-0.01367-0.02734q-0.05811-0.06836-0.07178-0.14014-0.02734-0.12646-0.02734-0.48877l0-1.65088q-0.01367-2.08838 0.01367-2.20117 0.01367-0.18115 0.1333-0.31445 0.11963-0.1333 0.28711-0.17432 0.06836-0.01367 4.25537-0.01367l4.20069 0.01367 0.09912 0.04102z"
                      fill="#A3A3A3"
                     />
                  </svg>
  );
}

function ChromeIcon() {
  return (
    <svg
                  data-pencil-name="Lead Icon"
                  data-icon-name="chrome"
                  data-icon-set="lucide"
                  viewBox="0 0 24 24"
                  preserveAspectRatio="xMidYMid meet"
                  xmlns="http://www.w3.org/2000/svg"
                  className="box-border w-[14px] shrink-0 h-[14px]"
                >
                  <path
                    d="M23 12c0-6.08-4.92-11-11-11-6.08 0-11 4.92-11 11 0 6.08 4.92 11 11 11 6.08 0 11-4.92 11-11z m-13.11-5.45c-0.81 0.48-1.43 1.23-1.74 2.12-0.19 0.52 0.09 1.09 0.61 1.27 0.52 0.19 1.09-0.09 1.27-0.61 0.16-0.44 0.47-0.82 0.88-1.06 0.4-0.24 0.88-0.33 1.35-0.25 0.46 0.08 0.89 0.33 1.19 0.69 0.3 0.36 0.47 0.82 0.47 1.29 0 0.47-0.37 0.96-1.05 1.42-0.32 0.21-0.64 0.37-0.89 0.48-0.12 0.05-0.22 0.09-0.29 0.12-0.03 0.01-0.06 0.02-0.07 0.03l-0.02 0c-0.52 0.18-0.8 0.74-0.63 1.27 0.18 0.52 0.74 0.8 1.27 0.63 0 0 0 0 0 0 0.01 0 0.01-0.01 0.01-0.01 0.01 0 0.02 0 0.04-0.01 0.03-0.01 0.07-0.02 0.12-0.04 0.09-0.04 0.23-0.09 0.38-0.16 0.32-0.14 0.75-0.36 1.18-0.65 0.82-0.54 1.95-1.55 1.95-3.08 0-0.94-0.33-1.86-0.94-2.58-0.61-0.72-1.45-1.21-2.38-1.37-0.93-0.16-1.89 0.02-2.71 0.5z m2.12 9.45l-0.01 0c-0.55 0-1 0.45-1 1 0 0.55 0.45 1 1 1l0.01 0c0.55 0 1-0.45 1-1 0-0.55-0.45-1-1-1z m8.99-4c0 4.97-4.03 9-9 9-4.97 0-9-4.03-9-9 0-4.97 4.03-9 9-9 4.97 0 9 4.03 9 9z"
                    fill="#737373"
                   />
                </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
                    data-pencil-name="I"
                    data-icon-name="building-2"
                    data-icon-set="lucide"
                    viewBox="0 0 13.99993896484375 14"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                    className="box-border w-[14px] shrink-0 h-[14px]"
                  >
                    <path
                      d="M4.35449 1.20313q-0.43408 0.07178-0.77929 0.35205-0.3418 0.28027-0.50928 0.66992l-0.02735 0.04443q-0.05811 0.15381-0.07177 0.22217-0.02734 0.11279-0.02735 0.36572l-0.01367 2.39258-0.34863 0q-0.33838 0-0.47852 0.01367-0.4751 0.07178-0.85449 0.37256-0.37598 0.30078-0.55713 0.76221l-0.01367 0.02734q-0.04443 0.14014-0.05811 0.23926-0.01367 0.15381-0.02734 0.57422l0 1.67822q-0.01367 2.17041 0.01367 2.33789 0.02734 0.30762 0.16748 0.60156 0.15381 0.32471 0.44092 0.56397 0.28711 0.23584 0.65283 0.34863l0.15381 0.05469 9.9668 0 0.15381-0.05469q0.36572-0.11279 0.65283-0.34863 0.28711-0.23926 0.44092-0.56397 0.14014-0.28027 0.18115-0.60156 0.01367-0.16748 0-3.20605l0-2.37891q0-0.54688-0.02734-0.72803-0.01367-0.12646-0.05811-0.25293l-0.02734-0.04101q-0.14014-0.37939-0.44092-0.66651-0.30078-0.28711-0.67676-0.39648-0.15723-0.05811-0.31787-0.07178-0.16065-0.01367-0.44092-0.01367l-0.34863 0 0-0.44775q0-0.29395-0.01367-0.38965-0.01367-0.09912-0.02735-0.18457-0.23926-0.81348-0.96728-1.14844-0.15381-0.06836-0.29395-0.11279l-0.14013-0.04102-2.57715 0q-2.5874 0-2.7002 0.02734z m5.20899 1.17578q0.2085 0.09912 0.30761 0.30761l0.04102 0.09912 0.01367 8.89014-1.17578 0 0-0.67334q0-0.55713-0.02051-0.74512-0.02051-0.19141-0.10595-0.3999-0.18115-0.43408-0.54004-0.72119-0.35547-0.28711-0.8169-0.35889-0.2666-0.04102-0.5332 0-0.46143 0.07178-0.82031 0.35889-0.35547 0.28711-0.53663 0.72119-0.08545 0.2085-0.10595 0.3999-0.02051 0.18799-0.02051 0.74512l0 0.67334-1.17578 0 0.01367-8.89014 0.04102-0.09912q0.07178-0.14014 0.18798-0.229 0.11963-0.09229 0.25977-0.11963 0.08545 0 2.47803 0l2.40967 0 0.09912 0.04102z m-3.83838 1.72265q-0.18115 0.02734-0.32129 0.18115-0.14014 0.15381-0.15381 0.35206 0 0.14014 0.06152 0.28027 0.06494 0.14014 0.19141 0.22217l0.01367 0.01367q0.06836 0.05811 0.15039 0.07178 0.08545 0.01367 0.35205 0.02734l1.96192 0q0.2666-0.01367 0.34863-0.02734 0.08545-0.01367 0.15381-0.07178l0.01367-0.01367q0.21191-0.14014 0.24609-0.36914 0.03418-0.23242-0.09912-0.43409-0.1333-0.20508-0.38281-0.23242-0.11279-0.02734-1.2749-0.02734-1.16211 0-1.26123 0.02734z m6.1455 0.60156q0.21192 0.08545 0.32471 0.29395l0.04102 0.09912 0 6.13184-0.04102 0.09912q-0.04443 0.08203-0.11621 0.16064-0.06836 0.0752-0.13672 0.11963-0.14014 0.06836-0.57422 0.06836l-0.29394 0 0-7 0.34863 0q0.23926 0 0.30762 0.00684 0.07178 0.00684 0.14013 0.0205z m-8.94482 4.34083l0 2.63183-0.29394 0q-0.43408 0-0.57422-0.06836-0.06836-0.04443-0.14014-0.11963-0.06836-0.07861-0.11279-0.16064l-0.04102-0.09912 0-4.38184 0.04102-0.09912q0.04443-0.08203 0.1333-0.16406 0.09229-0.08545 0.1914-0.12989 0.05469-0.01367 0.12989-0.0205 0.07861-0.00684 0.3042-0.00684l0.3623 0 0 2.61817z m2.70361-2.59083q-0.09912 0.04443-0.1914 0.12989-0.08887 0.08203-0.12647 0.16064-0.03418 0.0752-0.04101 0.11621-0.00684 0.04102-0.00684 0.14014 0 0.15381 0.04102 0.25293 0.11279 0.2085 0.3247 0.29394 0.06836 0.02734 0.24952 0.02735l1.12109 0 1.12109 0q0.18115 0 0.24952-0.02735 0.21191-0.08545 0.3247-0.29394 0.04102-0.09912 0.04102-0.25293 0-0.09912-0.00684-0.14014-0.00684-0.04102-0.03418-0.11279-0.04443-0.08203-0.13672-0.16406-0.08887-0.08545-0.17431-0.11963-0.08203-0.0376-0.26319-0.0376l-1.12109 0-1.12109 0q-0.19482 0.01367-0.24952 0.02734z m1.62354 3.52735q0.18115 0.08545 0.2666 0.2666l0.05469 0.08545 0 1.34326-1.14844 0 0-1.34326 0.05469-0.08545q0.11279-0.22217 0.36572-0.30762 0.04102-0.01367 0.18115-0.00683 0.14014 0.00684 0.22559 0.04785z"
                      fill="#737373"
                     />
                  </svg>
  );
}

const fieldShell =
  "box-border flex h-[40px] w-full items-center gap-[8px] rounded-[6px] border border-[var(--border-default)] bg-[var(--surface)] px-[12px] shadow-[0px_1px_2px_#0000000A] transition-[border-color,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-within:border-[var(--border-strong)]";

const primaryBtn =
  "box-border flex h-[40px] w-full cursor-pointer items-center justify-center gap-[8px] rounded-[6px] border-0 bg-[var(--surface-inverse)] px-[16px] font-ds-sans text-[14px] font-medium tracking-[-0.2px] text-[var(--text-inverse)] shadow-[0px_4px_4px_#1717170A] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";

const secondaryBtn =
  "box-border flex h-[40px] w-full cursor-pointer items-center justify-center gap-[8px] rounded-[6px] border border-[var(--border-default)] bg-[var(--surface)] px-[16px] font-ds-sans text-[14px] font-medium tracking-[-0.2px] text-[var(--text-primary)] shadow-[0px_4px_4px_#1717170A] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = COPY[mode];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const err = searchParams?.get("error");
    if (err) {
      setError(err);
    }
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        if (password.length < 10) {
          throw new Error("Password must be at least 10 characters");
        }
        const name = email.split("@")[0] || "Builder";
        const res = await api<{ access_token: string }>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
        setAccessToken(res.access_token);
        router.push("/app/onboarding");
      } else {
        const res = await api<{ access_token: string }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setAccessToken(res.access_token);
        router.push("/app/inbox");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-pencil-name="Form Side"
      className="box-border flex h-full min-h-0 flex-1 flex-col items-start justify-between gap-0 p-[40px_64px]"
    >
      <CloseloopLogo />

      <form data-pencil-name="Form" onSubmit={onSubmit} className="box-border flex w-[400px] flex-col gap-[20px]">
        <div data-pencil-name="Head" className="box-border flex w-full flex-col gap-[8px]">
          <h1 className="font-ds-sans m-0 text-[32px] leading-none font-medium tracking-[-0.8px] text-[var(--text-primary)]">
            {copy.title}
          </h1>
          <p className="font-ds-ui m-0 text-[14px] leading-normal font-normal text-[var(--text-secondary)]">{copy.subtitle}</p>
        </div>

        <button
          type="button"
          data-pencil-name="Google"
          className={secondaryBtn}
          onClick={() => {
            window.location.href = `${API_URL}/api/auth/google`;
          }}
        >
          <ChromeIcon />
          Continue with Google
        </button>

        <div data-pencil-name="Divider" className="box-border flex w-full items-center gap-[12px]">
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          <span className="font-ds-ui text-[12px] text-[var(--text-tertiary)]">or with email</span>
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        </div>

        <label data-pencil-name="Email" className="box-border flex w-full flex-col gap-[6px]">
          <span className="font-ds-ui text-[13px] font-medium text-[var(--text-primary)]">Email</span>
          <div className={fieldShell}>
            <MailIcon />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourapp.com"
              className="font-ds-ui min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        </label>

        <label data-pencil-name="Password" className="box-border flex w-full flex-col gap-[6px]">
          <span className="font-ds-ui text-[13px] font-medium text-[var(--text-primary)]">Password</span>
          <div className={fieldShell}>
            <LockIcon />
            <input
              type="password"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              minLength={mode === "signup" ? 10 : undefined}
              className="font-ds-ui min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          {copy.showHelp ? (
            <span className="font-ds-ui text-[12px] text-[var(--text-tertiary)]">At least 10 characters</span>
          ) : null}
        </label>

        {error ? <p className="font-ds-ui m-0 text-[13px] text-[var(--danger)]">{error}</p> : null}

        <button type="submit" disabled={loading} data-pencil-name="Submit" className={primaryBtn}>
          {loading ? "…" : copy.submit}
        </button>

        <div data-pencil-name="Alt Links" className="box-border flex w-full items-center justify-between">
          <p className="font-ds-ui m-0 text-[13px] text-[var(--text-secondary)]">
            {copy.alt.text}{" "}
            <Link
              href={copy.alt.href}
              className="font-medium text-[var(--text-primary)] no-underline transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-70"
            >
              {copy.alt.link}
            </Link>
          </p>
          <button
            type="button"
            className="font-ds-ui box-border flex cursor-pointer items-center gap-[6px] border-0 bg-transparent p-0 text-[13px] font-medium text-[var(--text-primary)]"
          >
            <BuildingIcon />
            Log in with SSO
          </button>
        </div>
      </form>

      <p className="font-ds-ui m-0 text-[12px] text-[var(--text-tertiary)]">
        By continuing you agree to the Terms and Privacy Policy.
      </p>
    </div>
  );
}
