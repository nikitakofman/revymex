import React, { useEffect, useRef, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { nanoid } from "nanoid";
import {
  useNodeSelected,
  useGetSelectedIds,
  selectOps,
} from "../atoms/select-store";
import { useGetTransform } from "../atoms/canvas-interaction-store";
import {
  useDynamicModeNodeId,
  useActiveViewportInDynamicMode,
} from "../atoms/dynamic-store";
import {
  NodeId,
  useNodeStyle,
  useNodeFlags,
  useNodeDynamicInfo,
  useGetNode,
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeDynamicInfo,
  useGetNodeFlags,
  useGetNodeParent,
  nodeStore,
  nodeIdsAtom,
  useGetNodeIds,
  nodeSharedInfoAtom,
  useGetNodeSharedInfo,
  updateNodeDynamicInfo,
  getCurrentNodes,
  batchNodeUpdates,
} from "../atoms/node-store";
import {
  childrenMapAtom,
  hierarchyStore,
} from "../atoms/node-store/hierarchy-store";
import {
  createDynamicVariant,
  duplicateNode,
  duplicateSubtree,
} from "../atoms/node-store/operations/insert-operations";
import { updateNodeFlags } from "../atoms/node-store/operations/update-operations";

interface AddVariantsUIProps {
  nodeId: NodeId;
}

export const AddVariantsUI: React.FC<AddVariantsUIProps> = ({ nodeId }) => {
  // Get node data directly from atoms
  const style = useNodeStyle(nodeId);
  const flags = useNodeFlags(nodeId);
  const { isDynamic = false, isVariant = false } = flags;

  // Use imperative getters for better performance
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeSharedInfo = useGetNodeSharedInfo();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();
  const getNodeIds = useGetNodeIds();

  // Get dynamic info from atoms
  const dynamicInfo = useNodeDynamicInfo(nodeId);
  const { dynamicFamilyId = null, dynamicViewportId = null } =
    dynamicInfo || {};

  // Get node builder function for topmost parent calculation
  const getNode = useGetNode();

  // Use imperative getter instead of subscription
  const getTransform = useGetTransform();
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();

  // Use node-specific selection check and imperative getter
  const isNodeSelected = useNodeSelected(nodeId);
  const getSelectedIds = useGetSelectedIds();

  // State for element dimensions and position
  const [elementSize, setElementSize] = useState({ width: 0, height: 0 });
  const [buttonPosition, setButtonPosition] = useState({
    left: 0,
    top: 0,
    position: "right",
  });
  const [isPositionAvailable, setIsPositionAvailable] = useState(true);
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Find the topmost parent node in the dynamic family
  const topmostParent = React.useMemo(() => {
    // If not in dynamic mode, return the current node
    if (!dynamicModeNodeId) return getNode(nodeId);

    // Get all node IDs from the store
    const allNodeIds = getNodeIds();

    // Get the dynamic family ID
    const familyNode = getNodeDynamicInfo(dynamicModeNodeId);
    const familyId = familyNode?.dynamicFamilyId;

    if (!familyId) return getNode(nodeId);

    // First check if current node is already a top-level node in this family
    const currentNodeFlags = getNodeFlags(nodeId);
    const currentNodeDynamicInfo = getNodeDynamicInfo(nodeId);

    if (
      (currentNodeFlags.isDynamic || currentNodeFlags.isVariant) &&
      currentNodeDynamicInfo.dynamicFamilyId === familyId &&
      !getNodeParent(nodeId)
    ) {
      return getNode(nodeId);
    }

    // Otherwise, find the top-level node for the selected element
    // Start by finding which top-level node contains this element
    const topLevelNodes = [];

    // Collect all top-level nodes with matching family ID
    for (const id of allNodeIds) {
      const flags = getNodeFlags(id);
      const dynamicInfo = getNodeDynamicInfo(id);
      const parent = getNodeParent(id);

      if (
        (flags.isDynamic || flags.isVariant) &&
        dynamicInfo.dynamicFamilyId === familyId &&
        !parent
      ) {
        topLevelNodes.push(id);
      }
    }

    // Function to check if a node is a descendant of another
    const isDescendantOf = (
      childId: string | number,
      parentId: string | number
    ): boolean => {
      if (!childId) return false;

      let currentId = childId;
      while (currentId) {
        if (currentId === parentId) return true;
        currentId = getNodeParent(currentId);
      }

      return false;
    };

    // Find which top-level node this element belongs to
    for (const topNode of topLevelNodes) {
      if (topNode === nodeId || isDescendantOf(nodeId, topNode)) {
        return getNode(topNode);
      }
    }

    // If no ancestor found, use current node
    return getNode(nodeId);
  }, [
    nodeId,
    dynamicModeNodeId,
    getNode,
    getNodeIds,
    getNodeDynamicInfo,
    getNodeFlags,
    getNodeParent,
  ]);

  // Function to get element bounding rects for all visible nodes
  const getAllNodeRects = () => {
    const rects = new Map();
    const nodeIds = getNodeIds();

    // Filter for visible nodes
    for (const id of nodeIds) {
      const dynamicInfo = getNodeDynamicInfo(id);

      // Skip nodes from other viewports
      if (
        dynamicInfo.dynamicViewportId &&
        dynamicInfo.dynamicViewportId !== activeViewportInDynamicMode
      ) {
        continue;
      }

      // Get DOM element and rect
      const element = document.querySelector(`[data-node-id="${id}"]`);
      if (element) {
        rects.set(id, element.getBoundingClientRect());
      }
    }

    return rects;
  };

  // Find best position for button that doesn't overlap with other nodes
  const findBestButtonPosition = (parentRect, buttonWidth, buttonHeight) => {
    // Get transform only when needed
    const transform = getTransform();

    // Calculate exact offset for spacing (using consistent value regardless of scale)
    const padding = 200; // Original spacing between element and button
    const scaledPadding = padding * transform.scale;

    // Default positions to try in order of preference (perfectly aligned)
    const positions = [
      {
        position: "right",
        left: parentRect.width + padding,
        top: 0,
        alignLeft: false,
        alignCenter: true,
        alignTop: false,
      },
      {
        position: "bottom",
        left: 0,
        top: parentRect.height + padding,
        alignLeft: true,
        alignCenter: false,
        alignTop: false,
      },
      {
        position: "left",
        left: -buttonWidth - padding,
        top: 0,
        alignLeft: false,
        alignCenter: true,
        alignTop: false,
      },
      {
        position: "top",
        left: 0,
        top: -buttonHeight - padding,
        alignLeft: true,
        alignCenter: false,
        alignTop: false,
      },
    ];

    // Get all node rects
    const nodeRects = getAllNodeRects();

    // Button rect factory function - create absolutely positioned rect
    // Always position relative to the topmost parent rect
    const createButtonRect = (position) => {
      // CRITICAL: Start with the exact parent rect coordinates
      let left = parentRect.left;
      let top = parentRect.top;

      // Base position - make sure it's perfectly parallel to the parent edge
      if (position.position === "right") {
        left = parentRect.right + scaledPadding;
      } else if (position.position === "left") {
        left = parentRect.left - buttonWidth * transform.scale - scaledPadding;
      }

      if (position.position === "bottom") {
        top = parentRect.bottom + scaledPadding;
      } else if (position.position === "top") {
        top = parentRect.top - buttonHeight * transform.scale - scaledPadding;
      }

      // Alignment adjustments - perfect alignment with parent
      if (
        position.alignCenter &&
        (position.position === "right" || position.position === "left")
      ) {
        // For right/left positions, center vertically with the PARENT
        top =
          parentRect.top +
          parentRect.height / 2 -
          (buttonHeight * transform.scale) / 2;
      }

      if (
        !position.alignLeft &&
        (position.position === "top" || position.position === "bottom")
      ) {
        // For top/bottom positions, center horizontally with the PARENT
        left =
          parentRect.left +
          parentRect.width / 2 -
          (buttonWidth * transform.scale) / 2;
      }

      return {
        left,
        top,
        right: left + buttonWidth * transform.scale,
        bottom: top + buttonHeight * transform.scale,
        position: position.position,
        scaledLeft: (left - parentRect.left) / transform.scale,
        scaledTop: (top - parentRect.top) / transform.scale,
      };
    };

    // Check if a button position overlaps with any node
    const hasOverlap = (buttonRect) => {
      // Always ensure no overlap with parent node
      if (
        !(
          buttonRect.right < parentRect.left ||
          buttonRect.left > parentRect.right ||
          buttonRect.bottom < parentRect.top ||
          buttonRect.top > parentRect.bottom
        )
      ) {
        return true; // Overlaps with parent
      }

      // Check against all other nodes
      for (const rect of nodeRects.values()) {
        // Skip if this is the parent node
        if (rect === parentRect) continue;

        if (
          !(
            buttonRect.right < rect.left ||
            buttonRect.left > rect.right ||
            buttonRect.bottom < rect.top ||
            buttonRect.top > rect.bottom
          )
        ) {
          return true; // Overlaps with another node
        }
      }
      return false;
    };

    // Try each position
    for (const pos of positions) {
      const buttonRect = createButtonRect(pos);
      if (!hasOverlap(buttonRect)) {
        setIsPositionAvailable(true);
        return {
          left: buttonRect.scaledLeft,
          top: buttonRect.scaledTop,
          position: buttonRect.position,
        };
      }
    }

    // Try fallback position with increased padding
    const fallbackRect = createButtonRect({
      position: "right",
      left: parentRect.width + padding * 3,
      top: 0,
      alignLeft: false,
      alignCenter: true,
      alignTop: false,
    });

    // Check if even the fallback position has overlaps
    if (hasOverlap(fallbackRect)) {
      // All positions overlap - no suitable position found
      setIsPositionAvailable(false);
      return {
        left: fallbackRect.scaledLeft,
        top: fallbackRect.scaledTop,
        position: fallbackRect.position,
      };
    }

    // Fallback position is available
    setIsPositionAvailable(true);
    return {
      left: fallbackRect.scaledLeft,
      top: fallbackRect.scaledTop,
      position: fallbackRect.position,
    };
  };

  // Update size and position whenever the topmost parent changes
  useEffect(() => {
    if (!topmostParent) return;

    const updateButtonPosition = () => {
      // Get transform only when needed
      const transform = getTransform();

      // Always find the DOM element for the topmost parent - this is key
      const element = document.querySelector(
        `[data-node-id="${topmostParent.id}"]`
      );
      if (!element) return;

      // Get the rect of the topmost parent, not the selected child
      const rect = element.getBoundingClientRect();
      const width = rect.width / transform.scale;
      const height = rect.height / transform.scale;

      setElementSize({ width, height });

      // Store the topmost parent rect for consistent positioning
      const topmostParentRect = rect;

      // Find the best position that doesn't overlap with other elements
      // but always relative to the topmost parent
      const bestPosition = findBestButtonPosition(
        topmostParentRect,
        width,
        height
      );
      setButtonPosition(bestPosition);
    };

    updateButtonPosition();

    // Set up an observer to watch for size changes
    if (typeof ResizeObserver !== "undefined") {
      const element = document.querySelector(
        `[data-node-id="${topmostParent.id}"]`
      );
      if (element) {
        const observer = new ResizeObserver(updateButtonPosition);
        observer.observe(element);
        return () => observer.disconnect();
      }
    }

    // Set up an observer to watch for DOM changes that might affect layout
    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(updateButtonPosition);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
      return () => observer.disconnect();
    }
  }, [topmostParent?.id, getTransform]);

  const handleAddVariant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!topmostParent) return;

    console.log("Creating variant for dynamic node:", topmostParent.id);

    //
    const familyId =
      topmostParent.dynamicFamilyId ||
      getNodeDynamicInfo(dynamicModeNodeId)?.dynamicFamilyId ||
      nanoid();

    if (!topmostParent.dynamicFamilyId) {
      console.log("Setting dynamicFamilyId:", familyId);

      updateNodeDynamicInfo(topmostParent.id, {
        dynamicFamilyId: familyId,
      });
    }

    const newVariantId = createDynamicVariant(
      topmostParent.id,
      activeViewportInDynamicMode
    );

    if (newVariantId) {
      setTimeout(() => {
        selectOps.selectNode(newVariantId);
      }, 1);
    }
  };

  const shouldShowVariantButton = useCallback((): boolean => {
    if (!dynamicModeNodeId) return false;

    if (!isPositionAvailable) return false;

    if (!dynamicFamilyId && !topmostParent?.dynamicFamilyId) return false;

    if (topmostParent && nodeId === topmostParent.id) {
      return isNodeSelected;
    }

    return false;
  }, [
    dynamicModeNodeId,
    isPositionAvailable,
    dynamicFamilyId,
    nodeId,
    topmostParent,
    isNodeSelected,
  ]);

  if (!shouldShowVariantButton() || !topmostParent) return null;

  // Get transform only when rendering the button
  const transform = getTransform();

  return (
    <div
      ref={elementRef}
      className="absolute pointer-events-auto"
      style={{
        left: `${buttonPosition.left}px`,
        top: `${buttonPosition.top}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2001, // Original z-index
      }}
    >
      <button
        onClick={handleAddVariant}
        className="bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)] flex items-center justify-center text-white shadow-md"
        style={{
          borderRadius: style.borderRadius,
          width: `${elementSize.width}px`,
          height: `${elementSize.height}px`,
          border: `${2 / transform.scale}px solid var(--border-light)`,
        }}
        title={`Add Variant for ${topmostParent.type}`}
      >
        <Plus size={24 / transform.scale} />
      </button>
    </div>
  );
};

export default AddVariantsUI;
