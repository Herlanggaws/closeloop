/** Dispatched by @closeloop/widget after a successful report submit. */
export const CLOSELOOP_SUBMITTED_EVENT = "closeloop:submitted";

export function subscribeWidgetSubmitted(handler: (detail: unknown) => void): () => void {
  const onSubmitted = (event: Event) => {
    handler((event as CustomEvent).detail);
  };
  document.addEventListener(CLOSELOOP_SUBMITTED_EVENT, onSubmitted);
  return () => document.removeEventListener(CLOSELOOP_SUBMITTED_EVENT, onSubmitted);
}
