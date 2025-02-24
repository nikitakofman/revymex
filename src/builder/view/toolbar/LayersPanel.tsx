import React, { useState, useRef, useEffect, useCallback } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import {
  ChevronRight,
  ChevronDown,
  Frame,
  Box,
  Type,
  ImageIcon,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  EyeOff,
} from "lucide-react";
import { cn } from "@/providers/cn";
import { findIndexWithinParent } from "./utils";

interface TreeNodeWithChildren extends Node {
  children: TreeNodeWithChildren[];
}

// Track drag info globally since dataTransfer is not accessible in dragOver
let currentDragInfo = {
  id: null as null | string | number,
  type: null as null | string,
  isViewport: false,
  inViewport: false,
};

const buildTreeFromNodes = (
  nodes: Node[],
  isDynamicMode: boolean,
  dynamicNodeId: string | number | null
) => {
  let filteredNodes = nodes.filter((node) => node.type !== "placeholder");

  // Apply the same filtering logic regardless of viewport type
  if (isDynamicMode && dynamicNodeId) {
    const dynamicNode = filteredNodes.find((node) => node.id === dynamicNodeId);
    if (dynamicNode) {
      filteredNodes = filteredNodes.filter(
        (node) =>
          node.id === dynamicNodeId ||
          node.dynamicParentId === dynamicNodeId ||
          node.parentId === dynamicNodeId
      );
    }
  } else {
    filteredNodes = filteredNodes.filter((node) => {
      if (node.dynamicParentId) return false;
      if (!node.originalState) return true;
      return false;
    });
  }

  const nodeMap = new Map();
  let tree: Node[] = [];

  filteredNodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  filteredNodes.forEach((node) => {
    const mappedNode = nodeMap.get(node.id);
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId);
      parent.children.push(mappedNode);
    } else {
      tree.push(mappedNode);
    }
  });

  // Treat all viewports consistently in sorting
  tree = tree.sort((a, b) => {
    if (isDynamicMode) {
      if (a.id === dynamicNodeId) return -1;
      if (b.id === dynamicNodeId) return 1;
    }

    // Consistently place all viewports at the top
    if (a.isViewport && !b.isViewport) return -1;
    if (!a.isViewport && b.isViewport) return 1;

    const aHasChildren = nodeMap.get(a.id).children.length > 0;
    const bHasChildren = nodeMap.get(b.id).children.length > 0;

    if (
      a.type === "frame" &&
      aHasChildren &&
      (b.type !== "frame" || !bHasChildren)
    )
      return -1;
    if (
      b.type === "frame" &&
      bHasChildren &&
      (a.type !== "frame" || !aHasChildren)
    )
      return 1;

    if (a.type === "frame" && !aHasChildren && b.type !== "frame") return 1;
    if (b.type === "frame" && !bHasChildren && a.type !== "frame") return -1;

    return 0;
  });

  return tree;
};

