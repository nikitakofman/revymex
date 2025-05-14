import React, { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  EyeOff,
  Lock,
  Unlock,
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
  isChildOfDragged,
  firstLetterUpperCase,
  getNodeViewport,
} from "./utils";
import { handleMediaToFrameTransformation } from "@/builder/context/utils";
import { useAtomValue } from "jotai";
import {
  isNodeSelectedAtom,
  selectOps,
  selectStore,
  useGetSelectedIds,
} from "@/builder/context/atoms/select-store";
import { contextMenuOps } from "@/builder/context/atoms/context-menu-store";
import { canvasOps } from "@/builder/context/atoms/canvas-interaction-store";
import {
  dynamicOps,
  useDynamicModeNodeId,
} from "@/builder/context/atoms/dynamic-store";
import {
  useNodeChildren,
  useGetNodeParent,
} from "@/builder/context/atoms/node-store/hierarchy-store";
import {
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeSharedInfo,
  useGetNodeDynamicInfo,
  useUpdateNodeBasics,
  useUpdateNodeStyle,
  useUpdateNodeFlags,
  nodeStore,
  nodeBasicsAtom,
  getCurrentNodes,
  NodeId,
} from "@/builder/context/atoms/node-store";
import {
  insertAtIndex,
  moveNode,
} from "@/builder/context/atoms/node-store/operations/insert-operations";
import { syncViewports } from "@/builder/context/atoms/node-store/operations/sync-operations";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import { updateNodeFlags } from "@/builder/context/atoms/node-store/operations/update-operations";

interface TreeNodeProps {
  node: TreeNodeWithChildren;
  level?: number;
}

