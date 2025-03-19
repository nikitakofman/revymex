import React, { useMemo } from "react";
import { usePreview } from "../../preview-context";
import { findNodeById } from "../../utils/nodeUtils";
import { ImageNode } from "./ImageNode";
import { VideoNode } from "./VideoNode";
import { TextNode } from "./TextNode";
import { FrameNode } from "./FrameNode";
import { DynamicNode } from "./dynamic-node";

type NodeRendererProps = {
  nodeId: string;
};

export const NodeRenderer: React.FC<NodeRendererProps> = ({ nodeId }) => {
  const { nodeTree, dynamicVariants } = usePreview();

  const node = useMemo(() => {
    // First, check active variants' children.
    for (const [sourceId, variant] of Object.entries(dynamicVariants)) {
      if (variant.children && findNodeById(variant.children, nodeId)) {
        return findNodeById(variant.children, nodeId);
      }
    }
    return findNodeById(nodeTree, nodeId);
  }, [nodeTree, dynamicVariants, nodeId]);

  if (!node) return null;

  // If node is dynamic and not a child of a dynamic parent, wrap it.
  if (node.isDynamic && !node.dynamicParentId) {
    return <DynamicNode nodeId={nodeId} />;
  }

  // Otherwise, render based on node type.
  switch (node.type) {
    case "image":
      return <ImageNode nodeId={nodeId} />;
    case "video":
      return <VideoNode nodeId={nodeId} />;
    case "text":
      return <TextNode nodeId={nodeId} />;
    case "frame":
    default:
      return <FrameNode nodeId={nodeId} />;
  }
};
