import React from "react";
import { useBuilder } from "../context/builderState";
import { Node } from "../reducer/nodeDispatcher";
import { Frame } from "./elements/Frame";
import { ImageElement } from "./elements/ImageElement";
import TextElement from "./elements/TextElement";

interface RenderNodesProps {
  filter: "inViewport" | "outOfViewport";
}

export const RenderNodes: React.FC<RenderNodesProps> = ({ filter }) => {
  const { nodeState } = useBuilder();

  const renderNode = (node: Node) => {
    switch (node.type) {
      case "frame": {
        const children = nodeState.nodes.filter(
          (child) => child.parentId === node.id
        );

        return (
          <Frame key={node.id} node={node}>
            {children.map((childNode) => renderNode(childNode))}
          </Frame>
        );
      }

      case "image":
        return <ImageElement key={node.id} node={node} />;

      case "text":
        return <TextElement key={node.id} node={node} />;

      default:
        return (
          <div key={node.id} style={node.style} data-node-id={node.id}></div>
        );
    }
  };

  const filteredNodes = nodeState.nodes.filter((node: Node) =>
    filter === "inViewport"
      ? node.inViewport === true
      : node.inViewport === false
  );

  const topLevelNodes = filteredNodes.filter((node) => {
    if (node.parentId == null) return true;

    const parentInFilter = filteredNodes.some((n) => n.id === node.parentId);
    return !parentInFilter;
  });

  return <>{topLevelNodes.map(renderNode)}</>;
};
