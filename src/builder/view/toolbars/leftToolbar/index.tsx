import React from "react";
import InsertPanel from "./InsertPanel";
import CmsPanel from "./CmsPanel";
import Layers from "./Layers";
import PagesPanel from "./PagesPanel";
import LibraryPanel from "./LibraryPanel";
import UIKitsPanel from "./UIKitsPanel";
import {
  useIsInsertOpen,
  useIsCmsOpen,
  useIsPagesOpen,
  useIsLibraryOpen,
  useIsUIKitsOpen,
} from "@/builder/context/atoms/interface-store";

const InterfaceToolbar = () => {
  // Get interface state from the interface store
  const isInsertOpen = useIsInsertOpen();
  const isCmsOpen = useIsCmsOpen();
  const isPagesOpen = useIsPagesOpen();
  const isLibraryOpen = useIsLibraryOpen();
  const isUIKitsOpen = useIsUIKitsOpen();

  return (
    <div className="w-64 fixed ml-[52px] left-toolbar z-50 h-screen bg-[var(--bg-toolbar)] border-r border-[var(--border-light)]">
      {isInsertOpen ? (
        <InsertPanel />
      ) : isCmsOpen ? (
        <CmsPanel />
      ) : isPagesOpen ? (
        <PagesPanel />
      ) : isLibraryOpen ? (
        <LibraryPanel />
      ) : isUIKitsOpen ? (
        <UIKitsPanel />
      ) : (
        <Layers />
      )}
    </div>
  );
};

export default InterfaceToolbar;
