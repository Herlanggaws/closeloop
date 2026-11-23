/**
 * Saidloop for React Native: forwards to the native Android and iOS SDKs.
 *
 * ```tsx
 * Saidloop.init({ key: "pk_…", api: "https://<your API host>" });
 * Saidloop.identify({ userId: user.id, email: user.email, appVersion: "2.4.1" });
 * Saidloop.show(); // or shake the phone
 *
 * <SaidloopMask><Text>{formatIDR(balance)}</Text></SaidloopMask>
 * ```
 */
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { NativeModules, View, type LayoutChangeEvent } from "react-native";

type NativeSaidloop = {
  start(options: { key: string; api?: string; shakeToReport: boolean; maskTextInputs: boolean }): Promise<void>;
  identify(fields: { userId?: string; email?: string; appVersion?: string }): Promise<void>;
  setMaskRects(rects: MaskRect[]): Promise<void>;
  show(): Promise<void>;
};

export type MaskRect = { x: number; y: number; w: number; h: number };

function native(): NativeSaidloop {
  const mod = NativeModules.Saidloop as NativeSaidloop | undefined;
  if (!mod) {
    throw new Error(
      "Saidloop native module not found. Rebuild the app after installing @saidloop/react-native (Expo: add the config plugin and run a dev build).",
    );
  }
  return mod;
}

export const Saidloop = {
  init(options: { key: string; api?: string; shakeToReport?: boolean; maskTextInputs?: boolean }) {
    if (!options.key.startsWith("pk_")) {
      throw new Error("Saidloop: use your project's public key (pk_…)");
    }
    return native().start({
      key: options.key,
      ...(options.api ? { api: options.api } : {}),
      shakeToReport: options.shakeToReport ?? true,
      maskTextInputs: options.maskTextInputs ?? true,
    });
  },

  identify(fields: { userId?: string; email?: string; appVersion?: string }) {
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null && v !== ""));
    return native().identify(clean);
  },

  /** Opens the native report sheet with a masked screenshot. */
  async show() {
    await masks.flush();
    return native().show();
  },
};

/** Registry of on-screen rectangles to hide; React views are measured in window coordinates (dp/pt). */
class MaskRegistry {
  private rects = new Map<number, MaskRect>();
  private measurers = new Map<number, () => Promise<MaskRect | null>>();
  private lastSent = "";
  private nextId = 1;

  register(measure: () => Promise<MaskRect | null>) {
    const id = this.nextId++;
    this.measurers.set(id, measure);
    return id;
  }

  unregister(id: number) {
    this.measurers.delete(id);
    this.rects.delete(id);
    void this.send();
  }

  async flush() {
    const entries = await Promise.all(
      [...this.measurers.entries()].map(async ([id, m]) => [id, await m()] as const),
    );
    this.rects.clear();
    for (const [id, rect] of entries) if (rect) this.rects.set(id, rect);
    await this.send();
  }

  private async send() {
    const list = [...this.rects.values()];
    const key = JSON.stringify(list);
    if (key === this.lastSent) return;
    this.lastSent = key;
    await native().setMaskRects(list);
  }

  /** Test hook. */
  reset() {
    this.rects.clear();
    this.measurers.clear();
    this.lastSent = "";
  }
}

export const masks = new MaskRegistry();

/** Hides its children in Saidloop screenshots. */
export function SaidloopMask({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null);

  const measure = useCallback(
    () =>
      new Promise<MaskRect | null>((resolve) => {
        const node = ref.current;
        if (!node) return resolve(null);
        node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
      }),
    [],
  );

  useEffect(() => {
    const id = masks.register(measure);
    return () => masks.unregister(id);
  }, [measure]);

  const onLayout = useCallback((_: LayoutChangeEvent) => void masks.flush(), []);

  return (
    <View ref={ref} collapsable={false} onLayout={onLayout}>
      {children}
    </View>
  );
}
