import React from "react";
import { Layers, Database, Play, Upload, Share2, Plus } from "lucide-react";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import { useBuilder } from "@/builder/context/builderState";

const Header = () => {
  const { interfaceState, interfaceDisp } = useBuilder();

  return (
    <div className="h-12 bg-[var(--bg-surface)] border-b border-[var(--border-light)] fixed w-full z-[9999] flex items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <Button
          leftIcon={<Plus size={20} />}
          size="sm"
          className={`${
            interfaceState.isInsertOpen ? "bg-[var(--accent)]" : ""
          }`}
          variant="ghost"
          onClick={() => interfaceDisp.toggleInsert()}
        >
          Insert
        </Button>

        <LineSeparator orientation="vertical" height="26px" />

        <Button
          leftIcon={<Layers size={20} />}
          size="sm"
          variant="ghost"
          className={interfaceState.isLayersOpen ? "bg-[var(--accent)]" : ""}
          onClick={() => interfaceDisp.toggleLayers()}
        >
          <span className="ml-1.5">Layers</span>
        </Button>

        <LineSeparator orientation="vertical" height="26px" />

        <Button
          leftIcon={<Database size={20} />}
          size="sm"
          variant="ghost"
          className={interfaceState.isCmsOpen ? "bg-[var(--accent)]" : ""}
          onClick={() => interfaceDisp.toggleCms()}
        >
          <span className="ml-1.5">CMS</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          leftIcon={<Play size={20} />}
          size="sm"
          variant="ghost"
          className={interfaceState.isPreviewOpen ? "bg-[var(--accent)]" : ""}
          onClick={() => interfaceDisp.togglePreview()}
        >
          <span className="ml-1.5">Preview</span>
        </Button>

        <LineSeparator orientation="vertical" height="26px" />

        <Button leftIcon={<Share2 size={20} />} size="sm" variant="ghost">
          <span className="ml-1.5">Export</span>
        </Button>

        <LineSeparator orientation="vertical" height="26px" />

        <Button leftIcon={<Upload size={20} />} size="sm" variant="ghost">
          <span className="ml-1.5">Publish</span>
        </Button>
      </div>
    </div>
  );
};

export default Header;
