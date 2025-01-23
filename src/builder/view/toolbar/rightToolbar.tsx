import React from "react";
import LayoutTool from "@/builder/registry/tools/LayoutTool";
import BackgroundColorTool from "@/builder/registry/tools/BackgroundColorTool";
import { ImageSettings } from "@/builder/registry/tools/ImageSettingsTool";

const RIghtToolbar = () => {
  return (
    <div className="w-64 fixed right-0 z-20 h-screen overflow-auto bg-[#111111] p-4">
      <LayoutTool />
      <BackgroundColorTool />
      <ImageSettings />
    </div>
  );
};

export default RIghtToolbar;
