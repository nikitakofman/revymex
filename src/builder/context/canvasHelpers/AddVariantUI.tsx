import React, { useEffect, useRef, useState, useCallback } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Plus } from "lucide-react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { nanoid } from "nanoid";
import {
  useNodeSelected,
  useGetSelectedIds,
  selectOps,
} from "../atoms/select-store";

interface AddVariantsUIProps {
  node: Node;
  transform: { x: number; y: number; scale: number };
}

export const AddVariantsUI: React.FC<AddVariantsUIProps> = ({ node }) => {
  const { dragState, nodeDisp, nodeState, dragDisp, transform } = useBuilder();

  // Use node-specific selection check and imperative getter
  const isNodeSelected = useNodeSelected(node.id);
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
    if (!dragState.dynamicModeNodeId) return node;

    // Get the dynamic family ID
    const familyNode = nodeState.nodes.find(
      (n) => n.id === dragState.dynamicModeNodeId
    );
    const familyId = familyNode?.dynamicFamilyId;
    if (!familyId) return node;

    // First check if current node is already a top-level node in this family
    if (
      (node.isDynamic || node.isVariant) &&
      node.dynamicFamilyId === familyId &&
      !node.parentId
    ) {
      return node;
    }

    // Otherwise, find the top-level node for the selected element
    // Start by finding which top-level node contains this element
    const topLevelNodes = nodeState.nodes.filter(
      (n) =>
        (n.isDynamic || n.isVariant) &&
        n.dynamicFamilyId === familyId &&
        !n.parentId
    );

    // Function to check if a node is a descendant of another
    const isDescendantOf = (
      childId: string | number,
      parentId: string | number
    ): boolean => {
      const child = nodeState.nodes.find((n) => n.id === childId);
      if (!child) return false;
      if (child.parentId === parentId) return true;
      if (child.parentId) return isDescendantOf(child.parentId, parentId);
      return false;
    };

    // Find which top-level node this element belongs to
    for (const topNode of topLevelNodes) {
      if (topNode.id === node.id || isDescendantOf(node.id, topNode.id)) {
        return topNode;
      }
    }

    // If no ancestor found, use current node
    return node;
  }, [node, nodeState.nodes, dragState.dynamicModeNodeId]);

  // Function to get element bounding rects for all visible nodes
  const getAllNodeRects = () => {
    const rects = new Map();
    const visibleNodes = nodeState.nodes.filter((n) => {
      // Filter for nodes that would be visible in the current viewport
      if (
        n.dynamicViewportId &&
        n.dynamicViewportId !== dragState.activeViewportInDynamicMode
      ) {
        return false;
      }
      return true;
    });

    visibleNodes.forEach((n) => {
      const element = document.querySelector(`[data-node-id="${n.id}"]`);
      if (element) {
        rects.set(n.id, element.getBoundingClientRect());
      }
    });

    return rects;
  };

  // Find best position for button that doesn't overlap with other nodes
  const findBestButtonPosition = (parentRect, buttonWidth, buttonHeight) => {
    // Calculate exact offset for spacing (using consistent value regardless of scale)
    const padding = 200; // Increased spacing between element and button
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
  }, [topmostParent?.id, transform.scale, nodeState.nodes]);

  // Function to handle adding a variant
  const handleAddVariant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!topmostParent) return;

    // Ensure the node has a dynamicFamilyId
    if (!topmostParent.dynamicFamilyId && dragState.dynamicModeNodeId) {
      const mainNode = nodeState.nodes.find(
        (n) => n.id === dragState.dynamicModeNodeId
      );
      const familyId = mainNode?.dynamicFamilyId || nanoid();

      nodeDisp.updateNode(topmostParent.id, { dynamicFamilyId: familyId });
    }

    // Call the NodeDispatcher method to duplicate the element
    // Pass the button position to ensure the new variant appears in the same direction
    const newVariantId = nodeDisp.duplicateDynamicElement(
      topmostParent.id,
      elementSize.width,
      buttonPosition.position // Pass the position (right, left, top, bottom)
    );

    // Select the newly created variant node
    if (newVariantId) {
      setTimeout(() => {
        selectOps.selectNode(newVariantId);
      }, 1);
    }
  };

  // Check if this node should show the variant button
  const shouldShowVariantButton = useCallback((): boolean => {
    if (!dragState.dynamicModeNodeId) return false;

    // Don't show if no position is available
    if (!isPositionAvailable) return false;

    // Only show for nodes that are part of a dynamicFamilyId
    if (!node.dynamicFamilyId && !topmostParent?.dynamicFamilyId) return false;

    // CRITICAL CHANGE: Only show the button when clicking directly on the topmost parent
    // Check if the current node IS the topmost parent (not a child)
    if (topmostParent && node.id === topmostParent.id) {
      // Use the node-specific selection state - prevents re-renders in other components
      return isNodeSelected;
    }

    // For all other nodes (children), don't show the button
    return false;
  }, [
    dragState.dynamicModeNodeId,
    isPositionAvailable,
    node.dynamicFamilyId,
    node.id,
    topmostParent,
    isNodeSelected,
  ]);

  if (!shouldShowVariantButton() || !topmostParent) return null;

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
        zIndex: 2001, // Higher than selection borders
      }}
    >
      <button
        onClick={handleAddVariant}
        className="bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]  flex items-center justify-center text-white shadow-md"
        style={{
          borderRadius: node.style.borderRadius,
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
