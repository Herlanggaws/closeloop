import type { Metadata } from "next";
import { PublicIdeaDetailView } from "@/design-screens/PublicIdeaDetailView";

type Props = {
  params: Promise<{ slug: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Idea · ${slug} · Saidloop`,
  };
}

export default async function Page({ params }: Props) {
  const { slug, id } = await params;
  return <PublicIdeaDetailView slug={slug} ideaId={id} />;
}
