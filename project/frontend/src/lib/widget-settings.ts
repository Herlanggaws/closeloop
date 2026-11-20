// S-12 Widget section (nZUSl). Mirrors backend/internal/application/widget_settings.go.

export type WidgetPosition = "bottom_right" | "bottom_left" | "hidden";

export type WidgetSettings = {
  label: string;
  position: WidgetPosition;
  accent: string;
};

export const DEFAULT_WIDGET: WidgetSettings = {
  label: "Report a problem",
  position: "bottom_right",
  accent: "#171717",
};

export const WIDGET_POSITIONS: { id: WidgetPosition; label: string }[] = [
  { id: "bottom_right", label: "Bottom right" },
  { id: "bottom_left", label: "Bottom left" },
  { id: "hidden", label: "Hidden" },
];

/** Swatches from the frame. Only the first (default) is free; the rest are Studio branding. */
export const WIDGET_ACCENTS = ["#171717", "#F59E0B", "#266DF0", "#16A34A"];