const getElementIcon = (type: string, isSelected: boolean) => {
  switch (type) {
    case "frame":
      return (
        <Frame
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } dark:group-hover:text-white`}
        />
      );
    case "text":
      return (
        <Type
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } dark:group-hover:text-white`}
        />
      );
    case "image":
      return (
        <ImageIcon
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } dark:group-hover:text-white`}
        />
      );
    default:
      return (
        <Box
          className={`w-4 h-4 ${
            isSelected ? "text-white" : "text-[var(--text-secondary)]"
          } group-hover:text-white`}
        />
      );
  }
};

// Constants for DnD
const DND_HOVER_TIMEOUT = 500; // ms until a hover opens a collapsed node

// Define drop position types
const enum DropPosition {
  Before = "before",
  After = "after",
  Inside = "inside",
  None = "none",
  Canvas = "canvas",
}

// Helper function to transform image/video to frame
const handleMediaToFrameTransformation = (
  mediaNode: Node,
  droppedNode: Node,
  nodeDisp: any
) => {
  // Create a frame from the media node
  const frameNode: Node = {
    ...mediaNode,
    type: "frame",
    style: {
      ...mediaNode.style,
      // Set the appropriate background property based on type
      ...(mediaNode.type === "video"
        ? {
            backgroundVideo: mediaNode.style.src,
          }
        : { backgroundImage: mediaNode.style.src }),
      src: undefined,
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  };

  // First replace the media with a frame (without moving the dropped node yet)
  nodeDisp.replaceNode(mediaNode.id, frameNode);

  // Important: We *don't* add the node as a child here - we let the normal drop flow handle that
  return true;
};

// Find root canvas node or create one at a reasonable position if dropping outside viewport
const findOrCreateCanvasPosition = (
  canvasElement: HTMLElement | null,
  nodeState: any,
  transform: any
) => {
  if (!canvasElement) return { x: 50, y: 50 }; // Default fallback

  const rect = canvasElement.getBoundingClientRect();
  const viewportNodes = nodeState.nodes.filter((n: Node) => n.isViewport);

  // Find the lowest viewport to place canvas elements below
  let lowestY = 0;
  viewportNodes.forEach((node: Node) => {
    const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
    if (nodeElement) {
      const viewRect = nodeElement.getBoundingClientRect();
      const bottom =
        (viewRect.bottom - rect.top - transform.y) / transform.scale;
      if (bottom > lowestY) lowestY = bottom;
    }
  });

  return {
    x: 50,
    y: lowestY + 50, // Position below the viewport with some padding
  };
};

// Helper to check if node is a child of dragged item
const isChildOfDragged = (
  nodeId: string | number,
  draggedId: string | number,
  nodes: Node[]
): boolean => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  if (node.parentId === draggedId) return true;
  if (node.parentId) return isChildOfDragged(node.parentId, draggedId, nodes);
  return false;
};

const TreeNodeComponent = ({
  node,
  level = 0,
}: {
  node: TreeNodeWithChildren;
  level?: number;
}) => {
  const {
    dragState,
    dragDisp,
    nodeDisp,
    setNodeStyle,
    nodeState,
    transform,
    contentRef,
  } = useBuilder();
  const isDynamicMode = !!dragState.dynamicModeNodeId;
  const isDynamicNode = node.id === dragState.dynamicModeNodeId;
  const isDynamicChild = node.dynamicParentId === dragState.dynamicModeNodeId;
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [customName, setCustomName] = useState(node.customName || node.type);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const hasChildren = node.children?.length > 0;
  const isSelected = dragState.selectedIds.includes(node.id);
  const isHidden = node.style.display === "none";

  // DnD state
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{
    position: DropPosition;
    isVisible: boolean;
  }>({
    position: DropPosition.None,
    isVisible: false,
  });

  // Clean up hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCustomName(node.customName || node.type);
  }, [node.customName, node.type]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && dragState.selectedIds.length > 0) {
      dragDisp.addToSelection(node.id);
    } else {
      dragDisp.selectNode(node.id);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomName(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (customName.trim() !== "") {
        nodeDisp.setCustomName(node.id, customName.trim());
      }
      setIsEditing(false);
    } else if (e.key === "Escape") {
      setCustomName(node.customName || node.type);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if (customName.trim() !== "") {
      nodeDisp.setCustomName(node.id, customName.trim());
    }
    setIsEditing(false);
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();

    // First select the node
    if (!isSelected) {
      dragDisp.selectNode(node.id);
    }

    // Always specify the exact node ID when making style changes
    // This ensures the change applies to the correct node regardless of selection state
    const nodeIds = [node.id];

    // Toggle visibility with explicit node IDs
    if (isHidden) {
      setNodeStyle({ display: "flex" }, nodeIds, true);
    } else {
      setNodeStyle({ display: "none" }, nodeIds, true);
    }
  };

  const getDisplayName = () => {
    if (node.isViewport) {
      return node.viewportName || `${node.viewportWidth}px`;
    }
    return node.customName ? node.customName : firstLetterUpperCase(node.type);
  };

  function firstLetterUpperCase(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    // First select the node if it's not already selected
    if (!isSelected) {
      dragDisp.selectNode(node.id);
    }

    // Then show the context menu
    dragDisp.setContextMenu(e.clientX, e.clientY, node.id);
  };

  // ----- Drag and Drop Handlers -----

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // Prevent dragging when editing or dragging from buttons
    if (isEditing || (e.target as HTMLElement).tagName === "BUTTON") {
      e.preventDefault();
      return;
    }

    // Set drag data - include full node details for debugging
    const dragDataObj = {
      id: node.id,
      type: node.type,
      parentId: node.parentId,
      isViewport: node.isViewport || false,
      viewportName: node.viewportName,
      inViewport: node.inViewport,
    };

    // Store data for drop event
    e.dataTransfer.setData("application/json", JSON.stringify(dragDataObj));

    // Log for debugging
    console.log("Dragging node:", dragDataObj);

    // Store drag info in global variable for access during dragOver
    currentDragInfo = {
      id: node.id,
      type: node.type,
      isViewport: node.isViewport || false,
      inViewport: node.inViewport || false,
    };

    e.dataTransfer.effectAllowed = "move";

    // Select the node if it's not already selected
    if (!isSelected) {
      dragDisp.selectNode(node.id);
    }

    setIsDragging(true);

    // Use a timeout to create a better-looking drag image
    setTimeout(() => {
      if (nodeRef.current) {
        nodeRef.current.style.opacity = "0.2"; // Make more transparent for better visibility
      }
    }, 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDropIndicator({ position: DropPosition.None, isVisible: false });

    if (nodeRef.current) {
      nodeRef.current.style.opacity = "1";
    }

    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Reset global drag info
    currentDragInfo = {
      id: null,
      type: null,
      isViewport: false,
      inViewport: false,
    };
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // If no drag info, can't proceed
    if (!currentDragInfo.id) {
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      return;
    }

    // Prevent dropping onto self
    if (currentDragInfo.id === node.id) {
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      e.dataTransfer.dropEffect = "none";
      return;
    }

    // Check if node is a child of dragged item
    if (isChildOfDragged(node.id, currentDragInfo.id, nodeState.nodes)) {
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      e.dataTransfer.dropEffect = "none";
      return;
    }

    // Get the dragged node for additional checks
    const draggedNode = nodeState.nodes.find(
      (n) => n.id === currentDragInfo.id
    );
    if (!draggedNode) {
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      return;
    }

    // Special canvas handling: For canvas nodes, only allow dropping INSIDE other frames/containers
    const isCanvasNode = !draggedNode.inViewport && !draggedNode.parentId;
    const isCanvasTarget = !node.inViewport && !node.parentId;

    if (isCanvasNode && isCanvasTarget) {
      // Both are canvas items - only allow "inside" drop on frames/containers
      const canBeContainer =
        node.type === "frame" || node.type === "image" || node.type === "video";

      if (canBeContainer) {
        // Only allow dropping INSIDE the container
        setDropIndicator({ position: DropPosition.Inside, isVisible: true });
      } else {
        // Don't allow dropping before/after non-container canvas elements
        setDropIndicator({ position: DropPosition.None, isVisible: false });
        e.dataTransfer.dropEffect = "none";
      }
      return;
    }

    // Find viewports of both nodes - IMPROVED VERSION
    const getNodeViewport = (
      nodeId: string | number
    ): string | number | null => {
      let currentId = nodeId;
      // Loop up through parents to find viewport
      while (currentId) {
        const currentNode = nodeState.nodes.find((n) => n.id === currentId);
        if (!currentNode) return null;

        // If we found a viewport, return its ID
        if (currentNode.isViewport) return currentNode.id;

        // If we've reached a node with no parent, it's not in a viewport
        if (!currentNode.parentId) return null;

        // Move up to the parent
        currentId = currentNode.parentId;
      }
      return null;
    };

    const draggedNodeViewport = getNodeViewport(currentDragInfo.id);
    const targetNodeViewport = getNodeViewport(node.id);

    // Prevent cross-viewport drops (only allow within same viewport or to canvas)
    if (
      currentDragInfo.isViewport &&
      node.isViewport &&
      node.id !== currentDragInfo.id
    ) {
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      e.dataTransfer.dropEffect = "none";
      return;
    }

    // MODIFIED: Allow drops if both nodes are in the same viewport, including all viewport types
    if (
      draggedNodeViewport &&
      targetNodeViewport &&
      draggedNodeViewport !== targetNodeViewport
    ) {
      // Different viewports - prevent drop
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      e.dataTransfer.dropEffect = "none";
      return;
    }
    // Same viewport - allow drop (continue with function execution)

    // Determine drop position
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const isFrame = node.type === "frame";
    const isMedia = node.type === "image" || node.type === "video";
    const canContainChildren = isFrame || isMedia;

    let position = DropPosition.None;

    // Top 25% = before, Bottom 25% = after, Middle 50% = inside (for frames and media only)
    if (y < rect.height * 0.25) {
      position = DropPosition.Before;
    } else if (y > rect.height * 0.75) {
      position = DropPosition.After;
    } else if (canContainChildren && !node.isViewport) {
      position = DropPosition.Inside;

      // Auto-expand node if hovering for a while
      if (!isExpanded && hasChildren) {
        if (!hoverTimeoutRef.current) {
          hoverTimeoutRef.current = window.setTimeout(() => {
            setIsExpanded(true);
            hoverTimeoutRef.current = null;
          }, DND_HOVER_TIMEOUT);
        }
      }
    } else {
      position = DropPosition.After;
    }

    // Don't allow inside drop on viewports
    if (node.isViewport && position === DropPosition.Inside) {
      position = DropPosition.After;
    }

    setDropIndicator({ position, isVisible: true });
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = () => {
    setDropIndicator({ position: DropPosition.None, isVisible: false });

    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear any pending hover timeouts
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    setDropIndicator({ position: DropPosition.None, isVisible: false });

    try {
      const dragDataRaw = e.dataTransfer.getData("application/json");
      if (!dragDataRaw) {
        console.error("No drag data found in drop event");
        return;
      }

      const dragData = JSON.parse(dragDataRaw);

      // Prevent dropping onto self
      if (dragData.id === node.id) {
        return;
      }

      // Check if node is a child of dragged item
      if (isChildOfDragged(node.id, dragData.id, nodeState.nodes)) {
        return;
      }

      const draggedNode = nodeState.nodes.find((n) => n.id === dragData.id);
      if (!draggedNode) {
        console.error("Dragged node not found:", dragData.id);
        return;
      }

      // Check if multi-selection is being dragged
      const selectedIds = dragState.selectedIds;
      const isMultiSelectionDrag =
        selectedIds.length > 1 && selectedIds.includes(draggedNode.id);

      // Handle media to frame transformation
      if (
        dropIndicator.position === DropPosition.Inside &&
        (node.type === "image" || node.type === "video")
      ) {
        // First, transform the media node to a frame
        const mediaNode = node;
        handleMediaToFrameTransformation(mediaNode, draggedNode, nodeDisp);

        // Now perform the normal drop operations to move nodes into the newly created frame
        const frameId = mediaNode.id; // Same ID was retained when replacing

        if (isMultiSelectionDrag) {
          // Move all selected nodes inside the new frame node
          selectedIds.forEach((id, index) => {
            if (index === 0) {
              nodeDisp.moveNode(id, true, {
                targetId: frameId,
                position: "inside",
              });
            } else {
              const prevId = selectedIds[index - 1];
              nodeDisp.moveNode(id, true, {
                targetId: prevId,
                position: "after",
              });
            }

            // Fix styles for the moved element
            setNodeStyle(
              {
                position: "relative",
                zIndex: "",
                transform: "",
                left: "",
                top: "",
              },
              [id],
              undefined
            );
          });
        } else {
          // Move the single dragged node inside the new frame
          nodeDisp.moveNode(draggedNode.id, true, {
            targetId: frameId,
            position: "inside",
          });

          // Fix styles for the moved element
          setNodeStyle(
            {
              position: "relative",
              zIndex: "",
              transform: "",
              left: "",
              top: "",
            },
            [draggedNode.id],
            undefined
          );
        }

        // Expand the node to show the newly added children
        setIsExpanded(true);

        // Sync viewports if necessary
        if (!dragState.dynamicModeNodeId) {
          nodeDisp.syncViewports();
        }

        return;
      }

      // Handle the drop based on position with improved logging
      const logMove = (id, targetId, position) => {
        console.log(`Moving node ${id} ${position} node ${targetId}`);
      };

      switch (dropIndicator.position) {
        case DropPosition.Before:
          if (isMultiSelectionDrag) {
            // Move all selected nodes before this node
            selectedIds.forEach((id, index) => {
              if (index === 0) {
                logMove(id, node.id, "before");
                nodeDisp.moveNode(id, true, {
                  targetId: node.id,
                  position: "before",
                });
              } else {
                const prevId = selectedIds[index - 1];
                logMove(id, prevId, "after");
                nodeDisp.moveNode(id, true, {
                  targetId: prevId,
                  position: "after",
                });
              }
            });
          } else {
            // Make a clean, explicit call to moveNode
            logMove(draggedNode.id, node.id, "before");
            nodeDisp.moveNode(draggedNode.id, true, {
              targetId: node.id,
              position: "before",
            });
          }
          break;

        case DropPosition.After:
          if (isMultiSelectionDrag) {
            // Move all selected nodes after this node
            selectedIds.forEach((id, index) => {
              if (index === 0) {
                logMove(id, node.id, "after");
                nodeDisp.moveNode(id, true, {
                  targetId: node.id,
                  position: "after",
                });
              } else {
                const prevId = selectedIds[index - 1];
                logMove(id, prevId, "after");
                nodeDisp.moveNode(id, true, {
                  targetId: prevId,
                  position: "after",
                });
              }
            });
          } else {
            // Make a clean, explicit call to moveNode
            logMove(draggedNode.id, node.id, "after");
            nodeDisp.moveNode(draggedNode.id, true, {
              targetId: node.id,
              position: "after",
            });
          }
          break;

        case DropPosition.Inside:
          if (
            node.type === "frame" ||
            node.type === "image" ||
            node.type === "video"
          ) {
            if (isMultiSelectionDrag) {
              // Move all selected nodes inside this node
              selectedIds.forEach((id, index) => {
                if (index === 0) {
                  logMove(id, node.id, "inside");
                  nodeDisp.moveNode(id, true, {
                    targetId: node.id,
                    position: "inside",
                  });
                } else {
                  const prevId = selectedIds[index - 1];
                  logMove(id, prevId, "after");
                  nodeDisp.moveNode(id, true, {
                    targetId: prevId,
                    position: "after",
                  });
                }
              });

              // Expand this node to show the newly added children
              setIsExpanded(true);
            } else {
              logMove(draggedNode.id, node.id, "inside");
              nodeDisp.moveNode(draggedNode.id, true, {
                targetId: node.id,
                position: "inside",
              });

              // Expand this node to show the newly added child
              setIsExpanded(true);
            }
          }
          break;

        case DropPosition.Canvas:
          // This case is handled by the Canvas drop handler
          break;

        default:
          break;
      }

      // Update styles for all moved nodes
      const nodesToUpdate = isMultiSelectionDrag
        ? selectedIds
        : [draggedNode.id];

      nodesToUpdate.forEach((id) => {
        setNodeStyle(
          {
            position: "relative",
            zIndex: "",
            transform: "",
            left: "",
            top: "",
          },
          [id],
          undefined
        );
      });

      setTimeout(() => {
        // Determine which viewport this operation happened in
        const getNodeViewport = (nodeId) => {
          let currentId = nodeId;
          while (currentId) {
            const currentNode = nodeState.nodes.find((n) => n.id === currentId);
            if (!currentNode) return null;

            // If we found a viewport, return it
            if (currentNode.isViewport) return currentNode;

            // If we've reached a node with no parent, it's not in a viewport
            if (!currentNode.parentId) return null;

            // Move up to the parent
            currentId = currentNode.parentId;
          }
          return null;
        };

        // Find the viewport of the target node
        const targetViewport = getNodeViewport(node.id);

        if (targetViewport && targetViewport.viewportWidth !== 1440) {
          // If we're in a non-desktop viewport, sync FROM this viewport
          console.log(
            `Syncing from viewport: ${
              targetViewport.viewportName || targetViewport.id
            }`
          );
          nodeDisp.syncFromViewport(targetViewport.id);
        } else {
          // Default case: sync from desktop to all viewports
          console.log("Syncing from desktop to all viewports");
          nodeDisp.syncViewports();
        }

        // Make sure we're selecting the dragged node to complete the operation
        dragDisp.selectNode(draggedNode.id);
      }, 10);
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  return (
    <li className="relative select-none list-none">
      <div
        ref={nodeRef}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          `group flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] transition-colors duration-150`,
          "cursor-pointer",
          !isSelected && " hover:bg-[var(--bg-hover)]",
          isSelected &&
            `${
              node.isDynamic ||
              isDynamicChild ||
              (isDynamicMode && isDynamicNode)
                ? "bg-[var(--accent-secondary)]"
                : "bg-[var(--accent)]"
            } text-white`,
          !isSelected &&
            isDynamicMode &&
            isDynamicChild &&
            "bg-[var(--accent-secondary)]/20",
          isDragging && "opacity-20"
        )}
        style={{
          paddingLeft: `${level * 12 + 8}px`,
          position: "relative",
          height: "28px", // Fixed height for the entire row
          minHeight: "28px",
          maxHeight: "28px",
          boxSizing: "border-box",
        }}
      >
        {/* Drop indicators */}
        {dropIndicator.isVisible &&
          dropIndicator.position === DropPosition.Before && (
            <div className="absolute left-0 right-0 top-0 h-1 bg-[var(--accent)] z-10" />
          )}
        {dropIndicator.isVisible &&
          dropIndicator.position === DropPosition.After && (
            <div className="absolute left-0 right-0 bottom-0 h-1 bg-[var(--accent)] z-10" />
          )}
        {dropIndicator.isVisible &&
          dropIndicator.position === DropPosition.Inside && (
            <div className="absolute inset-0 border-2 border-[var(--accent)] rounded-sm z-10 opacity-70" />
          )}

        <button
          onClick={handleToggle}
          className={cn(
            "w-4 h-4 flex items-center justify-center",
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors",
            !hasChildren && "invisible"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        <span
          className={cn(
            "text-[var(--text-secondary)]",
            isSelected && "text-white"
          )}
        >
          {node.isViewport ? (
            node.viewportName === "Desktop" ? (
              <Monitor
                className={`w-4 h-4 ${
                  isSelected ? "text-white" : "text-[var(--accent)]"
                }`}
              />
            ) : node.viewportName === "Tablet" ? (
              <Tablet
                className={`w-4 h-4 ${
                  isSelected ? "text-white" : "text-[var(--accent)]"
                }`}
              />
            ) : node.viewportName === "Mobile" ? (
              <Smartphone
                className={`w-4 h-4 ${
                  isSelected ? "text-white" : "text-[var(--accent)]"
                }`}
              />
            ) : (
              <Monitor
                className={`w-4 h-4 ${
                  isSelected ? "text-white" : "text-[var(--text-secondary)]"
                }`}
              />
            )
          ) : (
            getElementIcon(node.type, isSelected)
          )}
        </span>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={customName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={cn(
              "text-xs font-medium bg-transparent border border-[var(--border-light)] rounded px-1 py-0.5 flex-1 outline-none box-border",
              isSelected ? "text-white" : "text-[var(--text-primary)]",
              "h-[18px] leading-[normal] m-0" // Fixed height to match span
            )}
            onClick={(e) => e.stopPropagation()}
            style={{ minHeight: "18px", maxHeight: "18px" }}
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            className={cn(
              "text-xs font-medium truncate flex-1",
              "text-[var(--text-secondary)] dark:group-hover:text-[var(--text-primary)]",
              isSelected && "text-white",
              isHidden && "italic opacity-50",
              "h-[18px] leading-[18px]" // Fixed height
            )}
          >
            {getDisplayName()}
          </span>
        )}

        {/* Hide visibility toggle for viewports */}
        {!node.isViewport && (
          <button
            onClick={handleToggleVisibility}
            className={cn(
              "w-3.5 h-3.5 flex items-center justify-center",
              isHidden ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              "transition-opacity",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              isSelected && "text-white"
            )}
            title={isHidden ? "Show element" : "Hide element"}
          >
            {isHidden ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul className="mt-0.5 space-y-0.5 list-none">
          {node.children.map((child) => (
            <TreeNodeComponent key={child.id} node={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};

const LayersPanel = () => {
  const {
    nodeState,
    dragState,
    nodeDisp,
    setNodeStyle,
    transform,
    contentRef,
  } = useBuilder();
  const isDynamicMode = !!dragState.dynamicModeNodeId;
  const treeData = buildTreeFromNodes(
    nodeState.nodes,
    isDynamicMode,
    dragState.dynamicModeNodeId
  );
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle drops to canvas (outside of any layer item)
  const handlePanelDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Only process if we're over the panel background and not a tree node
    if ((e.target as HTMLElement).closest("li")) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handlePanelDrop = (e: React.DragEvent<HTMLDivElement>) => {
    // Only process if we're over the panel background and not a tree node
    if ((e.target as HTMLElement).closest("li")) return;

    e.preventDefault();

    try {
      const dragData = JSON.parse(
        e.dataTransfer.getData("application/json") || "{}"
      );
      const draggedNode = nodeState.nodes.find((n) => n.id === dragData.id);
      if (!draggedNode) return;

      // Check if multi-selection is being dragged
      const selectedIds = dragState.selectedIds;
      const isMultiSelectionDrag =
        selectedIds.length > 1 && selectedIds.includes(draggedNode.id);

      const canvasElement = contentRef.current;
      const position = findOrCreateCanvasPosition(
        canvasElement,
        nodeState,
        transform
      );

      // Offset each subsequent element slightly to make them visible
      let xOffset = 0;
      let yOffset = 0;
      const offsetStep = 20;

      if (isMultiSelectionDrag) {
        selectedIds.forEach((id, index) => {
          const currentNode = nodeState.nodes.find((n) => n.id === id);
          if (!currentNode) return;

          // Move node to canvas
          nodeDisp.moveNode(id, false);

          // Update position and style
          setNodeStyle(
            {
              position: "absolute",
              left: `${position.x + xOffset}px`,
              top: `${position.y + yOffset}px`,
              zIndex: "",
              transform: "",
            },
            [id],
            undefined
          );

          // Update position for next element
          xOffset += offsetStep;
          yOffset += offsetStep;
        });
      } else {
        // Move single node to canvas
        nodeDisp.moveNode(draggedNode.id, false);

        // Update position and style
        setNodeStyle(
          {
            position: "absolute",
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: "",
            transform: "",
          },
          [draggedNode.id],
          undefined
        );
      }

      // Sync viewports if necessary
      if (!dragState.dynamicModeNodeId) {
        nodeDisp.syncViewports();
      }
    } catch (error) {
      console.error("Error handling canvas drop:", error);
    }
  };

  return (
    <div
      className="h-full bg-[var(--bg-surface)] pb-10 overflow-auto"
      ref={panelRef}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
    >
      <div className="p-2.5 space-y-2">
        {treeData.map((node) => (
          <TreeNodeComponent
            key={node.id}
            node={node as TreeNodeWithChildren}
          />
        ))}
      </div>
    </div>
  );
};

export default LayersPanel;
