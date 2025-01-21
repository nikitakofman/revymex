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

  const renderNode = (node: Node, viewportId?: string | number) => {
    switch (node.type) {
      case "frame": {
        const children = nodeState.nodes.filter(
          (child) => child.parentId === node.id
        );

        return (
          <Frame key={node.id} node={node} viewportId={viewportId}>
            {children.map((childNode) => renderNode(childNode, viewportId))}
          </Frame>
        );
      }

      case "image":
        return (
          <ImageElement key={node.id} node={node} viewportId={viewportId} />
        );

      case "text":
        return (
          <TextElement key={node.id} node={node} viewportId={viewportId} />
        );

      default:
        return (
          <div
            key={node.id}
            style={node.style}
            data-node-id={node.id}
            data-viewport-context={viewportId} // Optional: add viewport context to plain divs
          />
        );
    }
  };

  // Rest stays exactly the same
  const viewportFrames = nodeState.nodes.filter(
    (node) => node.type === "frame" && node.isViewport
  );

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

  if (filter === "outOfViewport") {
    return <>{topLevelNodes.map((node) => renderNode(node))}</>;
  } else {
    return (
      <>
        {viewportFrames.map((viewportFrame) => (
          <Frame key={viewportFrame.id} node={viewportFrame}>
            {topLevelNodes
              .filter((node) => node.type !== "frame" || !node.isViewport)
              .map((node) => renderNode(node, viewportFrame.id))}
          </Frame>
        ))}
      </>
    );
  }
};
