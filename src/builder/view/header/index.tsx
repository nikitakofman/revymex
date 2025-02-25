import React from "react";
import {
  Layers,
  Database,
  Play,
  Upload,
  Share2,
  Plus,
  Cog,
  Settings,
} from "lucide-react";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import { useBuilder } from "@/builder/context/builderState";
import { PreviewModal } from "../preview/PreviewRenderer";
import Image from "next/image";
import RevymeIcon from "./revyme-icon";

const Header = () => {
  const { interfaceState, interfaceDisp, nodeState } = useBuilder();

  const handleInsertClick = () => {
    if (interfaceState.isInsertOpen) {
      // If Insert is open, just close it (will default back to Layers)
      interfaceDisp.toggleInsert();
    } else {
      // If Insert is closed, close other panels and open Insert
      if (interfaceState.isCmsOpen) interfaceDisp.toggleCms();
      interfaceDisp.toggleInsert();
    }
  };

  const handleCmsClick = () => {
    if (interfaceState.isCmsOpen) {
      // If CMS is open, just close it (will default back to Layers)
      interfaceDisp.toggleCms();
    } else {
      // If CMS is closed, close other panels and open CMS
      if (interfaceState.isInsertOpen) interfaceDisp.toggleInsert();
      interfaceDisp.toggleCms();
    }
  };

  return (
    <div className="h-14 bg-[var(--bg-surface)] border-b border-[var(--border-light)] fixed w-full z-[9999] flex items-center justify-between px-3">
      <div className="flex items-center gap-4 px-2">
        <RevymeIcon />

        <LineSeparator orientation="vertical" height="26px" />

        <Button
          leftIcon={<Plus size={32} />}
          size="sm"
          className={
            interfaceState.isInsertOpen
              ? "bg-[var(--accent)]  text-white"
              : "hover:text-black dark:hover:text-white"
          }
          variant="primary"
          onClick={handleInsertClick}
        >
          Insert
        </Button>

        {/* <Button
          leftIcon={<Layers size={20} />}
          size="sm"
          variant="ghost"
          onClick={() => interfaceDisp.toggleLayers()}
          className={
            !interfaceState.isInsertOpen && !interfaceState.isCmsOpen
              ? "bg-[var(--accent)]"
              : ""
          }
        >
          <span className="ml-1.5">Layers</span>
        </Button> */}

        <Button
          leftIcon={<Layers size={20} />}
          size="sm"
          variant="ghost"
          onClick={() => interfaceDisp.toggleLayers()}
        >
          <span className="ml-1.5">Pages</span>
        </Button>

        <Button
          leftIcon={<Database size={20} />}
          size="sm"
          variant="ghost"
          className={interfaceState.isCmsOpen ? "bg-[var(--accent)]" : ""}
          onClick={handleCmsClick}
        >
          <span className="ml-1.5">CMS</span>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          leftIcon={<Settings size={20} />}
          size="sm"
          variant="primary"
        ></Button>

        {/* <LineSeparator orientation="vertical" height="26px" /> */}
        <Button
          leftIcon={<Play size={20} />}
          size="sm"
          variant="primary"
          className={interfaceState.isPreviewOpen ? "bg-[var(--accent)]" : ""}
          onClick={() => interfaceDisp.togglePreview()}
        ></Button>

        {/* <LineSeparator orientation="vertical" height="26px" /> */}

        <Button size="sm" variant="secondary">
          Export
        </Button>

        {/* <LineSeparator orientation="vertical" height="26px" /> */}

        <Button size="sm" variant="primary">
          Publish
        </Button>
      </div>

      <PreviewModal
        isOpen={interfaceState.isPreviewOpen}
        onClose={() => interfaceDisp.togglePreview()}
        nodes={nodeState.nodes}
      />
    </div>
  );
};

export default Header;