const TreeNodeComponent: React.FC<TreeNodeProps> = ({ node, level = 0 }) => {
  // Get jotai state and operations
  const currentSelectedIds = useGetSelectedIds();
  const { addToSelection, selectNode } = selectOps;
  const dynamicModeNodeId = useDynamicModeNodeId();
  const isDynamicMode = !!dynamicModeNodeId;
  const isDynamicNode = node.id === dynamicModeNodeId;
  const isDynamicChild = node.dynamicParentId === dynamicModeNodeId;

  // Get node data from store
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeSharedInfo = useGetNodeSharedInfo();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();

  // Update node basics directly with atoms
  const updateNodeBasics = useUpdateNodeBasics(node.id);

  // Get children directly from hierarchy store
  const childrenIds = useNodeChildren(node.id);

  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [customName, setCustomName] = useState(node.customName || node.type);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const hasChildren = childrenIds.length > 0;

  const isSelected = useAtomValue(isNodeSelectedAtom(node.id), {
    store: selectStore,
  });

  // Check if node is hidden
  const style = getNodeStyle(node.id);
  const isHidden = style.display === "none";

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

  // Update custom name when node changes
  useEffect(() => {
    const basics = getNodeBasics(node.id);
    setCustomName(basics.customName || basics.type);
  }, [node.id, getNodeBasics]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();

    const selectedIds = currentSelectedIds();
    if (e.shiftKey && selectedIds.length > 0) {
      addToSelection(node.id);
    } else {
      selectNode(node.id);
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
        // Update node basics directly with atom
        updateNodeBasics((prev) => ({
          ...prev,
          customName: customName.trim(),
        }));
      }
      setIsEditing(false);
    } else if (e.key === "Escape") {
      setCustomName(
        getNodeBasics(node.id).customName || getNodeBasics(node.id).type
      );
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if (customName.trim() !== "") {
      // Update node basics directly with atom
      updateNodeBasics((prev) => ({
        ...prev,
        customName: customName.trim(),
      }));
    }
    setIsEditing(false);
    canvasOps.setIsEditingText(false);
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();

    // First select the node
    if (!isSelected) {
      selectNode(node.id);
    }

    // Always specify the exact node ID when making style changes
    // Use direct updateNodeStyle function instead of setNodeStyle
    if (isHidden) {
      updateNodeStyle(node.id, { display: "flex" });

      // Handle syncing across viewports
      const nodeFlags = getNodeFlags(node.id);
      if (nodeFlags.inViewport && !dynamicModeNodeId) {
        const parentId = getNodeParent(node.id);
        if (parentId !== null) {
          syncViewports(node.id, parentId);
        }
      }
    } else {
      updateNodeStyle(node.id, { display: "none" });

      // Handle syncing across viewports
      const nodeFlags = getNodeFlags(node.id);
      if (nodeFlags.inViewport && !dynamicModeNodeId) {
        const parentId = getNodeParent(node.id);
        if (parentId !== null) {
          syncViewports(node.id, parentId);
        }
      }
    }
  };

  const getDisplayName = () => {
    const flags = getNodeFlags(node.id);
    if (flags.isViewport) {
      return node.viewportName || `${flags.viewportWidth}px`;
    }
    const basics = getNodeBasics(node.id);
    return basics.customName
      ? basics.customName
      : firstLetterUpperCase(basics.type);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    // First select the node if it's not already selected
    if (!isSelected) {
      selectNode(node.id);
    }

    // Then show the context menu
    contextMenuOps.setContextMenu(e.clientX, e.clientY, node.id);
  };

  // ----- Drag and Drop Handlers -----

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const flags = getNodeFlags(node.id);
    // Completely prevent dragging viewports
    if (flags.isViewport) {
      e.preventDefault();
      e.stopPropagation();
      console.log("DRAGSTART-BLOCKED: Viewports cannot be dragged");
      return;
    }

    console.log(
      "DRAGSTART: Starting drag on node",
      node.id,
      getNodeBasics(node.id).type
    );

    // Prevent dragging when editing or dragging from buttons
    if (isEditing || (e.target as HTMLElement).tagName === "BUTTON") {
      e.preventDefault();
      return;
    }

    // Set drag data - include full node details for debugging
    const basics = getNodeBasics(node.id);
    const parentId = getNodeParent(node.id);

    const dragDataObj = {
      id: node.id,
      type: basics.type,
      parentId: parentId,
      isViewport: flags.isViewport || false,
      viewportName: node.viewportName,
      inViewport: flags.inViewport,
    };

    // Store data for drop event
    e.dataTransfer.setData("application/json", JSON.stringify(dragDataObj));

    // Store drag info in global variable for access during dragOver
    currentDragInfo.id = node.id;
    currentDragInfo.type = basics.type;
    currentDragInfo.isViewport = flags.isViewport || false;
    currentDragInfo.inViewport = flags.inViewport || false;

    e.dataTransfer.effectAllowed = "move";

    // Select the node if it's not already selected
    if (!isSelected) {
      selectNode(node.id);
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
    const allNodes = getCurrentNodes();
    const draggedNode = allNodes.find((n) => n.id === currentDragInfo.id);

    if (!draggedNode) {
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      return;
    }

    const flags = getNodeFlags(node.id);

    // CRITICAL CHECK 1: If either node is a viewport, NEVER allow Inside position
    // This means we can never drop a viewport inside anything, or anything inside a viewport
    if (draggedNode.isViewport || flags.isViewport) {
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
    if (isChildOfDragged(node.id, currentDragInfo.id, allNodes)) {
      setDropIndicator({ position: DropPosition.None, isVisible: false });
      e.dataTransfer.dropEffect = "none";
      return;
    }

    // Special canvas handling: For canvas nodes, only allow dropping INSIDE other frames/containers
    const isCanvasNode = !draggedNode.inViewport && !draggedNode.parentId;
    const isCanvasTarget = !flags.inViewport && !getNodeParent(node.id);

    if (isCanvasNode && isCanvasTarget) {
      // Both are canvas items - only allow "inside" drop on frames/containers
      const nodeType = getNodeBasics(node.id).type;
      const canBeContainer =
        nodeType === "frame" || nodeType === "image" || nodeType === "video";

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
    const allNodesArray = getCurrentNodes();
    const nodeState = { nodes: allNodesArray };
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
    const nodeType = getNodeBasics(node.id).type;
    const isFrame = nodeType === "frame";
    const isMedia = nodeType === "image" || nodeType === "video";
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
      getNodeFlags(node.id).isViewport
    );

    // Clear any pending hover timeouts
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    setDropIndicator({ position: DropPosition.None, isVisible: false });

    // Parse drag data
    let dragData: Record<string, any>;
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
        getNodeFlags(node.id).isViewport &&
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
      const allNodes = getCurrentNodes();
      const nodeState = { nodes: allNodes };
      if (isChildOfDragged(node.id, dragData.id, allNodes)) {
        console.log("DROP-BLOCKED: Cannot drop parent onto its own child");
        return;
      }

      // Retrieve the full node from node state
      const draggedNode = allNodes.find((n) => n.id === dragData.id);
      if (!draggedNode) {
        console.error("Dragged node not found:", dragData.id);
        return;
      }
      const selectedIds = currentSelectedIds();

      // Check if multi-selection is being dragged
      const isMultiSelectionDrag =
        selectedIds.length > 1 && selectedIds.includes(draggedNode.id);

      // Handle media to frame transformation
      if (
        dropIndicator.position === DropPosition.Inside &&
        (getNodeBasics(node.id).type === "image" ||
          getNodeBasics(node.id).type === "video")
      ) {
        console.log("DROP-MEDIA: Transforming media to frame");

        // First, transform the media node to a frame
        const mediaNode = node;
        handleMediaToFrameTransformation(mediaNode, draggedNode, {
          // Create a minimal nodeDisp interface for the transformation
          setBasics: (id: NodeId, updates: Record<string, any>) => {
            nodeStore.set(nodeBasicsAtom(id), (prev: Record<string, any>) => ({
              ...prev,
              ...updates,
            }));
          },
          updateNodeStyle: (ids: NodeId[], style: Record<string, any>) => {
            if (ids.length > 0) {
              updateNodeStyle(ids[0], style);
            }
          },
        });

        // Now perform the normal drop operations to move nodes into the newly created frame
        const frameId = mediaNode.id; // Same ID was retained when replacing

        if (isMultiSelectionDrag) {
          // Move all selected nodes inside the new frame node
          selectedIds.forEach((id, index) => {
            if (index === 0) {
              // First selected node goes inside the frame
              moveNode(id, frameId);

              // Fix styles for the moved element
              updateNodeStyle(id, {
                position: "relative",
                zIndex: "",
                transform: "",
                left: "",
                top: "",
              });
            } else {
              // Other selected nodes go after the previous selected node
              const prevId = selectedIds[index - 1];
              const siblings = childrenIds;
              const prevIndex = siblings.indexOf(prevId);

              // Insert after the previous node
              if (prevIndex !== -1) {
                insertAtIndex(id, frameId, prevIndex + 1);
              } else {
                // Fallback to just adding as a child
                moveNode(id, frameId);
              }

              // Fix styles
              updateNodeStyle(id, {
                position: "relative",
                zIndex: "",
                transform: "",
                left: "",
                top: "",
              });
            }
          });
        } else {
          // Move the single dragged node inside the new frame
          moveNode(draggedNode.id, frameId);

          // Fix styles for the moved element
          updateNodeStyle(draggedNode.id, {
            position: "relative",
            zIndex: "",
            transform: "",
            left: "",
            top: "",
          });
        }

        // Expand the node to show the newly added children
        setIsExpanded(true);

        // Sync viewports if necessary
        if (!dynamicModeNodeId) {
          const parentId = getNodeParent(frameId);
          if (parentId !== null) {
            syncViewports(frameId, parentId);
          }
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

                // Find the index of the target node among its siblings
                const parentId = getNodeParent(node.id);
                if (parentId !== null) {
                  const siblings = childrenIds;
                  const targetIndex = siblings.indexOf(node.id);

                  // Insert at the target index
                  if (targetIndex !== -1) {
                    insertAtIndex(id, parentId, targetIndex);
                  }
                }
              } else {
                const prevId = selectedIds[index - 1];
                console.log(
                  "DROP-MULTI-BEFORE: Moving next node",
                  id,
                  "after",
                  prevId
                );

                // Find the index of the previous node among its siblings
                const parentId = getNodeParent(prevId);
                if (parentId !== null) {
                  const siblings = childrenIds;
                  const prevIndex = siblings.indexOf(prevId);

                  // Insert after the previous node
                  if (prevIndex !== -1) {
                    insertAtIndex(id, parentId, prevIndex + 1);
                  }
                }
              }
            });
          } else {
            console.log(
              "DROP-BEFORE: Moving single node",
              draggedNode.id,
              "before",
              node.id
            );

            // Find the index of the target node among its siblings
            const parentId = getNodeParent(node.id);
            if (parentId !== null) {
              const siblings = childrenIds;
              const targetIndex = siblings.indexOf(node.id);

              // Insert at the target index
              if (targetIndex !== -1) {
                insertAtIndex(draggedNode.id, parentId, targetIndex);
              }
            }
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

                // Find the index of the target node among its siblings
                const parentId = getNodeParent(node.id);
                if (parentId !== null) {
                  const siblings = childrenIds;
                  const targetIndex = siblings.indexOf(node.id);

                  // Insert after the target node
                  if (targetIndex !== -1) {
                    insertAtIndex(id, parentId, targetIndex + 1);
                  }
                }
              } else {
                const prevId = selectedIds[index - 1];
                console.log(
                  "DROP-MULTI-AFTER: Moving next node",
                  id,
                  "after",
                  prevId
                );

                // Find the index of the previous node among its siblings
                const parentId = getNodeParent(prevId);
                if (parentId !== null) {
                  const siblings = childrenIds;
                  const prevIndex = siblings.indexOf(prevId);

                  // Insert after the previous node
                  if (prevIndex !== -1) {
                    insertAtIndex(id, parentId, prevIndex + 1);
                  }
                }
              }
            });
          } else {
            console.log(
              "DROP-AFTER: Moving single node",
              draggedNode.id,
              "after",
              node.id
            );

            // Find the index of the target node among its siblings
            const parentId = getNodeParent(node.id);
            if (parentId !== null) {
              const siblings = childrenIds;
              const targetIndex = siblings.indexOf(node.id);

              // Insert after the target node
              if (targetIndex !== -1) {
                insertAtIndex(draggedNode.id, parentId, targetIndex + 1);
              }
            }
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
          if (getNodeFlags(node.id).isViewport) {
            console.log(
              "DROP-INSIDE-BLOCKED: Cannot drop anything inside a viewport"
            );
            break;
          }

          if (
            getNodeBasics(node.id).type === "frame" ||
            getNodeBasics(node.id).type === "image" ||
            getNodeBasics(node.id).type === "video"
          ) {
            if (isMultiSelectionDrag) {
              // Make sure no viewports are in the selection before proceeding
              const hasViewports = selectedIds.some((id) => {
                const nodeFlags = getNodeFlags(id);
                return nodeFlags.isViewport;
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

                  // Insert as first child
                  moveNode(id, node.id);
                } else {
                  const prevId = selectedIds[index - 1];
                  console.log(
                    "DROP-MULTI-INSIDE: Moving next node",
                    id,
                    "after",
                    prevId
                  );

                  // Find the index of the previous node among its siblings
                  const parentId = getNodeParent(prevId);
                  if (parentId !== null) {
                    const siblings = childrenIds;
                    const prevIndex = siblings.indexOf(prevId);

                    // Insert after the previous node
                    if (prevIndex !== -1) {
                      insertAtIndex(id, parentId, prevIndex + 1);
                    } else {
                      // Fallback to just adding as a child
                      moveNode(id, node.id);
                    }
                  }
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

              // Add as a child
              moveNode(draggedNode.id, node.id);

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
        updateNodeStyle(id, {
          position: "relative",
          zIndex: "",
          transform: "",
          left: "",
          top: "",
        });
      });

      setTimeout(() => {
        // Find the viewport of the target node
        const allNodesArray = getCurrentNodes();
        const nodeState = { nodes: allNodesArray };
        const targetViewport = getNodeViewport(node.id, nodeState);

        if (targetViewport) {
          const viewportFlags = getNodeFlags(targetViewport);

          if (viewportFlags.viewportWidth !== 1440) {
            // If we're in a non-desktop viewport, sync FROM this viewport
            console.log(
              `Syncing from viewport: ${
                viewportFlags.viewportName || targetViewport
              }`
            );

            // // Use syncFromViewport for non-desktop viewports
            // syncFromViewport(targetViewport);
          } else {
            // Default case: sync from desktop to all viewports
            console.log("Syncing from desktop to all viewports");

            // For desktop viewport, use standard syncViewports
            nodesToUpdate.forEach((id) => {
              const parentId = getNodeParent(id);
              if (parentId !== null) {
                syncViewports(id, parentId);
              }
            });
          }
        }

        // Make sure we're selecting the dragged node to complete the operation
        selectNode(draggedNode.id);
      }, 10);
    } catch (error) {
      console.error("DROP-ERROR: Error handling drop:", error);
    }
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();

    // First select the node if it's not already selected
    if (!isSelected) {
      selectNode(node.id);
    }

    // Toggle the lock state directly with updateNodeFlags
    const flags = getNodeFlags(node.id);
    updateNodeFlags(node.id, { isLocked: !flags.isLocked });
  };

  // Get required node data
  const basics = getNodeBasics(node.id);
  const flags = getNodeFlags(node.id);

  return (
    <li className="relative select-none list-none">
      <div
        ref={nodeRef}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        draggable={!isEditing && !flags.isViewport}
        onDragStart={!flags.isViewport ? handleDragStart : undefined}
        onDragEnd={!flags.isViewport ? handleDragEnd : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          `group flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-md)] transition-colors duration-150`,
          "cursor-pointer",
          flags.isViewport && "cursor-default", // Change cursor for viewports
          !isSelected && " hover:bg-[var(--bg-hover)]",
          isSelected &&
            `${
              flags.isDynamic ||
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
          <span
            className={cn(
              "text-[var(--text-secondary)]",
              isSelected && "text-white"
            )}
          >
            {flags.isViewport ? (
              // Use viewport width to determine which icon to show
              flags.viewportWidth! >= 768 ? (
                <Monitor
                  className={`w-4 h-4 ${
                    isSelected ? "text-white" : "text-[var(--accent)]"
                  }`}
                />
              ) : flags.viewportWidth! >= 376 ? (
                <Tablet
                  className={`w-4 h-4 ${
                    isSelected ? "text-white" : "text-[var(--accent)]"
                  }`}
                />
              ) : (
                <Smartphone
                  className={`w-4 h-4 ${
                    isSelected ? "text-white" : "text-[var(--accent)]"
                  }`}
                />
              )
            ) : (
              // Pass the entire node object to getElementIcon
              getElementIcon(basics.type, isSelected, {
                ...basics,
                ...flags,
                parentId: getNodeParent(node.id),
              })
            )}
          </span>
        </span>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={customName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onSelect={() => canvasOps.setIsEditingText(true)}
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

        {flags.isLocked && (
          <button
            onClick={handleToggleLock}
            className={cn(
              "w-3.5 h-3.5 flex items-center justify-center mr-1",
              !flags.isLocked
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-100",
              "transition-opacity",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              isSelected && "text-white"
            )}
            title={flags.isLocked ? "Unlock element" : "Lock element"}
          >
            {flags.isLocked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {/* Hide visibility toggle for viewports */}
        {!flags.isViewport && (
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
          {childrenIds.map((childId) => (
            <TreeNodeComponent
              key={childId}
              node={{
                id: childId,
                type: getNodeBasics(childId).type,
                customName: getNodeBasics(childId).customName,
                style: getNodeStyle(childId),
                isViewport: getNodeFlags(childId).isViewport,
                viewportWidth: getNodeFlags(childId).viewportWidth,
                inViewport: getNodeFlags(childId).inViewport,
                isDynamic: getNodeFlags(childId).isDynamic,
                isVariant: getNodeFlags(childId).isVariant,
                isLocked: getNodeFlags(childId).isLocked,
                parentId: getNodeParent(childId),
                dynamicParentId: getNodeDynamicInfo(childId).dynamicParentId,
                children: [], // Children will be fetched by the child component
              }}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default TreeNodeComponent;
