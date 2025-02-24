import React from "react";
import { useBuilder } from "@/builder/context/builderState";
import InsertPanel from "./InsertPanel";
import LayersPanel from "./LayersPanel";
import CmsPanel from "./CmsPanel";
import Layers from "./Layers";

const Toolbar = () => {
  const { interfaceState } = useBuilder();

  // Always render the toolbar
  return (
    <div className="w-64 fixed z-50 h-screen bg-[#111111]">
      {/* Show Insert or CMS panels if they're open, otherwise show Layers */}
      {interfaceState.isInsertOpen ? (
        <InsertPanel />
      ) : interfaceState.isCmsOpen ? (
        <CmsPanel />
      ) : (
        <Layers />
      )}
    </div>
  );
};

export default Toolbar;
