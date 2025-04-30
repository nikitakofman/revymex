import React, { useRef, useState, useEffect, useCallback } from "react";
import { useBuilderDynamic } from "@/builder/context/builderState";
import { useGetSelectedIds } from "../atoms/select-store";
import { visualOps } from "../atoms/visual-store";
import { canvasOps, useTransform } from "../atoms/canvas-interaction-store";
import { useDynamicModeNodeId } from "../atoms/dynamic-store";
import {
  NodeId,
  useNodeStyle,
  useNodeFlags,
  useNodeBasics,
  useGetNode,
} from "../atoms/node-store";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";

interface FontSizeHandleProps {
  nodeId: NodeId;
  elementRef: React.RefObject<HTMLDivElement>;
  groupBounds?: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
  isGroupSelection?: boolean;
}

// Type to track font sizes with their units
interface FontSizeInfo {
  size: number;
  unit: string;
  ratio: number;
}

export const FontSizeHandle: React.FC<FontSizeHandleProps> = ({
  nodeId,
  elementRef,
  groupBounds,
  isGroupSelection = false,
}) => {
  // Get node data directly from atoms
  const style = useNodeStyle(nodeId);
  const flags = useNodeFlags(nodeId);
  const { isDynamic = false } = flags;
  const basics = useNodeBasics(nodeId);
  const { type } = basics;

  // Get a full node builder for compatibility with some functions
  const getNode = useGetNode();

  const { startRecording, stopRecording, nodeState } = useBuilderDynamic();

  const transform = useTransform();

  // Use the imperative getter function instead of subscription
  const getSelectedIds = useGetSelectedIds();
  const dynamicModeNodeId = useDynamicModeNodeId();

  // Function to check if this node is the primary selected node
  const isPrimarySelectedNode = useCallback(() => {
    if (!isGroupSelection) return true;
    const selectedIds = getSelectedIds();
    return selectedIds.length > 0 && nodeId === selectedIds[0];
  }, [isGroupSelection, nodeId, getSelectedIds]);

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startFontSizeRef = useRef<number>(16); // Default average font size
  // Store all font sizes and their ratios
  const fontSizeRatiosRef = useRef<
    { size: number; ratio: number; unit: string }[]
  >([]);
  // Track primary unit type
  const primaryUnitRef = useRef<string>("px");
  // Ref to track if we have mixed font sizes
  const isMixedFontSizesRef = useRef<boolean>(false);
  // Flag to prevent style helper reset during font size adjustments
  const preventStyleHelperReset = useRef<boolean>(false);

  // Add state to track whether the handle is interactive
  const [isInteractive, setIsInteractive] = useState(false);
  const [isAutoSized, setIsAutoSized] = useState(false);

  // Helper function to detect mixed font sizes
  const detectMixedFontSizes = (
    fontSizes: { size: number; unit: string }[]
  ) => {
    // If we have no font sizes or just one, it's not mixed
    if (fontSizes.length <= 1) return false;

    // Check if all sizes are the same
    const firstSize = fontSizes[0].size;
    const firstUnit = fontSizes[0].unit;

    // If any size differs from the first one, we have mixed sizes
    return fontSizes.some(
      (item) => item.size !== firstSize || item.unit !== firstUnit
    );
  };

  // Start timer when the component mounts and check if element has auto width/height
  useEffect(() => {
    // Check if element has auto width/height
    if (elementRef.current) {
      const computedStyle = window.getComputedStyle(elementRef.current);
      const isWidthAuto =
        elementRef.current.style.width === "auto" ||
        computedStyle.width === "auto";
      const isHeightAuto =
        elementRef.current.style.height === "auto" ||
        computedStyle.height === "auto";

      setIsAutoSized(isWidthAuto || isHeightAuto);
    }

    // Delay to make it interactive
    const timer = setTimeout(() => {
      setIsInteractive(true);
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [elementRef]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive) return;

    canvasOps.setIsFontSizeHandleActive(true);
    preventStyleHelperReset.current = true;

    e.preventDefault();
    e.stopPropagation();

    const sessionId = startRecording();

    // Get the current selection imperatively at the time of the event
    const selectedIds = getSelectedIds();

    // Get the full node for text extraction
    const node = getNode(nodeId);

    // Extract all font sizes from the text content
    const fontSizes: { size: number; unit: string }[] = [];
    let averageFontSize = 16; // Default
    let primaryUnit = "px"; // Default unit

    if (style.text) {
      // Extract all font sizes with regex - FIXED to correctly capture the unit
      // This regex properly separates the numeric part from the unit
      const fontSizePattern = /font-size:\s*([\d.]+)([a-z%]*)/g;

      let match;
      let pxCount = 0;
      let vwCount = 0;
      let totalPx = 0;
      let totalVw = 0;

      while ((match = fontSizePattern.exec(style.text)) !== null) {
        if (match[1]) {
          const size = parseFloat(match[1]);
          // Make sure to capture the unit part correctly
          const unit = match[2] || "px";

          fontSizes.push({ size, unit });

          // Count units to determine primary unit
          if (unit === "px") {
            pxCount++;
            totalPx += size;
          } else if (unit === "vw") {
            vwCount++;
            totalVw += size;
          }
        }
      }

      // Check if we have mixed font sizes
      const hasMixedSizes = detectMixedFontSizes(fontSizes);
      isMixedFontSizesRef.current = hasMixedSizes;

      // If any vw units were found, use vw as primary unit
      if (vwCount > 0) {
        primaryUnit = "vw";
        // Calculate average vw size
        averageFontSize = totalVw / vwCount;
      } else if (pxCount > 0) {
        primaryUnit = "px";
        // Calculate average px size
        averageFontSize = totalPx / pxCount;
      }

      // Calculate ratios relative to average
      const fontSizeRatios = fontSizes.map((info) => ({
        size: info.size,
        unit: info.unit,
        ratio:
          info.size /
          (info.unit === primaryUnit
            ? averageFontSize
            : convertSize(info.size, info.unit, primaryUnit)),
      }));

      fontSizeRatiosRef.current = fontSizeRatios;
    } else if (elementRef.current) {
      // Fallback to computed style if needed
      const computedStyle = window.getComputedStyle(elementRef.current);
      const fontSizeStr = computedStyle.fontSize;

      // Check if it's a vw unit
      if (fontSizeStr.includes("vw")) {
        const match = fontSizeStr.match(/([\d.]+)vw/);
        if (match) {
          const vwSize = parseFloat(match[1]);
          primaryUnit = "vw";
          averageFontSize = vwSize;
          fontSizeRatiosRef.current = [{ size: vwSize, unit: "vw", ratio: 1 }];
        }
      } else {
        // Regular px handling
        const match = fontSizeStr.match(/(\d+)/);
        if (match) {
          averageFontSize = parseInt(match[1]);
          fontSizeRatiosRef.current = [
            { size: averageFontSize, unit: "px", ratio: 1 },
          ];
        }
      }

      // No mixed sizes when using computed style
      isMixedFontSizesRef.current = false;
    }

    // Store the primary unit for use during dragging
    primaryUnitRef.current = primaryUnit;

    startFontSizeRef.current = averageFontSize;
    // Store both X and Y coordinates
    startPosRef.current = { x: e.clientX, y: e.clientY };

    // Show font size helper UI initially
    visualOps.updateStyleHelper({
      type: "fontSize",
      position: { x: e.clientX, y: e.clientY },
      value: averageFontSize,
      unit: primaryUnit,
      isMixed: isMixedFontSizesRef.current,
    });

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta based on both X and Y movement for bottom-right resizing
      const deltaX = (e.clientX - startPosRef.current.x) / transform.scale;
      const deltaY = (e.clientY - startPosRef.current.y) / transform.scale;

      // Average the X and Y movement for smoother resizing
      const deltaDiagonal = (deltaX + deltaY) / 2;

      // Scale the movement for better sensitivity - smaller scale for vw
      const fontSizeDelta =
        deltaDiagonal * (primaryUnitRef.current === "vw" ? 0.05 : 0.5);

      // Calculate new average font size - keep current value as base
      let newAverageFontSize = Math.max(
        primaryUnitRef.current === "vw" ? 0.1 : 8, // Min size based on unit
        startFontSizeRef.current + fontSizeDelta
      );

      // Format appropriately by unit
      if (primaryUnitRef.current === "vw") {
        // Round to 2 decimal places for vw
        newAverageFontSize = Math.round(newAverageFontSize * 100) / 100;
      } else {
        // Integer for px
        newAverageFontSize = Math.round(newAverageFontSize);

        // Snap to common font sizes when shift is pressed (only for px)
        if (e.shiftKey) {
          const commonSizes = [
            8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 64, 72, 96, 120,
            144, 180, 240, 300,
          ];
          const closest = commonSizes.reduce((prev, curr) => {
            return Math.abs(curr - newAverageFontSize) <
              Math.abs(prev - newAverageFontSize)
              ? curr
              : prev;
          });
          newAverageFontSize = closest;
        }
      }

      // First update the text styles
      // Get nodes to update
      const nodesToUpdate = isGroupSelection
        ? selectedIds.filter((id) => {
            const selectedNode = nodeState.nodes.find((n) => n.id === id);
            return selectedNode && selectedNode.type === "text";
          })
        : [nodeId];

      // Update each text node
      nodesToUpdate.forEach((id) => {
        const textNode = nodeState.nodes.find((n) => n.id === id);
        if (!textNode || textNode.type !== "text" || !textNode.style.text)
          return;

        // Preserve proportional font sizes
        const updatedText = updateProportionalFontSizes(
          textNode.style.text,
          newAverageFontSize,
          fontSizeRatiosRef.current,
          primaryUnitRef.current
        );

        // Check if this node has independent text styles
        if (textNode.independentStyles?.text) {
          // Update only this node - using updateNodeStyle instead of setNodeStyle
          updateNodeStyle(id, { text: updatedText });
        } else {
          // Update with normal syncing behavior
          // Note: we would need to add a separate function for syncing updates
          // For now, use standard updateNodeStyle
          updateNodeStyle(id, { text: updatedText });
        }
      });

      // CRITICAL FIX: Use setTimeout to update style helper AFTER node styles
      // This prevents it from being hidden by the setNodeStyle side effects
      setTimeout(() => {
        visualOps.updateStyleHelper({
          type: "fontSize",
          position: { x: e.clientX, y: e.clientY },
          value: newAverageFontSize,
          unit: primaryUnitRef.current,
          isMixed: isMixedFontSizesRef.current,
        });
      }, 10);
    };

    const handleMouseUp = () => {
      visualOps.hideStyleHelper();
      canvasOps.setIsFontSizeHandleActive(false);
      stopRecording(sessionId);
      // Reset the prevention flag
      preventStyleHelperReset.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Helper function to convert between units (px to vw or vw to px)
  const convertSize = (
    size: number,
    fromUnit: string,
    toUnit: string
  ): number => {
    if (fromUnit === toUnit) return size;

    const viewportWidth = window.innerWidth;

    if (fromUnit === "px" && toUnit === "vw") {
      return (size / viewportWidth) * 100;
    } else if (fromUnit === "vw" && toUnit === "px") {
      return (size * viewportWidth) / 100;
    }

    // Default fallback
    return size;
  };

  // Helper function to update font sizes proportionally
  const updateProportionalFontSizes = (
    html: string,
    newAverageSize: number,
    fontSizeRatios: { size: number; ratio: number; unit: string }[],
    primaryUnit: string
  ): string => {
    let updatedHtml = html;
    let index = 0;

    // Use the fixed regex pattern that properly captures the size and unit separately
    return updatedHtml.replace(
      /font-size:\s*([\d.]+)([a-z%]*)/g,
      (match, size, unit) => {
        if (index < fontSizeRatios.length) {
          const ratio = fontSizeRatios[index].ratio;
          const originalUnit = fontSizeRatios[index].unit;

          // Use the original unit from when we captured it
          let newSize: number;

          if (originalUnit === primaryUnit) {
            // Same unit, direct calculation
            newSize = newAverageSize * ratio;
          } else {
            // Different units, need conversion
            if (primaryUnit === "vw" && originalUnit === "px") {
              // Converting from vw adjustment to px
              const viewportWidth = window.innerWidth;
              newSize = (newAverageSize * ratio * viewportWidth) / 100;
            } else if (primaryUnit === "px" && originalUnit === "vw") {
              // Converting from px adjustment to vw
              const viewportWidth = window.innerWidth;
              newSize = ((newAverageSize * ratio) / viewportWidth) * 100;
            } else {
              // Fallback
              newSize = newAverageSize * ratio;
            }
          }

          // Format based on unit type
          if (originalUnit === "vw") {
            newSize = Math.round(newSize * 100) / 100; // 2 decimal places for vw
          } else {
            newSize = Math.round(newSize); // Integer for px
          }

          index++;
          return `font-size: ${newSize}${originalUnit}`;
        }
        return match;
      }
    );
  };

  // Don't render if it's not a text element or doesn't have auto width/height
  if (type !== "text" || !isAutoSized) {
    return null;
  }

  // Don't render in group selection mode (unless it's the primary node)
  if (isGroupSelection && !isPrimarySelectedNode()) {
    return null;
  }

  // Don't render at very small scales
  if (transform.scale < 0.2) return null;

  const handleSize = 8 / transform.scale;
  const borderWidth = 1 / transform.scale;
  const offset = 0 / transform.scale;

  return (
    <div
      data-font-size-handle="true"
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        right: `-${offset + handleSize / 3}px`,
        bottom: `-${offset + handleSize / 3}px`,
        width: `${handleSize}px`,
        height: `${handleSize}px`,
        borderRadius: "50%",
        backgroundColor: "white",
        border: `${borderWidth}px solid ${
          isDynamic || dynamicModeNodeId
            ? "var(--accent-secondary)"
            : "var(--accent)"
        }`,
        cursor: "nwse-resize", // Bottom-right diagonal resize cursor
        zIndex: 1001,
        pointerEvents: isInteractive ? "auto" : "none",
        transition: "opacity 0.2s ease-out",
      }}
    />
  );
};
