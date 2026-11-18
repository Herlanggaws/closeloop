import type { Metadata } from "next";
import { PublicBoardRoadmapView } from "@/design-screens/PublicBoardRoadmapView";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Roadmap · ${slug} · Saidloop`,
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <PublicBoardRoadmapView slug={slug} />;
}
