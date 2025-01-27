import React from "react";
import { useBuilder } from "../context/builderState";
import { Node } from "../reducer/nodeDispatcher";
import { Frame } from "./elements/Frame";
import { ImageElement } from "./elements/ImageElement";
import TextElement from "./elements/TextElement";

interface RenderNodesProps {
  filter: "inViewport" | "outOfViewport" | "dynamicMode";
}

export const RenderNodes: React.FC<RenderNodesProps> = ({ filter }) => {
  const { nodeState, dragState, nodeDisp } = useBuilder();

  const renderNode = (node: Node) => {
    switch (node.type) {
      case "frame": {
        const children = nodeState.nodes.filter(
          (child) => child.parentId === node.id
        );

        if (node.isDynamic && !node.dynamicParentId) {
          nodeDisp.updateNodeDynamicStatus(node.id);
        }

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

  const filteredNodes = nodeState.nodes.filter((node: Node) => {
    // In dynamic mode, show only dynamic elements
    if (filter === "dynamicMode") {
      return (
        node.id === dragState.dynamicModeNodeId ||
        node.dynamicParentId === dragState.dynamicModeNodeId
      );
    }

    // Outside dynamic mode, never show elements with dynamicParentId
    if (node.dynamicParentId) {
      return false;
    }

    // For inViewport/outOfViewport filtering
    return filter === "inViewport"
      ? node.inViewport === true
      : node.inViewport === false;
  });

  const topLevelNodes = filteredNodes.filter((node) => {
    if (node.parentId == null) return true;
    const parentInFilter = filteredNodes.some((n) => n.id === node.parentId);
    return !parentInFilter;
  });

  return <>{topLevelNodes.map(renderNode)}</>;
};
