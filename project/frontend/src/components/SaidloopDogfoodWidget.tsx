import Script from "next/script";
import {
  DOGFOOD_WIDGET_API,
  DOGFOOD_WIDGET_KEY,
  DOGFOOD_WIDGET_SRC,
  isDogfoodWidgetEnabled,
} from "@/lib/dogfood-widget";

export function SaidloopDogfoodWidget() {
  if (!isDogfoodWidgetEnabled()) return null;

  return (
    <Script
      src={DOGFOOD_WIDGET_SRC}
      strategy="afterInteractive"
      data-key={DOGFOOD_WIDGET_KEY}
      data-api={DOGFOOD_WIDGET_API}
    />
  );
}
