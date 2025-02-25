import React from "react";
import { useBuilder } from "@/builder/context/builderState";
import InsertPanel from "./InsertPanel";
import CmsPanel from "./CmsPanel";
import Layers from "./Layers";
import PagesPanel from "./PagesPanel";
import ComponentsPanel from "./ComponentsPanel";

const InterfaceToolbar = () => {
  const { interfaceState } = useBuilder();

  return (
    <div className="w-64 fixed pl-1 ml-[44px] z-50 h-screen bg-[var(--bg-toolbar)] border-r border-[var(--border-light)]">
      {interfaceState.isInsertOpen ? (
        <InsertPanel />
      ) : interfaceState.isCmsOpen ? (
        <CmsPanel />
      ) : interfaceState.isPagesOpen ? (
        <PagesPanel />
      ) : interfaceState.isComponentsOpen ? (
        <ComponentsPanel />
      ) : (
        <Layers />
      )}
    </div>
  );
};

export default InterfaceToolbar;
