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
import { useBuilder } from "@/builder/context/builderState";
import { Tooltip } from "react-tooltip";

const LeftMenu = () => {
  const { interfaceState, interfaceDisp } = useBuilder();

  const handleInsertClick = () => {
    if (interfaceState.isInsertOpen) {
      interfaceDisp.toggleInsert();
    } else {
      if (interfaceState.isCmsOpen) interfaceDisp.toggleCms();
      if (interfaceState.isInsertOpen) interfaceDisp.toggleInsert();
      if (interfaceState.isPagesOpen) interfaceDisp.togglePages();
      if (interfaceState.isPreviewOpen) interfaceDisp.togglePreview();
      if (interfaceState.isLibraryOpen) interfaceDisp.toggleLibrary();
      interfaceDisp.toggleInsert();
    }
  };

  const handlePagesClick = () => {
    if (interfaceState.isPagesOpen) {
      interfaceDisp.togglePages();
    } else {
      if (interfaceState.isCmsOpen) interfaceDisp.toggleCms();
      if (interfaceState.isInsertOpen) interfaceDisp.toggleInsert();
      if (interfaceState.isPagesOpen) interfaceDisp.togglePages();
      if (interfaceState.isPreviewOpen) interfaceDisp.togglePreview();
      if (interfaceState.isLibraryOpen) interfaceDisp.toggleLibrary();
      interfaceDisp.togglePages();
    }
  };

  const handleCmsClick = () => {
    if (interfaceState.isCmsOpen) {
      interfaceDisp.toggleCms();
    } else {
      if (interfaceState.isInsertOpen) interfaceDisp.toggleInsert();
      if (interfaceState.isCmsOpen) interfaceDisp.toggleCms();
      if (interfaceState.isPagesOpen) interfaceDisp.togglePages();
      if (interfaceState.isPreviewOpen) interfaceDisp.togglePreview();
      if (interfaceState.isLibraryOpen) interfaceDisp.toggleLibrary();
      interfaceDisp.toggleCms();
    }
  };

  const handleLibraryClick = () => {
    if (interfaceState.isLibraryOpen) {
      interfaceDisp.toggleLibrary();
    } else {
      if (interfaceState.isInsertOpen) interfaceDisp.toggleInsert();
      if (interfaceState.isCmsOpen) interfaceDisp.toggleCms();
      if (interfaceState.isPagesOpen) interfaceDisp.togglePages();
      if (interfaceState.isPreviewOpen) interfaceDisp.togglePreview();
      if (interfaceState.isLibraryOpen) interfaceDisp.toggleLibrary();
      interfaceDisp.toggleLibrary();
    }
  };

  const handleUIKitsClick = () => {
    if (interfaceState.isUIKitsOpen) {
      interfaceDisp.toggleUIKits();
    } else {
      if (interfaceState.isInsertOpen) interfaceDisp.toggleInsert();
      if (interfaceState.isCmsOpen) interfaceDisp.toggleCms();
      if (interfaceState.isPagesOpen) interfaceDisp.togglePages();
      if (interfaceState.isPreviewOpen) interfaceDisp.togglePreview();
      if (interfaceState.isLibraryOpen) interfaceDisp.toggleLibrary();
      interfaceDisp.toggleUIKits();
    }
  };

  return (
    <div className="left-0 w-[52px] left-menu py-4 bg-[var(--bg-surface)] h-full border-r border-[var(--border-light)] fixed z-[9999] items-center justify-between px-5">
      <div className="flex items-center flex-col gap-2">
        <Button
          leftIcon={<Plus size={32} />}
          size="md"
          className={
            interfaceState.isInsertOpen
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
            interfaceState.isLibraryOpen &&
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
            interfaceState.isUIKitsOpen &&
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
            interfaceState.isPagesOpen &&
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
            interfaceState.isCmsOpen
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
            interfaceState.isCmsOpen
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
