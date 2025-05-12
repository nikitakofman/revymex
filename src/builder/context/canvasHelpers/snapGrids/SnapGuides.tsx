// src/builder/context/canvasHelpers/SnapGuides.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  useIsMovingCanvas,
  useTransform,
} from "@/builder/context/atoms/canvas-interaction-store";
import {
  useDraggedNode,
  useIsDragging,
  useDragSource,
  useDragPositions,
  useDropInfo, // Add this import to get the current drop info
} from "@/builder/context/atoms/drag-store";
import { useGetAllNodes } from "@/builder/context/atoms/node-store";
import {
  useActiveGuides,
  snapOps,
} from "@/builder/context/atoms/snap-guides-store";

/**
 * Viewport-aware SnapGuides that ignores nodes with inViewport:true
 * Now using the dedicated snap guides store
 */
const SnapGuides: React.FC = () => {
  // Get active guides from the store
  const activeGuides = useActiveGuides();

  // Get required state
  const transform = useTransform();
  const isMovingCanvas = useIsMovingCanvas();
  const isDragging = useIsDragging();
  const draggedNode = useDraggedNode();
  const dragSource = useDragSource();
  const dragPositions = useDragPositions();
  const getAllNodes = useGetAllNodes();

  // Get drop info state
  const dropInfo = useDropInfo();
  const hasActiveDropZone = dropInfo && dropInfo.targetId !== null;

  const animationFrameRef = useRef<number | null>(null);

  // Calculate all possible snap positions
  useEffect(() => {
    const calculateSnapPositions = () => {
      try {
        // Get canvas content element
        const contentRef = document.querySelector(
          '.relative[style*="transform-origin"]'
        );
        if (!contentRef) {
          console.error("SnapGuides: contentRef not found");
          return;
        }

        // Get content rect to calculate offsets
        const contentRect = contentRef.getBoundingClientRect();

        // Get all DOM nodes with data-node-id
        const elements = document.querySelectorAll("[data-node-id]");

        // Get all node data from store
        const allNodes = getAllNodes();

        const horizontalPositions: number[] = [];
        const verticalPositions: number[] = [];

        // Process each element to extract snap positions
        elements.forEach((element) => {
          const nodeId = element.getAttribute("data-node-id");

          // Skip if this is the dragged node
          if (draggedNode && nodeId === draggedNode.node?.id) {
            return;
          }

          // Find node data to check inViewport property
          const nodeData = allNodes.find((node) => node.id === nodeId);

          // Skip nodes that are in viewport
          if (nodeData && nodeData.inViewport === true) {
            return;
          }

          // Get element's position relative to viewport
          const rect = element.getBoundingClientRect();

          // Convert screen coordinates to canvas coordinates
          const left = (rect.left - contentRect.left) / transform.scale;
          const top = (rect.top - contentRect.top) / transform.scale;
          const right = left + rect.width / transform.scale;
          const bottom = top + rect.height / transform.scale;
          const centerX = left + rect.width / transform.scale / 2;
          const centerY = top + rect.height / transform.scale / 2;

          // Add horizontal snap positions
          horizontalPositions.push(top);
          horizontalPositions.push(centerY);
          horizontalPositions.push(bottom);

          // Add vertical snap positions
          verticalPositions.push(left);
          verticalPositions.push(centerX);
          verticalPositions.push(right);
        });

        // Filter out any invalid values
        const validHorizontal = horizontalPositions.filter(
          (pos) => !isNaN(pos) && pos !== undefined
        );
        const validVertical = verticalPositions.filter(
          (pos) => !isNaN(pos) && pos !== undefined
        );

        // Update the snap positions in the store
        snapOps.setAllSnapPositions({
          horizontal: validHorizontal,
          vertical: validVertical,
        });
      } catch (error) {
        console.error("SnapGuides: Error calculating snap positions", error);
      }
    };

    // Calculate initial snap positions
    calculateSnapPositions();

    // Recalculate on resize
    window.addEventListener("resize", calculateSnapPositions);

    return () => {
      window.removeEventListener("resize", calculateSnapPositions);
    };
  }, [transform, draggedNode, getAllNodes]);

  // Check for alignment during canvas dragging
  useEffect(() => {
    // Clear active snap points when not dragging
    if (
      !isDragging ||
      !draggedNode ||
      !dragPositions ||
      isMovingCanvas ||
      dragSource !== "canvas" ||
      hasActiveDropZone // Skip snap guides when a drop zone is active
    ) {
      // Reset active guides and snap points in the store
      snapOps.resetGuides();
      return;
    }

    // Skip if dragged node is inViewport
    if (draggedNode.node.inViewport === true) {
      snapOps.resetGuides();
      return;
    }

    // Get current state from store
    const snapGuidesState = snapOps.getState();
    const snapThreshold = snapGuidesState.snapThreshold / transform.scale;
    const allSnapPositions = snapGuidesState.allSnapPositions;

    const checkForAlignment = () => {
      try {
        // Check again inside animation frame if drop zone has been activated
        if (hasActiveDropZone) {
          snapOps.resetGuides();
          return;
        }

        // Extract dimensions from draggedNode
        const { style } = draggedNode.node;
        let width = 100; // Default
        let height = 100; // Default

        // Get width from style
        if (typeof style.width === "string" && style.width.includes("px")) {
          width = parseFloat(style.width);
        } else if (typeof style.width === "number") {
          width = style.width;
        }

        // Get height from style
        if (typeof style.height === "string" && style.height.includes("px")) {
          height = parseFloat(style.height);
        } else if (typeof style.height === "number") {
          height = style.height;
        }

        // Calculate dragged node edges in canvas coordinates
        // For canvas dragging, we need to subtract mouseX/mouseY offset
        const dragLeft =
          dragPositions.x - draggedNode.offset.mouseX / transform.scale;
        const dragTop =
          dragPositions.y - draggedNode.offset.mouseY / transform.scale;
        const dragRight = dragLeft + width;
        const dragBottom = dragTop + height;
        const dragCenterX = dragLeft + width / 2;
        const dragCenterY = dragTop + height / 2;

        // Edges to check for snapping
        const edges = {
          horizontal: [
            { name: "top", position: dragTop },
            { name: "center", position: dragCenterY },
            { name: "bottom", position: dragBottom },
          ],
          vertical: [
            { name: "left", position: dragLeft },
            { name: "center", position: dragCenterX },
            { name: "right", position: dragRight },
          ],
        };

        const newActiveGuides: {
          horizontal: number[];
          vertical: number[];
        } = {
          horizontal: [],
          vertical: [],
        };

        // For storing the best snap points
        let closestHorizontal: {
          position: number;
          distance: number;
          edge: string;
        } | null = null;
        let closestVertical: {
          position: number;
          distance: number;
          edge: string;
        } | null = null;

        // Check horizontal edges against all snap positions
        edges.horizontal.forEach((edge) => {
          allSnapPositions.horizontal.forEach((snapPos) => {
            const distance = Math.abs(edge.position - snapPos);
            if (distance <= snapThreshold) {
              // Add to active guides
              newActiveGuides.horizontal.push(snapPos);

              // Update closest horizontal if this is closer
              if (!closestHorizontal || distance < closestHorizontal.distance) {
                closestHorizontal = {
                  position: snapPos,
                  distance: distance,
                  edge: edge.name,
                };
              }
            }
          });
        });

        // Check vertical edges against all snap positions
        edges.vertical.forEach((edge) => {
          allSnapPositions.vertical.forEach((snapPos) => {
            const distance = Math.abs(edge.position - snapPos);
            if (distance <= snapThreshold) {
              // Add to active guides
              newActiveGuides.vertical.push(snapPos);

              // Update closest vertical if this is closer
              if (!closestVertical || distance < closestVertical.distance) {
                closestVertical = {
                  position: snapPos,
                  distance: distance,
                  edge: edge.name,
                };
              }
            }
          });
        });

        // Update active guides in the store (for visual display)
        snapOps.setActiveGuides({
          horizontal: [...new Set(newActiveGuides.horizontal)],
          vertical: [...new Set(newActiveGuides.vertical)],
        });

        // Update active snap points in the store (for snapping logic)
        snapOps.setActiveSnapPoints({
          horizontal: closestHorizontal,
          vertical: closestVertical,
        });
      } catch (error) {
        console.error("SnapGuides: Error in alignment check", error);
      }

      // Continue the loop
      animationFrameRef.current = requestAnimationFrame(checkForAlignment);
    };

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(checkForAlignment);

    // Clean up
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    isDragging,
    draggedNode,
    dragPositions,
    transform,
    isMovingCanvas,
    dragSource,
    hasActiveDropZone, // Add hasActiveDropZone as a dependency
  ]);

  // Only render when there are active guides and no active drop zone
  if (
    hasActiveDropZone || // Don't show guides when drop zone is active
    (activeGuides.horizontal.length === 0 && activeGuides.vertical.length === 0)
  ) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
      data-snap-guides-container
    >
      {/* Render horizontal guides */}
      {activeGuides.horizontal.map((position, i) => {
        // Apply transform to position
        const transformedPos = position * transform.scale + transform.y;

        return (
          <div
            key={`h-${i}-${position}`}
            style={{
              position: "absolute",
              top: `${transformedPos}px`,
              left: 0,
              width: "100%",
              height: "1px",
              backgroundColor: "rgba(255, 124, 221, 0.8)",
              pointerEvents: "none",
            }}
            data-snap-guide-horizontal
            data-snap-position={position}
          />
        );
      })}

      {/* Render vertical guides */}
      {activeGuides.vertical.map((position, i) => {
        // Apply transform to position
        const transformedPos = position * transform.scale + transform.x;

        return (
          <div
            key={`v-${i}-${position}`}
            style={{
              position: "absolute",
              left: `${transformedPos}px`,
              top: 0,
              width: "1px",
              height: "100%",
              backgroundColor: "rgba(255, 124, 221, 0.8)",
              pointerEvents: "none",
            }}
            data-snap-guide-vertical
            data-snap-position={position}
          />
        );
      })}
    </div>
  );
};

export default SnapGuides;
