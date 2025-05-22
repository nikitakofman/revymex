import React, { useCallback } from "react";
import { Frame } from "./elements/FrameElement";
import { ImageElement } from "./elements/ImageElement";
import TextElement from "./elements/TextElement";
import DraggedNode from "../context/canvasHelpers/DraggedNode";
import {
  useDragBackToParentInfo,
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
  useGetDetachedNodes,
} from "../context/atoms/dynamic-store";
import {
  NodeId,
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeSharedInfo,
  useGetNodeDynamicInfo,
  useNodeIds,
  useGetIsTopLevelDynamicNode,
} from "../context/atoms/node-store";
import {
  useRootNodes,
  useNodeChildren,
  useGetNodeParent,
  useGetDescendants,
  useGetNodeChildren,
} from "../context/atoms/node-store/hierarchy-store";

interface RenderNodesProps {
  filter?: "inViewport" | "outOfViewport" | "dynamicMode";
}

export const NodeComponent = ({
  nodeId,
  filter,
  preview = false,
  dragSource = null, // Add this parameter
}: {
  nodeId: NodeId;
  filter: "inViewport" | "outOfViewport" | "dynamicMode";
  preview?: boolean;
  dragSource?: string | null; // Add this parameter type
}) => {
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeSharedInfo = useGetNodeSharedInfo();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();
  const getDynamicPositions = useGetDynamicPositions();

  // Get detached nodes information from dynamic store
  const getDetachedNodes = useGetDetachedNodes();

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

  // Check if this node is being dragged
  const isDragged =
    isDragging && draggedNodes.some((info) => info.node.id === nodeId);

  // Use passed dragSource if provided, otherwise get it from the store
  const currentDragSource = dragSource || getDragSource();

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

  // Check if this node is currently detached for dynamic mode
  const isDetachedForDynamicMode =
    getDetachedNodes && getDetachedNodes().has(nodeId);

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
    isTopLevelDynamicNode: dynamicInfo.isTopLevelDynamicNode,
  };

  if (node.style.display === "none") {
    return null;
  }

  // CRITICAL FIX: Special handling for absolute-in-frame drag source
  if (isDragged && !preview) {
    // For absolute-in-frame dragging, we need to show the node being dragged
    if (currentDragSource === "absolute-in-frame") {
      // Continue rendering when dragging absolute-in-frame
      // Don't return null here! This is the key fix
    } else if (currentDragSource === "canvas" && !node.parentId) {
      // Special case for canvas drag with no parent
      // Continue rendering
    } else {
      // For all other drag sources when not in preview mode, hide the dragged node
      return null;
    }
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

  // Handle filtering for different rendering modes
  if (filter === "dynamicMode") {
    // Don't render viewports or their direct children in dynamic mode
    if (node.isViewport || (parentId && getNodeFlags(parentId)?.isViewport)) {
      return null;
    }

    // Only render nodes that belong to the active viewport in dynamic mode
    const isInActiveViewport = node.dynamicViewportId === activeViewportId;

    // For dynamic mode, check if this node should be shown
    if (!dynamicModeNodeId) {
      return null; // No dynamic mode node set
    }

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

    const hasRenderedDynamicParent = (nodeId) => {
      let currentId = nodeId;
      let parentId = getNodeParent(currentId);

      while (parentId) {
        // If parent is detached for dynamic mode, this child should be rendered
        if (getDetachedNodes().has(parentId)) {
          return true;
        }

        // Get parent info
        const parentInfo = getNodeDynamicInfo(parentId);
        const parentFlags = getNodeFlags(parentId);

        // If parent is the dynamic mode node, this child should be rendered
        if (parentId === dynamicModeNodeId) {
          return true;
        }

        // If parent is a top-level dynamic node in the active viewport
        if (
          dynamicModeNodeId &&
          parentFlags.isDynamic &&
          parentInfo.isTopLevelDynamicNode &&
          parentInfo.dynamicFamilyId ===
            getNodeDynamicInfo(dynamicModeNodeId).dynamicFamilyId &&
          parentInfo.dynamicViewportId === activeViewportId
        ) {
          return true;
        }

        // Move up the chain
        currentId = parentId;
        parentId = getNodeParent(currentId);
      }

      return false;
    };

    // 3. IMPORTANT: Only show nodes that belong to the active viewport
    const shouldShowInDynamicMode =
      // Main node must be in active viewport
      (isDynamicModeNode && isInActiveViewport) ||
      // Detached nodes must be for active viewport
      (isDetachedForDynamicMode && isInActiveViewport) ||
      // Base nodes must be for active viewport and top-level
      (node.isDynamic &&
        !node.isVariant &&
        isDynamicModeFamily &&
        isInActiveViewport &&
        node.isTopLevelDynamicNode) ||
      // VARIANTS: Any variant in the active viewport for this family should be shown
      (node.isVariant && isInActiveViewport && isDynamicModeFamily) ||
      // Children of any of the above should also be rendered
      hasRenderedDynamicParent(nodeId);

    if (!shouldShowInDynamicMode) {
      return null; // Hide nodes that don't meet criteria
    }
  } else {
    // For normal rendering modes, hide detached nodes unless they're in preview
    if (isDetachedForDynamicMode && !preview) {
      return null;
    }

    // Regular filtering logic for normal rendering
    if (hasParent) {
      // Existing logic for nodes with parents
    } else if (isViewportChild) {
      // Existing logic for viewport children
    } else {
      // Keep existing filters for normal rendering modes
      if (filter === "inViewport" && !node.inViewport) {
        return null;
      }

      if (filter === "outOfViewport" && node.inViewport) {
        return null;
      }
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

  const detachedAttr = isDetachedForDynamicMode
    ? { "data-detached-for-dynamic": "true" }
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
  if (dynamicModeNodeId) {
    // If node is detached or is a variant in dynamic mode, ensure absolute positioning
    if (
      isDetachedForDynamicMode ||
      (node.isVariant && node.dynamicViewportId === activeViewportId) ||
      (node.isDynamic && !node.isVariant) // Make sure all dynamic base nodes use absolute positioning
    ) {
      adjustedStyle = {
        ...adjustedStyle,
        position: "absolute", // Force absolute positioning in dynamic mode
      };

      // If it has dynamic position, apply it
      if (hasDynamicPosition && !isDragged) {
        const dynamicPosition = dynamicPositions[nodeId];
        adjustedStyle.left = dynamicPosition.left;
        adjustedStyle.top = dynamicPosition.top;
      }
    }
    // Additional handling for flex width/percentage width elements
    else if (!isDragged && hasPercentageOrFlexWidth()) {
      if (!node.parentId && node.dynamicViewportId === activeViewportId) {
        adjustedStyle.position = "absolute";
      }
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
        const frameAttrs = {
          ...(hasDynamicPosition && dynamicModeNodeId
            ? {
                "data-dynamic-position": "true",
                "data-dynamic-left": dynamicPositions[nodeId].left,
                "data-dynamic-top": dynamicPositions[nodeId].top,
              }
            : {}),
          ...(isDetachedForDynamicMode
            ? { "data-detached-for-dynamic": "true" }
            : {}),
        };

        const frameComponent = (
          <Frame
            key={node.id}
            nodeId={node.id}
            {...sharedIdAttr}
            {...viewportAttr}
            {...frameAttrs}
            {...detachedAttr}
          >
            {children.map((childId) => {
              return (
                <NodeComponent
                  key={childId}
                  nodeId={childId}
                  filter={filter}
                  preview={preview}
                  dragSource={currentDragSource}
                />
              );
            })}
          </Frame>
        );

        return createViewportWrapper(frameComponent);
      }

      // ... the rest of the cases remain the same
      case "image": {
        const imageAttrs = {
          ...(hasDynamicPosition && dynamicModeNodeId
            ? {
                "data-dynamic-position": "true",
                "data-dynamic-left": dynamicPositions[nodeId].left,
                "data-dynamic-top": dynamicPositions[nodeId].top,
              }
            : {}),
          ...(isDetachedForDynamicMode
            ? { "data-detached-for-dynamic": "true" }
            : {}),
        };

        const imageComponent = (
          <ImageElement
            key={node.id}
            nodeId={nodeId}
            {...sharedIdAttr}
            {...viewportAttr}
            {...imageAttrs}
            {...detachedAttr}
          />
        );

        return createViewportWrapper(imageComponent);
      }

      case "text": {
        const textAttrs = {
          ...(hasDynamicPosition && dynamicModeNodeId
            ? {
                "data-dynamic-position": "true",
                "data-dynamic-left": dynamicPositions[nodeId].left,
                "data-dynamic-top": dynamicPositions[nodeId].top,
              }
            : {}),
          ...(isDetachedForDynamicMode
            ? { "data-detached-for-dynamic": "true" }
            : {}),
        };

        const textComponent = (
          <TextElement
            key={node.id}
            nodeId={node.id}
            {...sharedIdAttr}
            {...viewportAttr}
            {...textAttrs}
            {...detachedAttr}
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
            {...detachedAttr}
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
            {...detachedAttr}
          ></div>
        );

        return createViewportWrapper(defaultComponent);
      }
    }
  };
  return renderContent();
};

// The issue with children not rendering might be due to how nodesToRender is constructed
// Make sure we properly add all child nodes to the render set by updating the RenderNodes component:

export const RenderNodes: React.FC<RenderNodesProps> = ({ filter }) => {
  const rootNodeIds = useRootNodes();
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const nodeIds = useNodeIds();
  const getNodeChildren = useGetNodeChildren();
  const getIsTopLevelDynamicNode = useGetIsTopLevelDynamicNode();

  // Add these imports and hooks for drag-and-drop functionality
  const draggedNodes = useGetDraggedNodes();
  const dragBackInfo = useDragBackToParentInfo();
  const isDraggingBackToParent = dragBackInfo?.isDraggingBackToParent;
  const dragSource = useGetDragSource();
  const isDragging = draggedNodes && draggedNodes.length > 0;

  // Get information about detached nodes from dynamic store
  const getDetachedNodes = useGetDetachedNodes?.() || (() => new Set());

  // *** INTERNAL FILTER MANAGEMENT ***
  // If filter is not provided, determine it based on dynamic mode state
  const actualFilter =
    filter || (dynamicModeNodeId ? "dynamicMode" : "outOfViewport");

  // If we have a dynamicModeNodeId, render dynamic mode content
  if (dynamicModeNodeId !== null && actualFilter === "dynamicMode") {
    // Get the family ID of the dynamic node
    const dynamicNodeInfo = getNodeDynamicInfo(dynamicModeNodeId);
    const familyId = dynamicNodeInfo.dynamicFamilyId;

    // This is important - get the active viewport
    const currentViewportId = activeViewportInDynamicMode;

    // Use a Set to prevent duplicate node IDs
    const nodesToRenderSet = new Set<NodeId>();
    // Track which nodes will be processed through their children collection
    const childrenTracking = new Set<NodeId>();

    // First add all detached nodes that are TOP-LEVEL DYNAMIC NODES
    const detachedNodes = getDetachedNodes();
    detachedNodes.forEach((id) => {
      const info = getNodeDynamicInfo(id);
      const flags = getNodeFlags(id);

      // Only add detached nodes for active viewport that are top-level
      if (
        info.dynamicViewportId === currentViewportId &&
        info.isTopLevelDynamicNode
      ) {
        // Add the top-level node itself
        nodesToRenderSet.add(id);

        // Mark all children as being processed through parent
        const markChildrenProcessed = (nodeId) => {
          const children = getNodeChildren(nodeId);
          children.forEach((childId) => {
            childrenTracking.add(childId);
            markChildrenProcessed(childId);
          });
        };

        // Mark all children of this node
        markChildrenProcessed(id);
      }
    });

    // Add the dynamic mode node itself if it's the active viewport
    const mainNodeViewportId = dynamicNodeInfo.dynamicViewportId;
    if (mainNodeViewportId === currentViewportId) {
      // Check if the dynamic mode node is top-level
      if (dynamicNodeInfo.isTopLevelDynamicNode) {
        nodesToRenderSet.add(dynamicModeNodeId);

        // Mark all its children as being processed through parent
        const markChildrenProcessed = (nodeId) => {
          const children = getNodeChildren(nodeId);
          children.forEach((childId) => {
            childrenTracking.add(childId);
            markChildrenProcessed(childId);
          });
        };

        markChildrenProcessed(dynamicModeNodeId);
      }
    }

    // Process all nodes for the current family
    if (familyId && currentViewportId) {
      nodeIds.forEach((id) => {
        if (nodesToRenderSet.has(id) || childrenTracking.has(id)) return; // Skip if already added or will be rendered as a child

        const flags = getNodeFlags(id);
        const info = getNodeDynamicInfo(id);

        // Only add nodes for the active viewport
        if (info.dynamicViewportId !== currentViewportId) {
          return;
        }

        // Add TOP-LEVEL dynamic base nodes for active viewport
        if (
          flags.isDynamic &&
          !flags.isVariant &&
          info.dynamicFamilyId === familyId &&
          info.isTopLevelDynamicNode
        ) {
          nodesToRenderSet.add(id);

          // Mark all its children as being processed through parent
          const markChildrenProcessed = (nodeId) => {
            const children = getNodeChildren(nodeId);
            children.forEach((childId) => {
              childrenTracking.add(childId);
              markChildrenProcessed(childId);
            });
          };

          markChildrenProcessed(id);
        }

        // *** CRITICAL FIX: PROPERLY HANDLE VARIANTS ***
        // Add variant nodes directly - they should be treated as top-level nodes
        if (flags.isVariant && info.dynamicFamilyId === familyId) {
          // Add variants directly to the render set
          nodesToRenderSet.add(id);

          // Mark all variant children to be rendered through the variant
          const markChildrenProcessed = (nodeId) => {
            const children = getNodeChildren(nodeId);
            children.forEach((childId) => {
              childrenTracking.add(childId);
              markChildrenProcessed(childId);
            });
          };

          markChildrenProcessed(id);
        }
      });
    }

    // Convert Set to Array for rendering
    const nodesToRender = Array.from(nodesToRenderSet);

    console.log(
      `Dynamic mode rendering ${nodesToRender.length} nodes for viewport ${currentViewportId}, including variants`
    );

    // Render all nodes in the set
    return (
      <>
        {nodesToRender.map((nodeId) => (
          <NodeComponent
            key={nodeId}
            nodeId={nodeId}
            filter={actualFilter}
            // Critical: Add this to support drag-and-drop in dynamic mode
            preview={isDraggingBackToParent}
            // Pass the drag source for proper absolute-in-frame handling
            dragSource={dragSource()}
          />
        ))}
      </>
    );
  }

  // For normal mode, determine if we need preview mode
  // CRITICAL FIX: Don't use preview mode for absolute-in-frame dragging
  // Instead, pass dragSource to NodeComponent for special handling
  const usePreview = isDraggingBackToParent;

  // For normal mode, render only root nodes with the appropriate filter
  return (
    <>
      {rootNodeIds.map((nodeId) => (
        <NodeComponent
          key={nodeId}
          nodeId={nodeId}
          filter={actualFilter}
          preview={usePreview}
          // CRITICAL: Pass the drag source to NodeComponent
          // This allows NodeComponent to handle absolute-in-frame dragging properly
          dragSource={dragSource()}
        />
      ))}
    </>
  );
};
