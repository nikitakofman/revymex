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
import {
  useGetAdditionalDraggedNodes,
  useGetDraggedNode,
  useGetIsDragging,
} from "../context/atoms/drag-store";
import { useTransform } from "../context/atoms/canvas-interaction-store";
import {
  useActiveViewportInDynamicMode,
  useDynamicModeNodeId,
} from "../context/atoms/dynamic-store";

interface RenderNodesProps {
  filter: "inViewport" | "outOfViewport" | "dynamicMode";
}

export const RenderNodes: React.FC<RenderNodesProps> = ({ filter }) => {
  const { nodeState } = useBuilder();
  const getIsDragging = useGetIsDragging();
  const getDraggedNode = useGetDraggedNode();
  const getAdditionalDraggedNodes = useGetAdditionalDraggedNodes();
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();

  const transform = useTransform();

  const [virtualReference, setVirtualReference] =
    useState<VirtualReference | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const isDragging = getIsDragging();
      // Only update virtualReference when dragging
      if (isDragging) {
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
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [getIsDragging]);

  const activeViewportId = activeViewportInDynamicMode;

  // Find the active viewport node to get its width
  const activeViewport = activeViewportId
    ? nodeState.nodes.find(
        (node) => node.isViewport && node.id === activeViewportId
      )
    : null;

  // Get the viewport width (or default to desktop 1440px if not found)
  const viewportWidth = activeViewport?.viewportWidth || 1440;

  // Pass the active viewport to getFilteredNodes
  const viewportFilteredNodes = getFilteredNodes(
    nodeState.nodes,
    filter,
    dynamicModeNodeId,
    activeViewportId
  );

  // Further filter out nodes with display: none
  const filteredNodes = viewportFilteredNodes.filter(
    (node) => node.style.display !== "none"
  );

  // Helper function to check if a node's width is percentage-based or flexible
  const hasPercentageOrFlexWidth = (node: Node): boolean => {
    const { width, flex } = node.style;

    return (
      (typeof width === "string" && width.includes("%")) ||
      width === "auto" ||
      flex === "1" ||
      flex === "1 0 0px" ||
      flex === "1 1 auto"
    );
  };

  // Create a viewport wrapper for percentage-based or flexible width nodes
  const createViewportWrapper = (
    node: Node,
    children: React.ReactNode
  ): React.ReactNode => {
    // Only apply viewport wrapper in dynamic mode for nodes with percentage/flexible width
    if (filter === "dynamicMode" && hasPercentageOrFlexWidth(node)) {
      // Determine if this node needs a viewport container
      const needsViewportContainer =
        node.dynamicViewportId === activeViewportId && !node.parentId; // Top-level nodes without parents in the current view

      if (needsViewportContainer) {
        return (
          <div
            className="dynamic-viewport-container"
            style={{
              width: `${viewportWidth}px`,
              position: "absolute",
              border: "1px dashed rgba(120, 120, 120, 0.3)",
              backgroundColor: "transparent",
              height: "auto",
              minHeight: "100px",
              // Inherit position from the node but make relative for proper child positioning
              // left: node.position?.x || 0,
              // top: node.position?.y || 0,
              transform: node.style.transform,
              pointerEvents: "none", // Allow clicks to pass through to the actual node
            }}
            data-viewport-width={viewportWidth}
            data-node-id={`viewport-container-${node.id}`}
          >
            {children}
          </div>
        );
      }
    }

    return children;
  };

  const renderNode = (node: Node, isDraggedVersion = false) => {
    const isDragging = getIsDragging();
    const draggedNode = getDraggedNode();
    const additionalDraggedNodes = getAdditionalDraggedNodes();

    // Skip rendering non-dragged versions of additional dragged nodes
    if (
      !isDraggedVersion &&
      additionalDraggedNodes?.some((info) => info.node.id === node.id)
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

    const isDragged = isDragging && draggedNode?.node.id === node.id;

    // Add shared-id attribute for DOM consistency across variants
    const sharedIdAttr = node.sharedId
      ? { "data-shared-id": node.sharedId }
      : {};

    // Add viewport attributes for dynamic mode
    const viewportAttr =
      filter === "dynamicMode" && node.dynamicViewportId
        ? {
            "data-viewport-id": node.dynamicViewportId,
            "data-viewport-width": viewportWidth,
          }
        : {};

    // For dynamic mode and percentage/flex width elements, update their perceived styles
    let adjustedStyle = { ...node.style };

    // In dynamic mode, for dragging operations, convert percentage widths to pixels
    if (
      filter === "dynamicMode" &&
      !isDragged &&
      hasPercentageOrFlexWidth(node)
    ) {
      // If it's a direct child of the active viewport (has no parent in dynamic mode)
      // or if it's at the top level in the current view
      if (
        (!node.parentId && node.dynamicViewportId === activeViewportId) ||
        (node.dynamicViewportId === activeViewportId &&
          !filteredNodes.some((n) => n.id === node.parentId))
      ) {
        // For top-level nodes with percentage width, position absolute to ensure proper rendering
        adjustedStyle.position = "absolute";
      }
    }

    const content = (() => {
      switch (node.type) {
        case "frame": {
          // Only include visible children
          const children = nodeState.nodes.filter(
            (child) =>
              child.parentId === node.id && child.style.display !== "none"
          );

          const frameComponent = (
            <Frame
              key={node.id}
              node={{ ...node, style: adjustedStyle }}
              {...sharedIdAttr}
              {...viewportAttr}
            >
              {children.map((childNode) => renderNode(childNode))}
            </Frame>
          );

          return createViewportWrapper(node, frameComponent);
        }

        case "image": {
          const imageComponent = (
            <ImageElement
              key={node.id}
              node={{ ...node, style: adjustedStyle }}
              {...sharedIdAttr}
              {...viewportAttr}
            />
          );

          return createViewportWrapper(node, imageComponent);
        }

        case "text": {
          const textComponent = (
            <TextElement
              key={node.id}
              node={{ ...node, style: adjustedStyle }}
              {...sharedIdAttr}
              {...viewportAttr}
            />
          );

          return createViewportWrapper(node, textComponent);
        }

        case "video": {
          const videoComponent = (
            <VideoElement
              key={node.id}
              node={{ ...node, style: adjustedStyle }}
              {...sharedIdAttr}
              {...viewportAttr}
            />
          );

          return createViewportWrapper(node, videoComponent);
        }

        default: {
          const defaultComponent = (
            <div
              key={node.id}
              style={adjustedStyle}
              data-node-id={node.id}
              {...sharedIdAttr}
              {...viewportAttr}
            ></div>
          );

          return createViewportWrapper(node, defaultComponent);
        }
      }
    })();

    if (isDragged) {
      const isDragging = getIsDragging();
      return (
        <>
          <DraggedNode
            key={`dragged-${node.id}`}
            node={node}
            content={content}
            virtualReference={virtualReference}
            transform={transform}
            offset={draggedNode!.offset}
          />
          {isDragging &&
            additionalDraggedNodes?.map((info) => (
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
