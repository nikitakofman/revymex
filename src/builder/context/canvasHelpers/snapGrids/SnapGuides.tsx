// src/builder/context/canvasHelpers/SnapGuides.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  useGetIsResizing,
  useIsMovingCanvas,
  useIsResizing,
  useTransform,
} from "@/builder/context/atoms/canvas-interaction-store";
import {
  useDraggedNode,
  useIsDragging,
  useDragSource,
  useDragPositions,
  useDropInfo,
} from "@/builder/context/atoms/drag-store";
import {
  useGetAllNodes,
  useGetNodeFlags,
  useGetNodeParent,
  getCurrentNodes,
  useGetNodeStyle,
} from "@/builder/context/atoms/node-store";
import {
  useActiveGuides,
  snapOps,
  useShowChildElements,
  useLimitToNodes,
  useResizeDirection,
} from "@/builder/context/atoms/snap-guides-store";
import { useGetNodeChildren } from "../../atoms/node-store/hierarchy-store";
import { useGetSelectedIds } from "../../atoms/select-store";

// Add these constants to control the snap guides behavior
const SHOW_ALL_GUIDES = false; // Set to true to show all guides without activation

/**
 * SnapGuides that can toggle between showing guides for
 * child elements (with parentId) or top-level elements (no parentId)
 */
