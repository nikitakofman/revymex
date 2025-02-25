import React from "react";
import { useBuilder } from "@/builder/context/builderState";
import InsertPanel from "./InsertPanel";
import CmsPanel from "./CmsPanel";
import Layers from "./Layers";

const InterfaceTools = () => {
  const { interfaceState } = useBuilder();

  return (
    <div className="w-64 fixed z-50 h-screen bg-[var(--bg-toolbar)] border-r border-[var(--border-light)]">
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

export default InterfaceTools;
