import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Public board · Saidloop",
};

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 px-6 py-16">
      <h1 className="font-ds-sans text-2xl font-medium text-[#171717]">Public board</h1>
      <p className="font-ds-ui text-[14px] text-[#737373]">
        Open a board with its slug, for example{" "}
        <code className="font-ds-mono text-[13px]">/board/your-project</code>. Builders set the
        slug under{" "}
        <Link href="/app/board" className="text-[#266DF0] no-underline hover:underline">
          Public board
        </Link>{" "}
        in the app.
      </p>
    </main>
  );
}
