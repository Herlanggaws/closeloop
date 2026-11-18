import type { Metadata } from "next";
import { PublicBoardView } from "@/design-screens/PublicBoardView";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug} · Feedback board · Saidloop`,
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <PublicBoardView slug={slug} />;
}
