import React from "react";
import { useBuilder } from "@/builder/context/builderState";
import InsertPanel from "./InsertPanel";
import CmsPanel from "./CmsPanel";
import Layers from "./Layers";
import PagesPanel from "./PagesPanel";
import LibraryPanel from "./LibraryPanel";
import UIKitsPanel from "./UIKitsPanel";

const InterfaceToolbar = () => {
  const { interfaceState } = useBuilder();

  return (
    <div className="w-64 fixed ml-[52px] left-toolbar z-50 h-screen bg-[var(--bg-toolbar)] border-r border-[var(--border-light)]">
      {interfaceState.isInsertOpen ? (
        <InsertPanel />
      ) : interfaceState.isCmsOpen ? (
        <CmsPanel />
      ) : interfaceState.isPagesOpen ? (
        <PagesPanel />
      ) : interfaceState.isLibraryOpen ? (
        <LibraryPanel />
      ) : interfaceState.isUIKitsOpen ? (
        <UIKitsPanel />
      ) : (
        <Layers />
      )}
    </div>
  );
};

export default InterfaceToolbar;
