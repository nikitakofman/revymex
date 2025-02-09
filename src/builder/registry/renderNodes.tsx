import React, { useEffect, useState } from "react";
import { useBuilder } from "../context/builderState";
import { Node } from "../reducer/nodeDispatcher";
import { Frame } from "./elements/Frame";
import { ImageElement } from "./elements/ImageElement";
import TextElement from "./elements/TextElement";
import DraggedNode, { VirtualReference } from "./DraggedNode";

import { getFilteredNodes } from "../context/dnd/utils";

interface RenderNodesProps {
  filter: "inViewport" | "outOfViewport" | "dynamicMode";
}

export const RenderNodes: React.FC<RenderNodesProps> = ({ filter }) => {
  const { nodeState, dragState, nodeDisp, transform } = useBuilder();

  const [virtualReference, setVirtualReference] =
    useState<VirtualReference | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setVirtualReference({
        getBoundingClientRect() {
          return {
            top: e.clientY,
            left: e.clientX,
            bottom: e.clientY,
            right: e.clientX,
            width: 0,
            height: 0,
          };
        },
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const filteredNodes = getFilteredNodes(
    nodeState.nodes,
    filter,
    dragState.dynamicModeNodeId
  );

  const renderNode = (node: Node) => {
    const isDragged =
      dragState.isDragging && dragState.draggedNode?.node.id === node.id;

    const content = (() => {
      switch (node.type) {
        case "frame": {
          const children = nodeState.nodes.filter(
            (child) => child.parentId === node.id
          );

          // if (node.isDynamic && !node.dynamicParentId) {
          //   nodeDisp.updateNodeDynamicStatus(node.id);
          // }

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
    })();

    if (isDragged) {
      return (
        <DraggedNode
          key={`dragged-${node.id}`}
          node={node}
          content={content}
          virtualReference={virtualReference}
          transform={transform}
          offset={dragState.draggedNode!.offset}
        />
      );
    }

    return content;
  };

  const topLevelNodes = filteredNodes.filter((node) => {
    if (node.parentId == null) return true;

    return !filteredNodes.some((n) => n.id === node.parentId);
  });

  return <>{topLevelNodes.map(renderNode)}</>;
};
