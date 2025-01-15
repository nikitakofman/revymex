"use client";

import { BuilderProvider } from "../builder/context/builderState";
import Canvas from "../builder/view/canvas";

export default function Home() {
  return (
    <BuilderProvider>
      <Canvas />
    </BuilderProvider>
  );
}
