import React, { useState, useRef, useEffect } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import {
  ChevronRight,
  ChevronDown,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/providers/cn";
import {
  TreeNodeWithChildren,
  DropPosition,
  currentDragInfo,
} from "@/builder/types";
import {
  getElementIcon,
  DND_HOVER_TIMEOUT,
  handleMediaToFrameTransformation,
  isChildOfDragged,
  firstLetterUpperCase,
  getNodeViewport,
} from "./utils";

interface TreeNodeProps {
  node: TreeNodeWithChildren;
  level?: number;
}

const TreeNodeComponent: React.FC<TreeNodeProps> = ({ node, level = 0 }) => {
  const { dragState, dragDisp, nodeDisp, setNodeStyle, nodeState } =
    useBuilder();
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
    // Completely prevent dragging viewports
    if (node.isViewport) {
      e.preventDefault();
      e.stopPropagation();
      console.log("DRAGSTART-BLOCKED: Viewports cannot be dragged");
      return;
    }

    console.log("DRAGSTART: Starting drag on node", node.id, node.type);

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

    // Store drag info in global variable for access during dragOver
    currentDragInfo.id = node.id;
    currentDragInfo.type = node.type;
    currentDragInfo.isViewport = node.isViewport || false;
    currentDragInfo.inViewport = node.inViewport || false;

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
    console.log("DRAGEND: Ending drag on node", node.id);

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
    currentDragInfo.id = null;
    currentDragInfo.type = null;
    currentDragInfo.isViewport = false;
    currentDragInfo.inViewport = false;
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

    // Get the node being dragged for additional checks
    const draggedNode = nodeState.nodes.find(
      (n) => n.id === currentDragInfo.id
    );
    if (!draggedNode) {
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      return;
    }

    // CRITICAL CHECK 1: If either node is a viewport, NEVER allow Inside position
    // This means we can never drop a viewport inside anything, or anything inside a viewport
    if (draggedNode.isViewport || node.isViewport) {
      console.log("DRAGOVER: Viewport involved, forcing Before/After position");

      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;

      // Only allow Before/After positions for viewports
      const position =
        y < rect.height * 0.5 ? DropPosition.Before : DropPosition.After;
      setDropIndicator({ position, isVisible: true });
      e.dataTransfer.dropEffect = "move";
      return;
    }

    // Check if node is a child of dragged item
    if (isChildOfDragged(node.id, currentDragInfo.id, nodeState.nodes)) {
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      e.dataTransfer.dropEffect = "none";
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

    // Find viewports of both nodes
    const draggedNodeViewport = getNodeViewport(currentDragInfo.id, nodeState);
    const targetNodeViewport = getNodeViewport(node.id, nodeState);

    // Allow drops if both nodes are in the same viewport, including all viewport types
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

    // Determine drop position - Regular case (non-viewport)
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
    } else if (canContainChildren) {
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

    setDropIndicator({ position, isVisible: true });
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = () => {
    console.log("DRAGLEAVE: Leaving node", node.id);

    setDropIndicator({ position: DropPosition.None, isVisible: false });

    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    console.log(
      "DROP-START: Drop event starting on node",
      node.id,
      "isViewport:",
      node.isViewport
    );

    // Clear any pending hover timeouts
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    setDropIndicator({ position: DropPosition.None, isVisible: false });

    // Parse drag data
    let dragData: Node;
    try {
      const dragDataRaw = e.dataTransfer.getData("application/json");
      if (!dragDataRaw) {
        console.error("No drag data found in drop event");
        return;
      }

      dragData = JSON.parse(dragDataRaw);
      console.log("DROP-DATA: Dropped data", dragData, "onto node", node.id);

      // CRITICAL CHECK 2: If trying to drop a viewport inside another viewport, block immediately
      if (
        dragData.isViewport &&
        node.isViewport &&
        dropIndicator.position === DropPosition.Inside
      ) {
        console.log(
          "DROP-BLOCKED: Cannot drop viewport inside another viewport"
        );
        return;
      }

      // CRITICAL CHECK 3: If trying to drop a viewport with "inside" position, block immediately
      if (
        dragData.isViewport &&
        dropIndicator.position === DropPosition.Inside
      ) {
        console.log("DROP-BLOCKED: Cannot drop viewport inside any element");
        return;
      }

      // Prevent dropping onto self
      if (dragData.id === node.id) {
        console.log("DROP-BLOCKED: Cannot drop node onto itself");
        return;
      }

      // Check if node is a child of dragged item
      if (isChildOfDragged(node.id, dragData.id, nodeState.nodes)) {
        console.log("DROP-BLOCKED: Cannot drop parent onto its own child");
        return;
      }

      // Retrieve the full node from node state
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
        console.log("DROP-MEDIA: Transforming media to frame");

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

      // Handle the drop based on position
      console.log(
        "DROP-POSITION: Handling drop with position",
        dropIndicator.position
      );

      switch (dropIndicator.position) {
        case DropPosition.Before:
          console.log("DROP-BEFORE: Dropping before node", node.id);

          if (isMultiSelectionDrag) {
            // Move all selected nodes before this node
            selectedIds.forEach((id, index) => {
              if (index === 0) {
                console.log(
                  "DROP-MULTI-BEFORE: Moving first node",
                  id,
                  "before",
                  node.id
                );
                nodeDisp.moveNode(id, true, {
                  targetId: node.id,
                  position: "before",
                });
              } else {
                const prevId = selectedIds[index - 1];
                console.log(
                  "DROP-MULTI-BEFORE: Moving next node",
                  id,
                  "after",
                  prevId
                );
                nodeDisp.moveNode(id, true, {
                  targetId: prevId,
                  position: "after",
                });
              }
            });
          } else {
            console.log(
              "DROP-BEFORE: Moving single node",
              draggedNode.id,
              "before",
              node.id
            );
            nodeDisp.moveNode(draggedNode.id, true, {
              targetId: node.id,
              position: "before",
            });
          }
          break;

        case DropPosition.After:
          console.log("DROP-AFTER: Dropping after node", node.id);

          if (isMultiSelectionDrag) {
            // Move all selected nodes after this node
            selectedIds.forEach((id, index) => {
              if (index === 0) {
                console.log(
                  "DROP-MULTI-AFTER: Moving first node",
                  id,
                  "after",
                  node.id
                );
                nodeDisp.moveNode(id, true, {
                  targetId: node.id,
                  position: "after",
                });
              } else {
                const prevId = selectedIds[index - 1];
                console.log(
                  "DROP-MULTI-AFTER: Moving next node",
                  id,
                  "after",
                  prevId
                );
                nodeDisp.moveNode(id, true, {
                  targetId: prevId,
                  position: "after",
                });
              }
            });
          } else {
            console.log(
              "DROP-AFTER: Moving single node",
              draggedNode.id,
              "after",
              node.id
            );
            nodeDisp.moveNode(draggedNode.id, true, {
              targetId: node.id,
              position: "after",
            });
          }
          break;

        case DropPosition.Inside:
          console.log("DROP-INSIDE: Attempting to drop inside node", node.id);

          // CRITICAL CHECK 4: If trying to drop a viewport inside anything, block again
          if (draggedNode.isViewport) {
            console.log(
              "DROP-INSIDE-BLOCKED: Cannot drop viewport inside anything"
            );
            break;
          }

          // CRITICAL CHECK 5: If trying to drop anything inside a viewport, block again
          if (node.isViewport) {
            console.log(
              "DROP-INSIDE-BLOCKED: Cannot drop anything inside a viewport"
            );
            break;
          }

          if (
            node.type === "frame" ||
            node.type === "image" ||
            node.type === "video"
          ) {
            if (isMultiSelectionDrag) {
              // Make sure no viewports are in the selection before proceeding
              const hasViewports = selectedIds.some((id) => {
                const node = nodeState.nodes.find((n) => n.id === id);
                return node && node.isViewport;
              });

              if (hasViewports) {
                console.log(
                  "DROP-INSIDE-BLOCKED: Cannot drop selection with viewports inside another element"
                );
                break;
              }

              // Move all selected nodes inside this node
              selectedIds.forEach((id, index) => {
                if (index === 0) {
                  console.log(
                    "DROP-MULTI-INSIDE: Moving first node",
                    id,
                    "inside",
                    node.id
                  );
                  nodeDisp.moveNode(id, true, {
                    targetId: node.id,
                    position: "inside",
                  });
                } else {
                  const prevId = selectedIds[index - 1];
                  console.log(
                    "DROP-MULTI-INSIDE: Moving next node",
                    id,
                    "after",
                    prevId
                  );
                  nodeDisp.moveNode(id, true, {
                    targetId: prevId,
                    position: "after",
                  });
                }
              });

              // Expand this node to show the newly added children
              setIsExpanded(true);
            } else {
              console.log(
                "DROP-INSIDE: Moving single node",
                draggedNode.id,
                "inside",
                node.id
              );
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
          console.log("DROP-CANVAS: Canvas drop will be handled separately");
          break;

        default:
          console.log("DROP-NONE: No valid drop position");
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
        // Find the viewport of the target node
        const targetViewport = getNodeViewport(node.id, nodeState);
        const targetViewportNode = targetViewport
          ? nodeState.nodes.find((n: Node) => n.id === targetViewport)
          : null;

        if (targetViewportNode && targetViewportNode.viewportWidth !== 1440) {
          // If we're in a non-desktop viewport, sync FROM this viewport
          console.log(
            `Syncing from viewport: ${
              targetViewportNode.viewportName || targetViewportNode.id
            }`
          );
          nodeDisp.syncFromViewport(targetViewportNode.id);
        } else {
          // Default case: sync from desktop to all viewports
          console.log("Syncing from desktop to all viewports");
          nodeDisp.syncViewports();
        }

        // Make sure we're selecting the dragged node to complete the operation
        dragDisp.selectNode(draggedNode.id);
      }, 10);
    } catch (error) {
      console.error("DROP-ERROR: Error handling drop:", error);
    }
  };

  return (
    <li className="relative select-none list-none">
      <div
        ref={nodeRef}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        draggable={!isEditing && !node.isViewport}
        onDragStart={!node.isViewport ? handleDragStart : undefined}
        onDragEnd={!node.isViewport ? handleDragEnd : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          `group flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] transition-colors duration-150`,
          "cursor-pointer",
          node.isViewport && "cursor-default", // Change cursor for viewports
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
              "text-xs font-medium bg-transparent border border-[var(--border-light)] rounded ml-1 py-1 flex-1 outline-none box-border",
              isSelected ? "text-white" : "text-[var(--text-primary)]",
              "h-[18px] leading-[normal] m-0" // Fixed height to match span
            )}
            onClick={(e) => e.stopPropagation()}
            style={{ minHeight: "18px", maxHeight: "20px" }}
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

export default TreeNodeComponent;
