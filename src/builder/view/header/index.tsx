import React from "react";
import { Frame, Play, Settings, Type } from "lucide-react";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import { useBuilder } from "@/builder/context/builderState";
import { PreviewModal } from "../preview/PreviewRenderer";
import Image from "next/image";
import RevymeIcon from "./revyme-icon";
import { Tooltip } from "react-tooltip";

const Header = () => {
  const {
    interfaceState,
    interfaceDisp,
    nodeState,
    isFrameModeActive,
    isTextModeActive,
  } = useBuilder();

  return (
    <div className="h-[52px] bg-[var(--bg-surface)] border-b border-[var(--border-light)] fixed w-full z-[9999] flex items-center justify-between px-3">
      <div className="flex items-center gap-4 px-2">
        <RevymeIcon />

        <LineSeparator orientation="vertical" height="26px" />

        {/*

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
        </Button> */}
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

      <Tooltip
        id="header-tooltip"
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

export default Header;
