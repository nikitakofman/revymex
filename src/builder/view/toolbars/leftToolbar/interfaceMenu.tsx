import React from "react";
import { Database, Plus, File, Component, Globe } from "lucide-react";
import Button from "@/components/ui/button";
import { useBuilder } from "@/builder/context/builderState";
import { Tooltip } from "react-tooltip";

const InterfaceMenu = () => {
  const { interfaceState, interfaceDisp } = useBuilder();

  const handleInsertClick = () => {
    if (interfaceState.isInsertOpen) {
      interfaceDisp.toggleInsert();
    } else {
      if (interfaceState.isCmsOpen) interfaceDisp.toggleCms();
      if (interfaceState.isInsertOpen) interfaceDisp.toggleInsert();
      if (interfaceState.isPagesOpen) interfaceDisp.togglePages();
      if (interfaceState.isPreviewOpen) interfaceDisp.togglePreview();
      if (interfaceState.isComponentsOpen) interfaceDisp.toggleComponents();
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
      if (interfaceState.isComponentsOpen) interfaceDisp.toggleComponents();
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
      if (interfaceState.isComponentsOpen) interfaceDisp.toggleComponents();
      interfaceDisp.toggleCms();
    }
  };

  const handleComponentsClick = () => {
    if (interfaceState.isComponentsOpen) {
      interfaceDisp.toggleComponents();
    } else {
      if (interfaceState.isInsertOpen) interfaceDisp.toggleInsert();
      if (interfaceState.isCmsOpen) interfaceDisp.toggleCms();
      if (interfaceState.isPagesOpen) interfaceDisp.togglePages();
      if (interfaceState.isPreviewOpen) interfaceDisp.togglePreview();
      if (interfaceState.isComponentsOpen) interfaceDisp.toggleComponents();
      interfaceDisp.toggleComponents();
    }
  };

  return (
    <div className="left-0 w-[52px] py-4 bg-[var(--bg-surface)] h-full border-r border-[var(--border-light)] fixed z-[9999] items-center justify-between px-5">
      <div className="flex items-center flex-col gap-2">
        <Button
          leftIcon={<Plus size={32} />}
          size="md"
          className={
            interfaceState.isInsertOpen
              ? "bg-[var(--accent)] text-white"
              : "hover:text-black dark:hover:text-white"
          }
          variant="primary"
          onClick={handleInsertClick}
          data-tooltip-id="interface-tooltip"
          data-tooltip-content="Add"
          data-tooltip-place="right"
        />
        <Button
          leftIcon={<Component size={20} />}
          size="md"
          variant="ghost"
          className={`${
            interfaceState.isComponentsOpen &&
            "bg-[var(--button-secondary-hover)]"
          }`}
          onClick={handleComponentsClick}
          data-tooltip-id="interface-tooltip"
          data-tooltip-content="Components"
          data-tooltip-place="right"
        />
        <Button
          leftIcon={<File size={20} />}
          size="md"
          variant="ghost"
          className={`${
            interfaceState.isPagesOpen && "bg-[var(--button-secondary-hover)]"
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
            interfaceState.isCmsOpen ? "bg-[var(--button-secondary-hover)]" : ""
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
            interfaceState.isCmsOpen ? "bg-[var(--button-secondary-hover)]" : ""
          }
          onClick={handleCmsClick}
          data-tooltip-id="interface-tooltip"
          data-tooltip-content="Localization"
          data-tooltip-place="right"
        />
      </div>

      <Tooltip
        id="interface-tooltip"
        delayShow={500} // 500ms delay before showing$
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

export default InterfaceMenu;
