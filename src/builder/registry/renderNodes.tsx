import React, { useCallback } from "react";
import { Frame } from "./elements/FrameElement";
import { ImageElement } from "./elements/ImageElement";
import TextElement from "./elements/TextElement";
import DraggedNode from "../context/canvasHelpers/DraggedNode";
import { VideoElement } from "./elements/VideoElement";
import {
  useGetAdditionalDraggedNodes,
  useGetDraggedNode,
  useGetIsDragging,
} from "../context/atoms/drag-store";
import {
  useActiveViewportInDynamicMode,
  useDynamicModeNodeId,
} from "../context/atoms/dynamic-store";
import {
  NodeId,
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeSharedInfo,
  useGetNodeDynamicInfo,
} from "../context/atoms/node-store";
import {
  useRootNodes,
  useNodeChildren,
  useGetNodeParent,
} from "../context/atoms/node-store/hierarchy-store";

interface RenderNodesProps {
  filter: "inViewport" | "outOfViewport" | "dynamicMode";
}

// Inside NodeComponent function
export const NodeComponent = ({
  nodeId,
  filter,
  preview = false, // Add a prop to indicate if this is a preview in DragOverlay
}: {
  nodeId: NodeId;
  filter: RenderNodesProps["filter"];
  preview?: boolean;
}) => {
  // Get getter functions (non-reactive)
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeSharedInfo = useGetNodeSharedInfo();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();

  // Get drag state
  const getIsDragging = useGetIsDragging();
  const getDraggedNode = useGetDraggedNode();
  const getAdditionalDraggedNodes = useGetAdditionalDraggedNodes();

  // Get viewport state
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();
  const activeViewportId = activeViewportInDynamicMode;

  // Check if this node is a child of a viewport
  const parentId = getNodeParent(nodeId);
  const parentFlags = parentId ? getNodeFlags(parentId) : null;

  // Check if node is being dragged - DO THIS AFTER ALL HOOKS ARE CALLED
  const isDragging = getIsDragging();
  const draggedNode = getDraggedNode();
  const additionalDraggedNodes = getAdditionalDraggedNodes();
  const isDragged = isDragging && draggedNode?.node.id === nodeId;

  const isViewportDescendant = () => {
    let currentId = nodeId;
    let currentParentId = getNodeParent(currentId);

    while (currentParentId !== null) {
      const parentFlags = getNodeFlags(currentParentId);
      if (parentFlags?.isViewport === true) {
        return true;
      }
      currentId = currentParentId;
      currentParentId = getNodeParent(currentId);
    }

    return false;
  };

  // Keep all viewport descendants visible regardless of filter
  const isViewportChild = isViewportDescendant();

  // Use hierarchy store to get children
  const children = useNodeChildren(nodeId);

  // Build node object from parts
  const basics = getNodeBasics(nodeId);
  const style = getNodeStyle(nodeId);
  const flags = getNodeFlags(nodeId);
  const sharedInfo = getNodeSharedInfo(nodeId);
  const dynamicInfo = getNodeDynamicInfo(nodeId);

  const node = {
    id: basics.id,
    type: basics.type,
    customName: basics.customName,
    style,
    parentId,
    sharedId: sharedInfo.sharedId,
    dynamicViewportId: dynamicInfo.dynamicViewportId,
    dynamicFamilyId: dynamicInfo.dynamicFamilyId,
    dynamicParentId: dynamicInfo.dynamicParentId,
    dynamicConnections: dynamicInfo.dynamicConnections,
    dynamicPosition: dynamicInfo.dynamicPosition,
    originalParentId: dynamicInfo.originalParentId,
    originalState: dynamicInfo.originalState,
    isViewport: flags.isViewport,
    viewportWidth: flags.viewportWidth,
    isVariant: flags.isVariant,
    isDynamic: flags.isDynamic,
    isLocked: flags.isLocked,
    isAbsoluteInFrame: flags.isAbsoluteInFrame,
    inViewport: flags.inViewport,
  };

  // Skip rendering hidden nodes
  if (node.style.display === "none") {
    return null;
  }

  // Skip rendering this node if it's being dragged and this isn't a preview
  if (isDragged && !preview) {
    return null;
  }

  // Skip rendering non-dragged versions of additional dragged nodes
  if (
    !preview &&
    additionalDraggedNodes?.some((info) => info.node.id === nodeId)
  ) {
    return null;
  }

  // Handle placeholder nodes - render them regardless of filters
  if (basics.type === "placeholder") {
    return (
      <div
        key={nodeId}
        style={{
          ...style,
          pointerEvents: "none", // Make sure it doesn't interfere with events
        }}
        data-node-id={nodeId}
        data-node-type="placeholder"
      />
    );
  }

  // Keep all viewport children visible regardless of filter
  // This allows children to be visible when their parent viewport is visible
  const hasParent = parentId !== null;

  // Children with parents should always be visible in their respective parent's context
  if (hasParent) {
    // This node has a parent, so render it regardless of viewport state
    // This allows all children to be visible when their parent is visible
  } else if (isViewportChild) {
    // Skip the inViewport/outOfViewport filtering for viewport children
  } else {
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

    // Filter based on viewport mode - only apply to non-viewport children
    if (filter === "inViewport" && !node.inViewport) {
      return null;
    }

    if (filter === "outOfViewport" && node.inViewport) {
      return null;
    }
  }

  // Add shared-id attribute for DOM consistency across variants
  const sharedIdAttr = node.sharedId ? { "data-shared-id": node.sharedId } : {};

  // Add viewport attributes for dynamic mode
  const viewportAttr =
    filter === "dynamicMode" && node.dynamicViewportId
      ? {
          "data-viewport-id": node.dynamicViewportId,
          "data-viewport-width": node.viewportWidth || 1440,
        }
      : {};

  // Helper function to check if a node's width is percentage-based or flexible
  const hasPercentageOrFlexWidth = (): boolean => {
    const { width, flex } = node.style;

    return (
      (typeof width === "string" && width.includes("%")) ||
      width === "auto" ||
      flex === "1" ||
      flex === "1 0 0px" ||
      flex === "1 1 auto"
    );
  };

  // For dynamic mode and percentage/flex width elements, update their perceived styles
  let adjustedStyle = { ...node.style };

  // In dynamic mode, for dragging operations, convert percentage widths to pixels
  if (filter === "dynamicMode" && !isDragged && hasPercentageOrFlexWidth()) {
    // For top-level nodes in dynamic mode, position absolute
    if (!node.parentId && node.dynamicViewportId === activeViewportId) {
      adjustedStyle.position = "absolute";
    }
  }

  // Create a viewport wrapper for percentage-based or flexible width nodes
  const createViewportWrapper = (
    children: React.ReactNode
  ): React.ReactNode => {
    // Only apply viewport wrapper in dynamic mode for nodes with percentage/flexible width
    if (filter === "dynamicMode" && hasPercentageOrFlexWidth()) {
      // Determine if this node needs a viewport container
      const needsViewportContainer =
        node.dynamicViewportId === activeViewportId && !node.parentId;

      if (needsViewportContainer) {
        const viewportWidth = node.viewportWidth || 1440;

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
              transform: node.style.transform,
              pointerEvents: "none",
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

  // Render node based on its type
  const renderContent = () => {
    switch (node.type) {
      case "frame": {
        const frameComponent = (
          <Frame
            key={node.id}
            nodeId={node.id}
            {...sharedIdAttr}
            {...viewportAttr}
          >
            {children.map((childId) => {
              return (
                <NodeComponent
                  key={childId}
                  nodeId={childId}
                  filter={filter}
                  preview={preview}
                />
              );
            })}
          </Frame>
        );

        return createViewportWrapper(frameComponent);
      }

      case "image": {
        const imageComponent = (
          <ImageElement
            key={node.id}
            nodeId={nodeId}
            {...sharedIdAttr}
            {...viewportAttr}
          />
        );

        return createViewportWrapper(imageComponent);
      }

      case "text": {
        const textComponent = (
          <TextElement
            key={node.id}
            nodeId={node.id}
            {...sharedIdAttr}
            {...viewportAttr}
          />
        );

        return createViewportWrapper(textComponent);
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

        return createViewportWrapper(videoComponent);
      }

      default: {
        const defaultComponent = (
          <div
            key={node.id}
            style={adjustedStyle}
            data-node-id={node.id}
            data-node-type={node.type}
            {...sharedIdAttr}
            {...viewportAttr}
          ></div>
        );

        return createViewportWrapper(defaultComponent);
      }
    }
  };
  return renderContent();
};

// Main RenderNodes component
export const RenderNodes: React.FC<RenderNodesProps> = ({ filter }) => {
  // Get root nodes directly from the hierarchy store
  const rootNodeIds = useRootNodes();

  return (
    <>
      {rootNodeIds.map((nodeId) => {
        return <NodeComponent key={nodeId} nodeId={nodeId} filter={filter} />;
      })}
    </>
  );
};
