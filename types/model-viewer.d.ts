import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement> & {
    src?: string;
    alt?: string;
    "camera-controls"?: boolean;
    "auto-rotate"?: boolean;
    "shadow-intensity"?: string;
    exposure?: string;
    ar?: boolean;
  },
  HTMLElement
>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps;
    }
  }
}

export {};
