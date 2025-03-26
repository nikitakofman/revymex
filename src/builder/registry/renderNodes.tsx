import React, { useEffect, useState } from "react";
import { useBuilder } from "../context/builderState";
import { Node } from "../reducer/nodeDispatcher";
import { Frame } from "./elements/FrameElement";
import { ImageElement } from "./elements/ImageElement";
import TextElement from "./elements/TextElement";
import DraggedNode, {
  VirtualReference,
} from "../context/canvasHelpers/DraggedNode";
import { getFilteredNodes } from "../context/utils";
import { VideoElement } from "./elements/VideoElement";

interface RenderNodesProps {
  filter: "inViewport" | "outOfViewport" | "dynamicMode";
}

export const RenderNodes: React.FC<RenderNodesProps> = ({ filter }) => {
  const { nodeState, dragState, transform } = useBuilder();

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

  // Get the active viewport ID from dragState
  const activeViewportId = dragState.activeViewportInDynamicMode;

  // Pass the active viewport to getFilteredNodes
  const viewportFilteredNodes = getFilteredNodes(
    nodeState.nodes,
    filter,
    dragState.dynamicModeNodeId,
    activeViewportId
  );

  // Further filter out nodes with display: none
  const filteredNodes = viewportFilteredNodes.filter(
    (node) => node.style.display !== "none"
  );

  const renderNode = (node: Node, isDraggedVersion = false) => {
    // Skip rendering non-dragged versions of additional dragged nodes
    if (
      !isDraggedVersion &&
      dragState.additionalDraggedNodes?.some((info) => info.node.id === node.id)
    ) {
      return null;
    }

    // Skip rendering hidden nodes
    if (node.style.display === "none") {
      return null;
    }

    // Skip rendering variants that don't match the active viewport
    if (
      filter === "dynamicMode" &&
      node.isVariant &&
      activeViewportId &&
      node.dynamicViewportId &&
      node.dynamicViewportId !== activeViewportId
    ) {
      return null;
    }

    if (
      filter === "dynamicMode" &&
      activeViewportId &&
      node.dynamicViewportId &&
      node.dynamicViewportId !== activeViewportId
    ) {
      return null;
    }

    const isDragged =
      dragState.isDragging && dragState.draggedNode?.node.id === node.id;

    // Add shared-id attribute for DOM consistency across variants
    const sharedIdAttr = node.sharedId
      ? { "data-shared-id": node.sharedId }
      : {};

    const content = (() => {
      switch (node.type) {
        case "frame": {
          // Only include visible children
          const children = nodeState.nodes.filter(
            (child) =>
              child.parentId === node.id && child.style.display !== "none"
          );

          return (
            <Frame key={node.id} node={node} {...sharedIdAttr}>
              {children.map((childNode) => renderNode(childNode))}
            </Frame>
          );
        }

        case "image":
          return <ImageElement key={node.id} node={node} {...sharedIdAttr} />;

        case "text":
          return <TextElement key={node.id} node={node} {...sharedIdAttr} />;

        case "video":
          return <VideoElement key={node.id} node={node} {...sharedIdAttr} />;

        default:
          return (
            <div
              key={node.id}
              style={node.style}
              data-node-id={node.id}
              {...sharedIdAttr}
            ></div>
          );
      }
    })();

    if (isDragged) {
      return (
        <>
          <DraggedNode
            key={`dragged-${node.id}`}
            node={node}
            content={content}
            virtualReference={virtualReference}
            transform={transform}
            offset={dragState.draggedNode!.offset}
          />
          {dragState.isDragging &&
            dragState.additionalDraggedNodes?.map((info) => (
              <DraggedNode
                key={`dragged-${info.node.id}`}
                node={info.node}
                content={renderNode(info.node, true)}
                virtualReference={virtualReference}
                transform={transform}
                offset={info.offset}
              />
            ))}
        </>
      );
    }

    return content;
  };

  const topLevelNodes = filteredNodes.filter((node) => {
    if (node.parentId == null) return true;
    return !filteredNodes.some((n) => n.id === node.parentId);
  });

  return <>{topLevelNodes.map((node) => renderNode(node))}</>;
};
