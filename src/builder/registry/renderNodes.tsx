import React, { useCallback } from "react";
import { Frame } from "./elements/FrameElement";
import { ImageElement } from "./elements/ImageElement";
import TextElement from "./elements/TextElement";
import DraggedNode from "../context/canvasHelpers/DraggedNode";
import {
  useGetDraggedNodes,
  useGetDragSource,
  useGetDynamicModeNodeId,
  useGetIsDragging,
} from "../context/atoms/drag-store";
import {
  useActiveViewportInDynamicMode,
  useDynamicModeNodeId,
  useGetDynamicPositions,
  dynamicOps,
} from "../context/atoms/dynamic-store";
import {
  NodeId,
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeSharedInfo,
  useGetNodeDynamicInfo,
  useNodeIds,
} from "../context/atoms/node-store";
import {
  useRootNodes,
  useNodeChildren,
  useGetNodeParent,
  useGetDescendants,
} from "../context/atoms/node-store/hierarchy-store";

interface RenderNodesProps {
  filter: "inViewport" | "outOfViewport" | "dynamicMode";
}

export const NodeComponent = ({
  nodeId,
  filter,
  preview = false,
}: {
  nodeId: NodeId;
  filter: RenderNodesProps["filter"];
  preview?: boolean;
}) => {
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeSharedInfo = useGetNodeSharedInfo();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();
  const getDynamicPositions = useGetDynamicPositions();

  const getIsDragging = useGetIsDragging();
  const getDraggedNodes = useGetDraggedNodes();
  const getDragSource = useGetDragSource();

  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();
  const activeViewportId = activeViewportInDynamicMode;

  const parentId = getNodeParent(nodeId);
  const parentFlags = parentId ? getNodeFlags(parentId) : null;

  const isDragging = getIsDragging();
  const draggedNodes = getDraggedNodes();
  const isDragged =
    isDragging && draggedNodes.some((info) => info.node.id === nodeId);
  const dragSource = getDragSource();

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

  const isViewportChild = isViewportDescendant();

  const children = useNodeChildren(nodeId);

  const basics = getNodeBasics(nodeId);
  const style = getNodeStyle(nodeId);
  const flags = getNodeFlags(nodeId);
  const sharedInfo = getNodeSharedInfo(nodeId);
  const dynamicInfo = getNodeDynamicInfo(nodeId);

  // Check if this node has a dynamic position
  const dynamicPositions = getDynamicPositions ? getDynamicPositions() : {};
  const hasDynamicPosition = dynamicPositions && !!dynamicPositions[nodeId];

  if (flags.isVariant && !dynamicModeNodeId && !preview) {
    return null; // Early return - don't render variants outside of dynamic mode
  }

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
    variantParentId: dynamicInfo.variantParentId,
    variantResponsiveId: dynamicInfo.variantResponsiveId,
    isViewport: flags.isViewport,
    viewportWidth: flags.viewportWidth,
    isVariant: flags.isVariant,
    isDynamic: flags.isDynamic,
    isLocked: flags.isLocked,
    isAbsoluteInFrame: flags.isAbsoluteInFrame,
    inViewport: flags.inViewport,
  };

  if (node.style.display === "none") {
    return null;
  }

  if (isDragged && !preview && !(dragSource === "canvas" && !node.parentId)) {
    return null;
  }

  if (basics.type === "placeholder") {
    return (
      <div
        key={nodeId}
        style={{
          ...style,
          pointerEvents: "none",
        }}
        data-node-id={nodeId}
        data-node-type="placeholder"
      />
    );
  }

  const hasParent = parentId !== null;

  if (hasParent) {
    // Existing logic for nodes with parents
  } else if (isViewportChild) {
    // Existing logic for viewport children
  } else {
    // For dynamic mode, implement our special filtering logic
    if (filter === "dynamicMode") {
      // 1. Check if this is the node being edited in dynamic mode
      const isDynamicModeNode = nodeId === dynamicModeNodeId;

      // 2. Check if this is part of the dynamic family being edited
      const isDynamicModeFamily = (() => {
        if (!dynamicModeNodeId) return false;

        // Get the family ID of the node being edited
        const dynamicNodeInfo = getNodeDynamicInfo(dynamicModeNodeId);
        const familyId = dynamicNodeInfo.dynamicFamilyId;

        // Check if this node is in the same family
        return node.dynamicFamilyId === familyId;
      })();

      // 3. Check if the node belongs to the active viewport
      const isInActiveViewport = node.dynamicViewportId === activeViewportId;

      // Hide node if it doesn't meet our criteria for dynamic mode rendering
      if (!isDynamicModeNode && !(isDynamicModeFamily && isInActiveViewport)) {
        return null;
      }
    }

    // Keep existing filters for normal rendering modes
    if (filter === "inViewport" && !node.inViewport) {
      return null;
    }

    if (filter === "outOfViewport" && node.inViewport) {
      return null;
    }
  }

  const sharedIdAttr = node.sharedId ? { "data-shared-id": node.sharedId } : {};

  const viewportAttr =
    filter === "dynamicMode" && node.dynamicViewportId
      ? {
          "data-viewport-id": node.dynamicViewportId,
          "data-viewport-width": node.viewportWidth || 1440,
        }
      : {};

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

  // Create adjusted style with dynamic positions if available
  let adjustedStyle = { ...node.style };

  // Apply dynamic positioning in dynamic mode
  if (dynamicModeNodeId && hasDynamicPosition && !isDragged) {
    const dynamicPosition = dynamicPositions[nodeId];

    // Apply dynamic position for dynamic mode
    adjustedStyle = {
      ...adjustedStyle,
      position: "absolute", // Force absolute positioning in dynamic mode
      left: dynamicPosition.left,
      top: dynamicPosition.top,
    };
  } else if (
    filter === "dynamicMode" &&
    !isDragged &&
    hasPercentageOrFlexWidth()
  ) {
    if (!node.parentId && node.dynamicViewportId === activeViewportId) {
      adjustedStyle.position = "absolute";
    }
  }

  const createViewportWrapper = (
    children: React.ReactNode
  ): React.ReactNode => {
    if (filter === "dynamicMode" && hasPercentageOrFlexWidth()) {
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

  const renderContent = () => {
    switch (node.type) {
      case "frame": {
        // For Frame component, we can't pass style directly,
        // but we can set dynamic position attributes to read inside Frame
        const frameAttrs =
          hasDynamicPosition && dynamicModeNodeId
            ? {
                "data-dynamic-position": "true",
                "data-dynamic-left": dynamicPositions[nodeId].left,
                "data-dynamic-top": dynamicPositions[nodeId].top,
              }
            : {};

        const frameComponent = (
          <Frame
            key={node.id}
            nodeId={node.id}
            {...sharedIdAttr}
            {...viewportAttr}
            {...frameAttrs}
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
        const imageAttrs =
          hasDynamicPosition && dynamicModeNodeId
            ? {
                "data-dynamic-position": "true",
                "data-dynamic-left": dynamicPositions[nodeId].left,
                "data-dynamic-top": dynamicPositions[nodeId].top,
              }
            : {};

        const imageComponent = (
          <ImageElement
            key={node.id}
            nodeId={nodeId}
            {...sharedIdAttr}
            {...viewportAttr}
            {...imageAttrs}
          />
        );

        return createViewportWrapper(imageComponent);
      }

      case "text": {
        const textAttrs =
          hasDynamicPosition && dynamicModeNodeId
            ? {
                "data-dynamic-position": "true",
                "data-dynamic-left": dynamicPositions[nodeId].left,
                "data-dynamic-top": dynamicPositions[nodeId].top,
              }
            : {};

        const textComponent = (
          <TextElement
            key={node.id}
            nodeId={node.id}
            {...sharedIdAttr}
            {...viewportAttr}
            {...textAttrs}
          />
        );

        return createViewportWrapper(textComponent);
      }

      case "video": {
        // For Video, we can pass adjustedStyle directly
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
        // For div elements, we can apply adjustedStyle directly
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

export const RenderNodes: React.FC<RenderNodesProps> = ({ filter }) => {
  const rootNodeIds = useRootNodes();
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const nodeIds = useNodeIds();

  // Use your existing hierarchy hook
  const getDescendants = useGetDescendants();

  // If we have a dynamicModeNodeId, render dynamic mode content
  if (dynamicModeNodeId !== null) {
    // Get the family ID of the dynamic node
    const dynamicNodeInfo = getNodeDynamicInfo(dynamicModeNodeId);
    const familyId = dynamicNodeInfo.dynamicFamilyId;

    // Use a Set to prevent duplicate node IDs
    const nodesToRenderSet = new Set<NodeId>([dynamicModeNodeId]);

    // Keep track of all nodes that will be rendered through parent-child hierarchy
    const childrenToSkip = new Set<NodeId>();

    // Find and include all variants in the same family that belong to the active viewport
    if (familyId && activeViewportInDynamicMode) {
      const variantNodes: NodeId[] = [];

      // First, identify all relevant variants
      nodeIds.forEach((id) => {
        if (id === dynamicModeNodeId) return;

        const flags = getNodeFlags(id);
        const info = getNodeDynamicInfo(id);

        const isRelevantVariant =
          flags.isVariant === true &&
          info.dynamicFamilyId === familyId &&
          info.dynamicViewportId === activeViewportInDynamicMode;

        if (isRelevantVariant) {
          variantNodes.push(id);
        }
      });

      // Collect all descendants using your hierarchy hook
      // Add all descendants of the main node to the skip set
      const mainNodeDescendants = getDescendants(dynamicModeNodeId);
      mainNodeDescendants.forEach((id) => childrenToSkip.add(id));

      // Add all descendants of the variants to the skip set
      variantNodes.forEach((variantId) => {
        const variantDescendants = getDescendants(variantId);
        variantDescendants.forEach((id) => childrenToSkip.add(id));
      });

      // Now add all variants to render set
      variantNodes.forEach((id) => {
        nodesToRenderSet.add(id);
      });
    }

    // Convert Set to Array for rendering
    // Filter out any nodes that will be rendered through their parent's hierarchy
    const nodesToRender = Array.from(nodesToRenderSet).filter(
      (id) => !childrenToSkip.has(id)
    );

    // Render only top-level nodes - their children will be rendered through the hierarchy
    return (
      <>
        {nodesToRender.map((nodeId) => (
          <NodeComponent key={nodeId} nodeId={nodeId} filter={filter} />
        ))}
      </>
    );
  }

  // For normal mode, render only root nodes
  return (
    <>
      {rootNodeIds.map((nodeId) => {
        return <NodeComponent key={nodeId} nodeId={nodeId} filter={filter} />;
      })}
    </>
  );
};
