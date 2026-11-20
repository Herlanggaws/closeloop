// Minimal typings for typechecking this package without installing react-native.
// Apps get the real types from their own react-native install.
declare module "react-native" {
  import type { Component, ReactNode } from "react";
  export const NativeModules: Record<string, unknown>;
  export type LayoutChangeEvent = { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } };
  export class View extends Component<{ children?: ReactNode; collapsable?: boolean; onLayout?: (e: LayoutChangeEvent) => void }> {
    measureInWindow(cb: (x: number, y: number, width: number, height: number) => void): void;
  }
}
