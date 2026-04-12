"use client";

import dynamic from "next/dynamic";

// R3F Canvas requires browser APIs — skip SSR entirely
export const ModelPreview = dynamic(
  () => import("./model-preview-canvas"),
  { ssr: false }
);
