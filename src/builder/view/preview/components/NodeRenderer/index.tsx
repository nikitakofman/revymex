import React, { useMemo } from "react";
import { ResponsiveNode, Viewport } from "../../types";
import { ImageNode } from "./ImageNode";
import { VideoNode } from "./VideoNode";
import { TextNode } from "./TextNode";
import { FrameNode } from "./FrameNode";

type NodeRendererProps = {
  node: ResponsiveNode;
  currentViewport: number;
  viewportBreakpoints: Viewport[];
};

export const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  currentViewport,
  viewportBreakpoints,
}) => {
  // Create a recursive render function
  const renderNode = useMemo(() => {
    const renderer = (nodeToRender: ResponsiveNode) => {
      switch (nodeToRender.type) {
        case "image":
          return (
            <ImageNode
              key={nodeToRender.id}
              node={nodeToRender}
              viewportBreakpoints={viewportBreakpoints}
            />
          );
        case "video":
          return (
            <VideoNode
              key={nodeToRender.id}
              node={nodeToRender}
              currentViewport={currentViewport}
              viewportBreakpoints={viewportBreakpoints}
            />
          );
        case "text":
          return (
            <TextNode
              key={nodeToRender.id}
              node={nodeToRender}
              viewportBreakpoints={viewportBreakpoints}
            />
          );
        case "frame":
        default:
          return (
            <FrameNode
              key={nodeToRender.id}
              node={nodeToRender}
              currentViewport={currentViewport}
              viewportBreakpoints={viewportBreakpoints}
              renderNode={renderer}
            />
          );
      }
    };
    return renderer;
  }, [currentViewport, viewportBreakpoints]);

  return <>{renderNode(node)}</>;
};