const SnapGuides: React.FC = () => {
  // Get active guides from the store
  const activeGuides = useActiveGuides();
  const showChildElements = useShowChildElements();
  const limitToNodes = useLimitToNodes();
  const resizeDirection = useResizeDirection();

  // Get required state
  const transform = useTransform();
  const isMovingCanvas = useIsMovingCanvas();
  const isDragging = useIsDragging();
  const isResizing = useIsResizing();
  const draggedNode = useDraggedNode();
  const dragSource = useDragSource();
  const dragPositions = useDragPositions();
  const getAllNodes = useGetAllNodes();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getSelectedIds = useGetSelectedIds();
  const getNodeStyle = useGetNodeStyle();

  // Get drop info state
  const dropInfo = useDropInfo();
  const hasActiveDropZone = dropInfo && dropInfo.targetId !== null;

  const animationFrameRef = useRef<number | null>(null);
  const snapSetupDoneRef = useRef(false);
  const topmostParentIdRef = useRef<string | number | null>(null);
  const excludedChildrenIdsRef = useRef<Set<string | number>>(new Set());

  // Local state to store all snap positions when SHOW_ALL_GUIDES is true
  const [allGuides, setAllGuides] = useState<{
    horizontal: number[];
    vertical: number[];
  }>({ horizontal: [], vertical: [] });

  // Helper function to find the topmost parent (e.g., viewport) of a node
  const findTopmostParent = (
    nodeId: string | number
  ): string | number | null => {
    let currentId = nodeId;
    let currentParentId = getNodeParent(currentId);
    let topmostParentId = currentParentId;

    // Track the hierarchy to find the topmost parent or viewport
    while (currentParentId) {
      topmostParentId = currentParentId;

      // If we found a viewport, stop immediately
      const flags = getNodeFlags(currentParentId);
      if (flags && flags.isViewport) {
        return currentParentId;
      }

      // Move up the tree
      currentId = currentParentId;
      currentParentId = getNodeParent(currentId);
    }

    return topmostParentId;
  };

  // Helper function to collect all child IDs recursively
  const collectAllChildren = (
    nodeId: string | number,
    result: Set<string | number>
  ) => {
    const children = getNodeChildren(nodeId);

    // Add each child to the result set
    children.forEach((childId) => {
      result.add(childId);
      // Recursively collect children of this child
      collectAllChildren(childId, result);
    });

    return result;
  };

  // Helper function to configure snap guides for absolute-in-frame elements
  const configureSnapGuidesForAbsoluteInFrame = (nodeId: string | number) => {
    // Find the topmost parent (usually a viewport)
    const topmostParentId = findTopmostParent(nodeId);

    // Store it in ref for later use
    topmostParentIdRef.current = topmostParentId;

    if (!topmostParentId) return;

    // Get all nodes
    const allNodes = getAllNodes();

    // Function to check if a node is within the hierarchy of the topmost parent
    const isInHierarchy = (nodeToCheck: any) => {
      let current = nodeToCheck.id;

      while (current) {
        if (current === topmostParentId) {
          return true;
        }
        const parent = getNodeParent(current);
        if (!parent) break;
        current = parent;
      }

      return false;
    };

    // Collect all children of the dragged node that should be excluded from snapping
    const childrenToExclude = new Set<string | number>();
    collectAllChildren(nodeId, childrenToExclude);
    excludedChildrenIdsRef.current = childrenToExclude;

    // Filter nodes to only those within the same hierarchy AND not children of dragged node
    const nodesInSameHierarchy = allNodes.filter(
      (node) =>
        node.id !== nodeId && // Exclude the dragged node itself
        !childrenToExclude.has(node.id) && // Exclude children of dragged node
        (node.id === topmostParentId || isInHierarchy(node)) // Include topmost parent and nodes in hierarchy
    );

    // Extract node IDs that should be used for snap guides
    const hierarchyNodeIds = nodesInSameHierarchy.map((node) => node.id);

    // Set the snap guides configuration to use child elements
    snapOps.setShowChildElements(true);

    // Crucial fix: Explicitly limit snap guides to only nodes in the same hierarchy
    snapOps.setLimitToNodes(hierarchyNodeIds);

    return hierarchyNodeIds;
  };

  // Helper function to configure snap guides for resize operations
  const configureSnapGuidesForResizing = (resizeDirection = "") => {
    // Get selected nodes that are being resized
    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) return;

    // Find the first selected node to determine parent/hierarchy
    const firstNodeId = selectedIds[0];

    // Get style of the first selected node
    const nodeStyle = getNodeStyle(firstNodeId);

    // Only configure snap guides for absolute positioned elements
    const isAbsolutePositioned =
      nodeStyle.position === "absolute" ||
      nodeStyle.isFakeFixed === "true" ||
      nodeStyle.isAbsoluteInFrame === "true";

    if (!isAbsolutePositioned) {
      // For non-absolute elements, disable snap guides during resize
      snapOps.setLimitToNodes([]);
      snapOps.setShowChildElements(false);
      topmostParentIdRef.current = null;
      excludedChildrenIdsRef.current.clear();
      return;
    }

    const parentId = getNodeParent(firstNodeId);

    if (!parentId) {
      // For canvas elements, show guides only for top-level elements
      snapOps.setShowChildElements(false);
      snapOps.setLimitToNodes(null);
      topmostParentIdRef.current = null;
      excludedChildrenIdsRef.current.clear();
      return;
    }

    // For elements in a parent, find topmost parent (usually a viewport)
    const topmostParentId = findTopmostParent(firstNodeId);

    // Store for later use
    topmostParentIdRef.current = topmostParentId;

    if (!topmostParentId) return;

    // Get all nodes
    const allNodes = getAllNodes();

    // Function to check if a node is within the hierarchy of the topmost parent
    const isInHierarchy = (nodeToCheck: any) => {
      let current = nodeToCheck.id;

      while (current) {
        if (current === topmostParentId) {
          return true;
        }
        const parent = getNodeParent(current);
        if (!parent) break;
        current = parent;
      }

      return false;
    };

    // Collect all children of selected nodes that should be excluded from snapping
    const childrenToExclude = new Set<string | number>();
    selectedIds.forEach((id) => {
      collectAllChildren(id, childrenToExclude);
    });

    // Also exclude the selected nodes themselves
    selectedIds.forEach((id) => {
      childrenToExclude.add(id);
    });

    excludedChildrenIdsRef.current = childrenToExclude;

    // Filter nodes to only those within the same hierarchy AND not children of selected nodes
    const nodesInSameHierarchy = allNodes.filter(
      (node) =>
        !childrenToExclude.has(node.id) && // Exclude selected nodes and their children
        (node.id === topmostParentId || isInHierarchy(node)) // Include topmost parent and nodes in hierarchy
    );

    // Extract node IDs that should be used for snap guides
    const hierarchyNodeIds = nodesInSameHierarchy.map((node) => node.id);

    // Set the snap guides configuration to use child elements
    snapOps.setShowChildElements(true);

    // Limit snap guides to only nodes in the same hierarchy
    snapOps.setLimitToNodes(hierarchyNodeIds);

    return hierarchyNodeIds;
  };

  // Helper to determine which edges to check based on resize direction
  const getActiveEdgesForDirection = (direction) => {
    let edges = {
      horizontal: ["top", "center", "bottom"],
      vertical: ["left", "center", "right"],
    };

    // Filter edges based on direction
    switch (direction) {
      case "left":
        edges.horizontal = [];
        edges.vertical = ["left"];
        break;
      case "right":
        edges.horizontal = [];
        edges.vertical = ["right"];
        break;
      case "top":
        edges.horizontal = ["top"];
        edges.vertical = [];
        break;
      case "bottom":
        edges.horizontal = ["bottom"];
        edges.vertical = [];
        break;
      case "topLeft":
        edges.horizontal = ["top"];
        edges.vertical = ["left"];
        break;
      case "topRight":
        edges.horizontal = ["top"];
        edges.vertical = ["right"];
        break;
      case "bottomLeft":
        edges.horizontal = ["bottom"];
        edges.vertical = ["left"];
        break;
      case "bottomRight":
        edges.horizontal = ["bottom"];
        edges.vertical = ["right"];
        break;
      // Default keeps all edges
    }

    return edges;
  };

  // Detect changes in drag/resize state to configure snap guides
  useEffect(() => {
    // If dragging and setup not done yet, configure snap guides based on drag source
    if (isDragging && draggedNode && !snapSetupDoneRef.current) {
      if (dragSource === "absolute-in-frame") {
        // For absolute-in-frame, show guides for elements in the same hierarchy
        configureSnapGuidesForAbsoluteInFrame(draggedNode.node.id);
      } else if (dragSource === "canvas") {
        // For canvas elements, show guides only for top-level elements
        snapOps.setShowChildElements(false);
        snapOps.setLimitToNodes(null);
        topmostParentIdRef.current = null;
        excludedChildrenIdsRef.current.clear();
      }

      snapSetupDoneRef.current = true;
    }
    // If resizing and setup not done yet, configure snap guides for resizing
    else if (isResizing && !isDragging && !snapSetupDoneRef.current) {
      configureSnapGuidesForResizing(resizeDirection);
      snapSetupDoneRef.current = true;
    }

    // When operations end, reset snap configuration
    if (!isDragging && !isResizing && snapSetupDoneRef.current) {
      snapOps.setLimitToNodes(null);
      snapOps.setShowChildElements(false);
      snapOps.resetGuides();
      snapSetupDoneRef.current = false;
      topmostParentIdRef.current = null;
      excludedChildrenIdsRef.current.clear();
    }
  }, [
    isDragging,
    isResizing,
    draggedNode,
    dragSource,
    getSelectedIds,
    resizeDirection,
  ]);

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
          if (!nodeId) return;

          // Skip if this is the dragged node
          if (draggedNode && nodeId === draggedNode.node?.id) {
            return;
          }

          // Skip if this is being resized (in selected nodes)
          if (isResizing && getSelectedIds().includes(nodeId)) {
            return;
          }

          // Skip if this is a child of a node being dragged or resized
          if (excludedChildrenIdsRef.current.has(nodeId)) {
            return;
          }

          // Special case: include the topmost parent if it exists
          const isTopmostParent = nodeId === topmostParentIdRef.current;

          // Skip if we're limiting to specific nodes and this one isn't included
          // Unless it's the topmost parent which we always want to include
          if (
            limitToNodes &&
            !isTopmostParent &&
            !limitToNodes.includes(nodeId)
          ) {
            return;
          }

          // Find node data to check parentId
          const nodeData = allNodes.find((node) => node.id === nodeId);

          // Skip based on showChildElements setting from store
          // But always include the topmost parent
          if (nodeData && !isTopmostParent) {
            const hasParent =
              nodeData.parentId !== null && nodeData.parentId !== undefined;

            if (showChildElements) {
              // Skip nodes that DON'T have a parent when showing child elements
              if (!hasParent) {
                return;
              }
            } else {
              // Skip nodes that DO have a parent when showing top-level elements
              if (hasParent) {
                return;
              }
            }
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

        // Set all guides if SHOW_ALL_GUIDES is true
        if (SHOW_ALL_GUIDES) {
          setAllGuides({
            horizontal: validHorizontal,
            vertical: validVertical,
          });
        }
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
  }, [
    transform,
    draggedNode,
    getAllNodes,
    showChildElements,
    limitToNodes,
    isResizing,
    getSelectedIds,
  ]);

  // Check for alignment during canvas dragging or resizing
  useEffect(() => {
    // If SHOW_ALL_GUIDES is true, we don't need this effect
    if (SHOW_ALL_GUIDES) return;

    // Clear active snap points when not in an active operation
    if (
      (!isDragging && !isResizing) ||
      (isDragging && !draggedNode) ||
      (!dragPositions && isDragging) ||
      isMovingCanvas ||
      (isDragging &&
        dragSource !== "canvas" &&
        dragSource !== "absolute-in-frame") ||
      hasActiveDropZone // Skip snap guides when a drop zone is active
    ) {
      // Reset active guides and snap points in the store
      snapOps.resetGuides();
      return;
    }

    // Skip if the dragged node's parent status doesn't match what we want to show
    // Only check this for canvas elements during dragging, not for absolute-in-frame elements or resizing
    if (isDragging && dragSource === "canvas") {
      const hasParent =
        draggedNode.node.parentId !== null &&
        draggedNode.node.parentId !== undefined;

      if (showChildElements ? !hasParent : hasParent) {
        snapOps.resetGuides();
        return;
      }
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

        // Get current waitForResizeMove directly from store
        const { waitForResizeMove } = snapOps.getState();
        if (isResizing && waitForResizeMove) {
          // Still on the very first frame – no guides yet
          snapOps.resetGuides();
          animationFrameRef.current = requestAnimationFrame(checkForAlignment);
          return;
        }

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

        // Handle different cases based on operation
        if (isResizing && !isDragging) {
          // RESIZING CASE: Check selected elements being resized
          const selectedIds = getSelectedIds();
          const contentRef = document.querySelector(
            '.relative[style*="transform-origin"]'
          );

          if (!contentRef) return;
          const contentRect = contentRef.getBoundingClientRect();

          // Get the current resize direction from store
          const { resizeDirection } = snapOps.getState();

          // Get the active edges based on resize direction
          const activeEdges = getActiveEdgesForDirection(resizeDirection);

          // Only process elements with position: absolute
          const absolutePositionedIds = selectedIds.filter((id) => {
            const style = getNodeStyle(id);
            return (
              style.position === "absolute" ||
              style.isFakeFixed === "true" ||
              style.isAbsoluteInFrame === "true"
            );
          });

          if (absolutePositionedIds.length === 0) {
            // No absolute elements being resized, reset guides
            snapOps.resetGuides();
            return;
          }

          // Process each selected absolutely positioned element to find snap positions
          absolutePositionedIds.forEach((id) => {
            const element = document.querySelector(`[data-node-id="${id}"]`);
            if (!element) return;

            // Get element's position relative to canvas
            const rect = element.getBoundingClientRect();

            // Convert screen coordinates to canvas coordinates
            const left = (rect.left - contentRect.left) / transform.scale;
            const top = (rect.top - contentRect.top) / transform.scale;
            const right = left + rect.width / transform.scale;
            const bottom = top + rect.height / transform.scale;
            const centerX = left + rect.width / transform.scale / 2;
            const centerY = top + rect.height / transform.scale / 2;

            // Build edges based on the active edges for the current resize direction
            const edges = {
              horizontal: [],
              vertical: [],
            };

            // Only include edges that are relevant to the current resize operation
            if (activeEdges.horizontal.includes("top")) {
              edges.horizontal.push({ name: "top", position: top });
            }
            if (activeEdges.horizontal.includes("center")) {
              edges.horizontal.push({ name: "center", position: centerY });
            }
            if (activeEdges.horizontal.includes("bottom")) {
              edges.horizontal.push({ name: "bottom", position: bottom });
            }

            if (activeEdges.vertical.includes("left")) {
              edges.vertical.push({ name: "left", position: left });
            }
            if (activeEdges.vertical.includes("center")) {
              edges.vertical.push({ name: "center", position: centerX });
            }
            if (activeEdges.vertical.includes("right")) {
              edges.vertical.push({ name: "right", position: right });
            }

            // Check horizontal edges against all snap positions
            edges.horizontal.forEach((edge) => {
              allSnapPositions.horizontal.forEach((snapPos) => {
                const distance = Math.abs(edge.position - snapPos);
                if (distance <= snapThreshold) {
                  // Add to active guides - only the one that's closest
                  if (
                    !closestHorizontal ||
                    distance < closestHorizontal.distance
                  ) {
                    // Clear previous horizontal guides if this is closer
                    newActiveGuides.horizontal = [snapPos];

                    closestHorizontal = {
                      position: snapPos,
                      distance: distance,
                      edge: edge.name,
                    };
                  } else if (
                    closestHorizontal &&
                    distance === closestHorizontal.distance
                  ) {
                    // If same distance, add this guide too
                    newActiveGuides.horizontal.push(snapPos);
                  }
                }
              });
            });

            // Check vertical edges against all snap positions
            edges.vertical.forEach((edge) => {
              allSnapPositions.vertical.forEach((snapPos) => {
                const distance = Math.abs(edge.position - snapPos);
                if (distance <= snapThreshold) {
                  // Add to active guides - only the one that's closest
                  if (!closestVertical || distance < closestVertical.distance) {
                    // Clear previous vertical guides if this is closer
                    newActiveGuides.vertical = [snapPos];

                    closestVertical = {
                      position: snapPos,
                      distance: distance,
                      edge: edge.name,
                    };
                  } else if (
                    closestVertical &&
                    distance === closestVertical.distance
                  ) {
                    // If same distance, add this guide too
                    newActiveGuides.vertical.push(snapPos);
                  }
                }
              });
            });
          });
        } else if (isDragging && draggedNode) {
          // DRAGGING CASE: From original code
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

          // Check horizontal edges against all snap positions
          edges.horizontal.forEach((edge) => {
            allSnapPositions.horizontal.forEach((snapPos) => {
              const distance = Math.abs(edge.position - snapPos);
              if (distance <= snapThreshold) {
                // Add to active guides
                newActiveGuides.horizontal.push(snapPos);

                // Update closest horizontal if this is closer
                if (
                  !closestHorizontal ||
                  distance < closestHorizontal.distance
                ) {
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
        }

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
    hasActiveDropZone,
    showChildElements,
    isResizing,
    getSelectedIds,
    getNodeStyle,
  ]);

  // Determine which guides to render
  const guidesToRender = SHOW_ALL_GUIDES ? allGuides : activeGuides;

  // When showing all guides, always render unless there are no guides
  const shouldRender = SHOW_ALL_GUIDES
    ? guidesToRender.horizontal.length > 0 || guidesToRender.vertical.length > 0
    : !hasActiveDropZone &&
      (guidesToRender.horizontal.length > 0 ||
        guidesToRender.vertical.length > 0);

  // Return early if no guides to render
  if (!shouldRender) {
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
      {guidesToRender.horizontal.map((position, i) => {
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
      {guidesToRender.vertical.map((position, i) => {
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
