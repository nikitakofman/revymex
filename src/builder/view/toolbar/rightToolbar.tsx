import React from "react";
import LayoutTool from "@/builder/registry/tools/LayoutTool";
import BackgroundColorTool from "@/builder/registry/tools/BackgroundColorTool";

const RIghtToolbar = () => {
  return (
    <div className="w-64 fixed right-0 z-20 h-screen bg-[#111111] p-4">
      <LayoutTool />
      <BackgroundColorTool />
    </div>
  );
};

export default RIghtToolbar;
