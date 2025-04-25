import React from "react";
import {
  Database,
  Plus,
  File,
  Component,
  Globe,
  Palette,
  Library,
  LibraryBig,
} from "lucide-react";
import Button from "@/components/ui/button";
import { Tooltip } from "react-tooltip";
import {
  useIsInsertOpen,
  useIsCmsOpen,
  useIsPagesOpen,
  useIsPreviewOpen,
  useIsLibraryOpen,
  useIsUIKitsOpen,
  interfaceOps,
} from "@/builder/context/atoms/interface-store";

const LeftMenu = () => {
  // Use individual hooks for each state we need
  const isInsertOpen = useIsInsertOpen();
  const isCmsOpen = useIsCmsOpen();
  const isPagesOpen = useIsPagesOpen();
  const isPreviewOpen = useIsPreviewOpen();
  const isLibraryOpen = useIsLibraryOpen();
  const isUIKitsOpen = useIsUIKitsOpen();

  const handleInsertClick = () => {
    if (isInsertOpen) {
      // Simply toggle off if already open
      interfaceOps.toggleInsert();
    } else {
      // The toggleInsert method will automatically close other panels
      interfaceOps.toggleInsert();
    }
  };

  const handlePagesClick = () => {
    if (isPagesOpen) {
      // Simply toggle off if already open
      interfaceOps.togglePages();
    } else {
      // The togglePages method will automatically close other panels
      interfaceOps.togglePages();
    }
  };

  const handleCmsClick = () => {
    if (isCmsOpen) {
      // Simply toggle off if already open
      interfaceOps.toggleCms();
    } else {
      // The toggleCms method will automatically close other panels
      interfaceOps.toggleCms();
    }
  };

  const handleLibraryClick = () => {
    if (isLibraryOpen) {
      // Simply toggle off if already open
      interfaceOps.toggleLibrary();
    } else {
      // The toggleLibrary method will automatically close other panels
      interfaceOps.toggleLibrary();
    }
  };

  const handleUIKitsClick = () => {
    if (isUIKitsOpen) {
      // Simply toggle off if already open
      interfaceOps.toggleUIKits();
    } else {
      // The toggleUIKits method will automatically close other panels
      interfaceOps.toggleUIKits();
    }
  };

  return (
    <div className="left-0 w-[52px] left-menu py-4 bg-[var(--bg-surface)] h-full border-r border-[var(--border-light)] fixed z-[9999] items-center justify-between px-5">
      <div className="flex items-center flex-col gap-2">
        <Button
          leftIcon={<Plus size={32} />}
          size="md"
          className={
            isInsertOpen
              ? "bg-[var(--accent-hover)] text-white"
              : "hover:text-black dark:hover:text-white"
          }
          variant="primary"
          onClick={handleInsertClick}
          data-tooltip-id="interface-tooltip"
          data-tooltip-content="Add"
          data-tooltip-place="right"
        />
        <Button
          leftIcon={<LibraryBig size={20} />}
          size="md"
          variant="ghost"
          className={`${
            isLibraryOpen &&
            "bg-[var(--button-secondary-hover)] hover:bg-[var(--button-secondary-hover)]"
          }`}
          onClick={handleLibraryClick}
          data-tooltip-id="interface-tooltip"
          data-tooltip-content="Library"
          data-tooltip-place="right"
        />
        <Button
          leftIcon={<Palette size={20} />}
          size="md"
          variant="ghost"
          className={`${
            isUIKitsOpen &&
            "bg-[var(--button-secondary-hover)] hover:bg-[var(--button-secondary-hover)]"
          }`}
          onClick={handleUIKitsClick}
          data-tooltip-id="interface-tooltip"
          data-tooltip-content="UI Kits"
          data-tooltip-place="right"
        />
        <Button
          leftIcon={<File size={20} />}
          size="md"
          variant="ghost"
          className={`${
            isPagesOpen &&
            "bg-[var(--button-secondary-hover)] hover:bg-[var(--button-secondary-hover)]"
          }`}
          onClick={handlePagesClick}
          data-tooltip-id="interface-tooltip"
          data-tooltip-content="Pages"
          data-tooltip-place="right"
        />
        <Button
          leftIcon={<Database size={20} />}
          size="md"
          variant="ghost"
          className={
            isCmsOpen
              ? "bg-[var(--button-secondary-hover)] hover:bg-[var(--button-secondary-hover)]"
              : ""
          }
          onClick={handleCmsClick}
          data-tooltip-id="interface-tooltip"
          data-tooltip-content="CMS"
          data-tooltip-place="right"
        />
        <Button
          leftIcon={<Globe size={20} />}
          size="md"
          variant="ghost"
          className={
            isCmsOpen
              ? "bg-[var(--button-secondary-hover)] hover:bg-[var(--button-secondary-hover)]"
              : ""
          }
          onClick={handleCmsClick}
          data-tooltip-id="interface-tooltip"
          data-tooltip-content="Localization"
          data-tooltip-place="right"
        />
      </div>

      <Tooltip
        id="interface-tooltip"
        delayShow={500}
        opacity={1}
        style={{
          backgroundColor: "var(--accent)",
          padding: "6px 10px",
          borderRadius: "4px",
          fontSize: "12px",
          opacity: "1",
          fontWeight: "500",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
        }}
      />
    </div>
  );
};

export default LeftMenu;
