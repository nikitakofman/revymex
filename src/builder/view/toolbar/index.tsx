// components/Toolbar/index.tsx
import React from "react";
import { useBuilder } from "@/builder/context/builderState";
import InsertPanel from "./InsertPanel";
import LayersPanel from "./LayersPanel";
import CmsPanel from "./CmsPanel";

const Toolbar = () => {
  const { interfaceState } = useBuilder();

  // Render nothing if no panel is open
  if (
    !interfaceState.isInsertOpen &&
    !interfaceState.isLayersOpen &&
    !interfaceState.isCmsOpen
  ) {
    return null;
  }

  return (
    <div className="w-64 fixed z-50 h-screen bg-[#111111]">
      {interfaceState.isInsertOpen && <InsertPanel />}
      {interfaceState.isLayersOpen && <LayersPanel />}
      {interfaceState.isCmsOpen && <CmsPanel />}
    </div>
  );
};

export default Toolbar;
