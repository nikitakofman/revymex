import React from "react";
import { NodeRenderer } from ".";
import { usePreview } from "../../preview-context";

export const NodeTreeRenderer: React.FC = () => {
  const { nodeTree } = usePreview();

  return (
    <>
      {nodeTree.map((node) => (
        <NodeRenderer key={node.id} nodeId={node.id} />
      ))}
    </>
  );
};
