import React from "react";
import { ToolContainer, ToolSection } from "./_components/tool-ui";
import { useBuilder } from "@/builder/context/builderState";

const BackgroundColorTool = () => {
  const { setNodeStyle } = useBuilder();

  return (
    <ToolContainer>
      <ToolSection>
        <div className="flex flex-col gap-2">
          <label className="text-sm">Background Color</label>
          <input
            type="color"
            onChange={(e) => {
              setNodeStyle(
                { backgroundColor: e.target.value },
                undefined,
                true
              );
            }}
            className="w-full h-8 cursor-pointer"
          />
        </div>
      </ToolSection>
    </ToolContainer>
  );
};

export default BackgroundColorTool;
