import { buildSnippet, PLATFORM_SUBTITLES } from "@/lib/widget-install";
import { PRODUCT_DOMAIN } from "@/lib/marketing-links";

export function docsSnippet(platform: string): string {
  if (platform === "web") {
    return `<script src="https://${PRODUCT_DOMAIN}/w.js" data-key="pk_…" async></script>`;
  }
  return buildSnippet(platform, "pk_…");
}

export { PLATFORM_SUBTITLES };
