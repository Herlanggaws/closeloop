/** Saidloop embedded on saidloop.com so the team can report from the product itself. */
export const DOGFOOD_WIDGET_SRC = "https://saidloop.com/w.js";
export const DOGFOOD_WIDGET_KEY = "pk_3e71e4db-b8b5-4896-ab7b-23d6f7521d62";
export const DOGFOOD_WIDGET_API = "https://api.saidloop.com";

export function isDogfoodWidgetEnabled(): boolean {
  const override = process.env.NEXT_PUBLIC_DOGFOOD_WIDGET;
  if (override === "0" || override === "false") return false;
  if (override === "1" || override === "true") return true;
  return true;
}
