"use client";

import dynamic from "next/dynamic";

const BackgroundRemovalNoSSR = dynamic(
  () => import("./BackgroundRemovalButton"),
  { ssr: false }
);

export default BackgroundRemovalNoSSR;
