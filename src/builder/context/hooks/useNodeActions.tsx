// useNodeActions.ts
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { nanoid } from "nanoid";
import { findIndexWithinParent } from "../utils";
import { selectOps, useGetSelectedIds } from "../atoms/select-store";

export const useNodeActions = () => {
  const { dragState, nodeState, dragDisp, nodeDisp, transform, containerRef } =
    useBuilder();

  const currentSelectedIds = useGetSelectedIds();

  const { clearSelection, addToSelection, selectNode } = selectOps;

  const STORAGE_KEY = "builder_clipboard";

  // Helper to collect all child nodes recursively
  const getAllChildNodes = (nodeId: string, nodes: Node[]): Node[] => {
    const directChildren = nodes.filter((n) => n.parentId === nodeId);
    let allChildren: Node[] = [...directChildren];

    directChildren.forEach((child) => {
      const childrenOfChild = getAllChildNodes(child.id, nodes);
      allChildren = [...allChildren, ...childrenOfChild];
    });

    return allChildren;
  };

  // Clone node helper
  const cloneNode = (
    originalNode: Node,
    existingNodes: Node[],
    cloneMap: Map<string, Node> = new Map()
  ): { rootClone: Node; allClones: Node[] } => {
    const newId = nanoid();
    const newSharedId = originalNode.sharedId ? nanoid() : undefined;

    const clone: Node = {
      ...originalNode,
      id: newId,
      sharedId: newSharedId,
      style: { ...originalNode.style },
      parentId: originalNode.parentId,
      inViewport: originalNode.inViewport,
    };

    cloneMap.set(originalNode.id, clone);
    const allClones: Node[] = [clone];

    const childNodes = existingNodes.filter(
      (n) => n.parentId === originalNode.id
    );
    if (childNodes.length > 0) {
      childNodes.forEach((child) => {
        const { rootClone: clonedChild, allClones: childClones } = cloneNode(
          child,
          existingNodes,
          cloneMap
        );
        clonedChild.parentId = newId;
        allClones.push(...childClones);
      });
    }

    return { rootClone: clone, allClones };
  };

  // Copy dimensions helper
  const copyDimensions = (originalNode: Node, clonedNode: Node) => {
    const originalDimensions = dragState.nodeDimensions[originalNode.id];
    if (originalDimensions) {
      dragDisp.setNodeDimensions(clonedNode.id, {
        ...originalDimensions,
        width: originalDimensions.finalWidth,
        height: originalDimensions.finalHeight,
        finalWidth: originalDimensions.finalWidth,
        finalHeight: originalDimensions.finalHeight,
        isFillMode: false,
      });
    }
  };

  // Delete nodes action
  const handleDelete = () => {
    const selectedIds = currentSelectedIds();

    if (!selectedIds?.length) return;

    const nodesToRemove = new Set<string | number>();

    // Step 1: First collect all nodes to be deleted (selected nodes and their children)
    selectedIds.forEach((nodeId) => {
      const node = nodeState.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      nodesToRemove.add(nodeId);

      // For each node, also collect all its children recursively
      const children = getAllChildNodes(nodeId, nodeState.nodes);
      children.forEach((child) => nodesToRemove.add(child.id));
    });

    // NEW: Check if we're in dynamic mode - if so, skip the shared ID lookup
    const isInDynamicMode = !!dragState.dynamicModeNodeId;

    // Step 2: Check if any nodes are in viewports and not in dynamic mode
    const nodesInViewport =
      !isInDynamicMode &&
      Array.from(nodesToRemove).some((id) => {
        const node = nodeState.nodes.find((n) => n.id === id);
        return node?.inViewport;
      });

    // Step 3: Collect all shared IDs for nodes in viewports (skip if in dynamic mode)
    const sharedIdsToRemove = new Set<string>();

    if (nodesInViewport && !isInDynamicMode) {
      Array.from(nodesToRemove).forEach((id) => {
        const node = nodeState.nodes.find((n) => n.id === id);
        if (node?.sharedId) {
          sharedIdsToRemove.add(node.sharedId);
        }
      });
    }

    // Step 4: Find all nodes with the same shared IDs across viewports (skip if in dynamic mode)
    if (sharedIdsToRemove.size > 0 && !isInDynamicMode) {
      nodeState.nodes.forEach((node) => {
        if (node.sharedId && sharedIdsToRemove.has(node.sharedId)) {
          nodesToRemove.add(node.id);

          // Also add children of these shared nodes
          const children = getAllChildNodes(node.id, nodeState.nodes);
          children.forEach((child) => nodesToRemove.add(child.id));
        }
      });
    }

    // Step 5: Actually delete the nodes
    // Remove children first to avoid orphaned nodes
    const allNodes = [...nodeState.nodes];
    const nodeIds = Array.from(nodesToRemove);

    // Sort nodes so that children are removed before parents
    nodeIds.sort((idA, idB) => {
      const nodeA = allNodes.find((n) => n.id === idA);
      const nodeB = allNodes.find((n) => n.id === idB);

      if (!nodeA || !nodeB) return 0;

      // If B is a child of A, remove B first
      if (nodeB.parentId === nodeA.id) return 1;
      // If A is a child of B, remove A first
      if (nodeA.parentId === nodeB.id) return -1;

      return 0;
    });

    // Now remove the nodes in the correct order
    nodeIds.forEach((id) => {
      console.log(`Removing node ${id}`);
      nodeDisp.removeNode(id);
    });

    // Clear selection
    dragDisp.clearSelection();
  };

  // Duplicate nodes action
  const findTopmostParentInDynamicFamily = (node: Node) => {
    // If not in dynamic mode, return null
    if (!dragState.dynamicModeNodeId) return null;

    // Get the dynamic family ID
    const familyNode = nodeState.nodes.find(
      (n) => n.id === dragState.dynamicModeNodeId
    );
    const familyId = familyNode?.dynamicFamilyId;
    if (!familyId) return null;

    // First check if current node is already a top-level node in this family
    if (
      (node.isDynamic || node.isVariant) &&
      node.dynamicFamilyId === familyId &&
      !node.parentId
    ) {
      return node;
    }

    // Find which top-level node contains this element
    const topLevelNodes = nodeState.nodes.filter(
      (n) =>
        (n.isDynamic || n.isVariant) &&
        n.dynamicFamilyId === familyId &&
        !n.parentId
    );

    // Check if node is a descendant of any top-level node
    for (const topNode of topLevelNodes) {
      if (isDescendantOf(node.id, topNode.id, nodeState.nodes)) {
        return topNode;
      }
    }

    return null;
  };

  // Helper to check if a node is a descendant of another
  const isDescendantOf = (
    childId: string | number,
    parentId: string | number,
    nodes: Node[]
  ) => {
    const child = nodes.find((n) => n.id === childId);
    if (!child) return false;
    if (child.parentId === parentId) return true;
    if (child.parentId) return isDescendantOf(child.parentId, parentId, nodes);
    return false;
  };

  // Updated handleDuplicate function that handles dynamic mode
  const handleDuplicate = (fromContextMenu = false) => {
    try {
      // When duplicating from context menu, use selected nodes
      // When duplicating from drag, use dragged nodes
      let nodesToDuplicate: Node[] = [];

      const selectedIds = currentSelectedIds();

      if (fromContextMenu) {
        nodesToDuplicate = selectedIds
          .map((id) => nodeState.nodes.find((n) => n.id === id))
          .filter((n): n is Node => n !== undefined);
      } else {
        if (!dragState.isDragging || !dragState.draggedNode) return;
        nodesToDuplicate = [dragState.draggedNode.node];
        if (dragState.additionalDraggedNodes) {
          nodesToDuplicate.push(
            ...dragState.additionalDraggedNodes.map((info) => info.node)
          );
        }
      }

      if (nodesToDuplicate.length === 0) return;
      const mainNode = nodesToDuplicate[0];

      // Check if we're in dynamic mode
      const isInDynamicMode = !!dragState.dynamicModeNodeId;

      // CASE 1: Duplicating a dynamic element in normal canvas mode (not in dynamic mode)
      // We'll do this regardless of fromContextMenu
      if (!isInDynamicMode && mainNode.isDynamic) {
        console.log("Duplicating dynamic element in normal canvas mode");

        // Use a specialized function for duplicating dynamic elements
        // This is completely separate from the normal duplication process
        const newTopNodeId = duplicateDynamicElement(mainNode.id);

        if (newTopNodeId) {
          // Select the new element after creation
          setTimeout(() => {
            clearSelection();
            addToSelection(newTopNodeId);
          }, 0);
        }
        return; // Exit early to avoid double processing
      }
      // CASE 2: Duplicating in dynamic mode
      else if (isInDynamicMode) {
        // Check if we should use dynamic duplication by finding topmost parent
        const topmostParent = findTopmostParentInDynamicFamily(mainNode);
        const isTopLevelDynamicNode =
          topmostParent && topmostParent.id === mainNode.id;

        if (isTopLevelDynamicNode) {
          // We're duplicating a top-level dynamic node, use duplicateDynamicElement
          const nodeDimensions = dragState.nodeDimensions[topmostParent.id];
          const nodeWidth =
            nodeDimensions?.width ||
            parseFloat(topmostParent.style.width as string) ||
            300;

          const direction = "right";
          const newVariantId = nodeDisp.duplicateDynamicElement(
            topmostParent.id,
            nodeWidth,
            direction
          );

          if (newVariantId) {
            setTimeout(() => {
              selectNode(newVariantId);
            }, 1);
          }
        } else {
          // Not a top-level dynamic node, use regular duplication
          if (mainNode.inViewport || mainNode.parentId) {
            console.log("isthis?");
            handleViewportDuplication(nodesToDuplicate, fromContextMenu);
          } else {
            if (fromContextMenu) {
              handleContextMenuCanvasDuplication(nodesToDuplicate);
            } else {
              console.log("isthis2?");
              handleCanvasDuplication(mainNode);
            }
          }
        }
      }
      // CASE 3: Normal duplication (non-dynamic elements outside dynamic mode)
      else {
        if (mainNode.inViewport || mainNode.parentId) {
          handleViewportDuplication(nodesToDuplicate, fromContextMenu);
        } else {
          if (fromContextMenu) {
            handleContextMenuCanvasDuplication(nodesToDuplicate);
          } else {
            handleCanvasDuplication(mainNode);
          }
        }
      }

      dragDisp.setDuplicatedFromAlt(true);
      setTimeout(() => {
        dragDisp.setDuplicatedFromAlt(false);
      }, 0);
    } catch (error) {
      console.error("Error during duplication:", error);
    }
  };

  function duplicateDynamicElement(sourceNodeId) {
    // Find the source node
    const sourceNode = nodeState.nodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode || !sourceNode.isDynamic) return null;

    console.log("Starting duplication of dynamic element:", sourceNodeId);

    // 1. IDENTIFY THE FAMILY AND ENSURE UNIQUENESS
    const originalFamilyId = sourceNode.dynamicFamilyId;
    const newFamilyId = nanoid();

    // 2. GATHER ALL RELATED NODES
    // First get all nodes with the family ID
    const familyNodes = nodeState.nodes.filter(
      (n) => n.dynamicFamilyId === originalFamilyId
    );

    // Find all nodes that are children of family nodes
    const familyNodeIds = familyNodes.map((n) => n.id);
    const childNodes = [];

    // IMPROVED: More robust child node detection
    const findAllChildren = (parentIds) => {
      // Look for direct children of any parent in parentIds
      const directChildren = nodeState.nodes.filter((n) =>
        parentIds.includes(n.parentId)
      );

      // Add these children to our collection if they're not already in the family nodes
      directChildren.forEach((child) => {
        if (
          !familyNodes.some((fn) => fn.id === child.id) &&
          !childNodes.some((cn) => cn.id === child.id)
        ) {
          childNodes.push(child);
          console.log(
            `Found child node: ${child.id}, type: ${child.type}, parent: ${child.parentId}`
          );
        }
      });

      // Recursively find children of these children
      if (directChildren.length > 0) {
        findAllChildren(directChildren.map((c) => c.id));
      }
    };

    // Start the recursive search
    findAllChildren(familyNodeIds);

    // Combine all nodes to duplicate
    const allFamilyNodes = [...familyNodes, ...childNodes];

    // Quick check if there are any nodes to duplicate
    if (allFamilyNodes.length === 0) {
      console.warn("No nodes found to duplicate");
      return null;
    }

    // Log more information about what we found
    console.log(
      "Family nodes:",
      familyNodes.map((n) => `${n.id} (${n.type})`).join(", ")
    );
    console.log(
      "Child nodes:",
      childNodes
        .map((n) => `${n.id} (${n.type}), parent: ${n.parentId}`)
        .join(", ")
    );

    // Check if this is a dynamic element with no variants
    const hasVariants = allFamilyNodes.some((n) => n.isVariant);
    console.log(
      `Found ${familyNodes.length} family nodes and ${childNodes.length} child nodes. Has variants: ${hasVariants}`
    );

    // 3. CREATE ID MAPPINGS
    const idMap = new Map(); // old ID -> new ID
    const sharedIdMap = new Map(); // old sharedId -> new sharedId
    const variantRespIdMap = new Map(); // old variantResponseId -> new variantResponseId
    const variantInfoIdMap = new Map(); // old variantInfo.id -> new variantInfo.id

    // First pass: Generate new unique IDs for all relevant properties
    allFamilyNodes.forEach((node) => {
      // Create new unique ID for each node
      idMap.set(node.id, nanoid());

      // Map sharedIds (same old ID gets same new ID)
      if (node.sharedId && !sharedIdMap.has(node.sharedId)) {
        sharedIdMap.set(node.sharedId, nanoid());
      }

      // Map variantResponsiveIds (same old ID gets same new ID)
      if (
        node.variantResponsiveId &&
        !variantRespIdMap.has(node.variantResponsiveId)
      ) {
        variantRespIdMap.set(node.variantResponsiveId, nanoid());
      }

      // Map variantInfo.id values (same old ID gets same new ID)
      if (node.variantInfo?.id && !variantInfoIdMap.has(node.variantInfo.id)) {
        variantInfoIdMap.set(
          node.variantInfo.id,
          `variant-${Math.floor(Math.random() * 10000)}`
        );
      }
    });

    // 4. CREATE DUPLICATED NODES WITH UPDATED IDs
    const newNodes = [];

    // Create a map to track relationships between original and new nodes
    const originalToNewMap = new Map();

    allFamilyNodes.forEach((originalNode) => {
      // Deep clone the node
      const newNode = JSON.parse(JSON.stringify(originalNode));

      // Set new node ID
      newNode.id = idMap.get(originalNode.id);

      // Store mapping for later reference
      originalToNewMap.set(originalNode.id, newNode);

      // Update family ID if applicable
      if (originalNode.dynamicFamilyId === originalFamilyId) {
        newNode.dynamicFamilyId = newFamilyId;
      }

      // Update sharedId if present
      if (originalNode.sharedId && sharedIdMap.has(originalNode.sharedId)) {
        newNode.sharedId = sharedIdMap.get(originalNode.sharedId);
      }

      // Update variantResponsiveId if present
      if (
        originalNode.variantResponsiveId &&
        variantRespIdMap.has(originalNode.variantResponsiveId)
      ) {
        newNode.variantResponsiveId = variantRespIdMap.get(
          originalNode.variantResponsiveId
        );
      }

      // Update variantInfo.id if present
      if (
        originalNode.variantInfo?.id &&
        variantInfoIdMap.has(originalNode.variantInfo.id)
      ) {
        newNode.variantInfo = {
          ...originalNode.variantInfo,
          id: variantInfoIdMap.get(originalNode.variantInfo.id),
        };
      }

      // FIX: Only adjust position for canvas mode, not for normal mode
      // Check if we're in canvas mode (node has position property)
      if (originalNode.id === sourceNodeId && originalNode.position) {
        // Only update position for canvas mode, not for normal mode
        newNode.position = {
          x: originalNode.position.x + 500,
          y: originalNode.position.y,
        };

        // Don't modify the style.left property in normal mode
        // This ensures we don't add a 'left: 500px' when duplicating in normal mode
      }

      // Store the original node's ID and type for reference in the second pass
      newNode._originalId = originalNode.id;
      newNode._originalParentId = originalNode.parentId;
      newNode._isVariant = originalNode.isVariant === true;
      newNode._isDynamic = originalNode.isDynamic === true;

      // CRITICAL: Ensure dynamic nodes are visible in all viewports
      if (originalNode.isDynamic) {
        newNode.inViewport = true;
        if (newNode.originalState) {
          newNode.originalState.inViewport = true;
        }
      }

      // Update dynamicParentId reference
      if (
        originalNode.dynamicParentId &&
        idMap.has(originalNode.dynamicParentId)
      ) {
        newNode.dynamicParentId = idMap.get(originalNode.dynamicParentId);
      }

      // Update variantParentId reference
      if (
        originalNode.variantParentId &&
        idMap.has(originalNode.variantParentId)
      ) {
        newNode.variantParentId = idMap.get(originalNode.variantParentId);
      }

      // ADDED: Update dynamicConnections references if present
      // We'll store the original connections but not update them yet
      // since we need all nodes to be created first
      if (
        originalNode.dynamicConnections &&
        originalNode.dynamicConnections.length > 0
      ) {
        newNode._originalDynamicConnections = originalNode.dynamicConnections;
      }

      newNodes.push(newNode);
    });

    // Special case for dynamic elements with no variants
    if (!hasVariants) {
      // Create a mapping of original node IDs to new node IDs for parent reassignment
      const originalToNewIdMap = new Map();
      newNodes.forEach((newNode) => {
        if (newNode._originalId) {
          originalToNewIdMap.set(newNode._originalId, newNode.id);
        }
      });

      // Fix parent-child relationships for all nodes
      newNodes.forEach((newNode) => {
        // If this node has a parent that was duplicated, update the reference
        if (
          newNode._originalParentId &&
          originalToNewIdMap.has(newNode._originalParentId)
        ) {
          newNode.parentId = originalToNewIdMap.get(newNode._originalParentId);
          console.log(
            `Updated node ${newNode.id} to have parent ${newNode.parentId}`
          );
        }

        // Fix dynamicParentId references too
        if (newNode.dynamicParentId) {
          const originalDynamicParentId = Object.keys(idMap).find(
            (key) => idMap[key] === newNode.dynamicParentId
          );
          if (
            originalDynamicParentId &&
            originalToNewIdMap.has(originalDynamicParentId)
          ) {
            newNode.dynamicParentId = originalToNewIdMap.get(
              originalDynamicParentId
            );
          }
        }

        // Handle original dynamicConnections as before
        if (newNode._originalDynamicConnections) {
          newNode.dynamicConnections = newNode._originalDynamicConnections.map(
            (conn) => {
              const newConn = { ...conn };
              // Map source ID if it's in our idMap
              if (idMap.has(conn.sourceId)) {
                newConn.sourceId = idMap.get(conn.sourceId);
              }
              // Map target ID if it's in our idMap
              if (idMap.has(conn.targetId)) {
                newConn.targetId = idMap.get(conn.targetId);
              }
              return newConn;
            }
          );

          // Remove the temporary property
          delete newNode._originalDynamicConnections;
        }
      });
    } else {
      // 5. CREATE LOOKUP MAP FOR VARIANT CHILDREN
      const variantChildMap = new Map();

      // Identify which nodes are children of variants in the original tree
      allFamilyNodes.forEach((originalNode) => {
        if (originalNode.parentId) {
          const parent = allFamilyNodes.find(
            (n) => n.id === originalNode.parentId
          );
          if (parent && parent.isVariant) {
            variantChildMap.set(originalNode.id, parent.id);
          }
        }
      });

      // Create a map to track child-parent relationships
      const childParentMap = new Map();

      // Build child-parent relationships from original tree
      allFamilyNodes.forEach((node) => {
        if (node.parentId) {
          childParentMap.set(node.id, node.parentId);
        }
      });

      // 6. SECOND PASS: SET PARENT-CHILD RELATIONSHIPS
      newNodes.forEach((newNode) => {
        // CRITICAL FIX: For variants, always set parentId to null
        if (newNode._isVariant) {
          newNode.parentId = null;
        }
        // For dynamic nodes: preserve original parentId if it's not a viewport
        else if (newNode._isDynamic) {
          // If original had a parent that wasn't a viewport, preserve that relationship
          if (
            newNode._originalParentId &&
            !newNode._originalParentId.includes("viewport")
          ) {
            // Map the old parent ID to the new one if it's in our mapping
            if (idMap.has(newNode._originalParentId)) {
              newNode.parentId = idMap.get(newNode._originalParentId);
            } else {
              // If parent wasn't duplicated, keep the original parent
              newNode.parentId = newNode._originalParentId;
            }
          } else {
            // Only use viewport as direct parent if the original was a direct child of viewport
            newNode.parentId = newNode.dynamicViewportId;
          }
        }
        // For children nodes with parents in our mapping
        else if (
          newNode._originalParentId &&
          idMap.has(newNode._originalParentId)
        ) {
          newNode.parentId = idMap.get(newNode._originalParentId);
        }

        // Special handling for variant children
        if (variantChildMap.has(newNode._originalId)) {
          const originalVariantParentId = variantChildMap.get(
            newNode._originalId
          );
          if (idMap.has(originalVariantParentId)) {
            newNode.parentId = idMap.get(originalVariantParentId);
          }
        }

        // CRITICAL FIX: For child elements (especially text nodes), make sure that
        // if they are children of a dynamic element, they stay as children of the NEW dynamic element
        const originalNode = originalToNewMap.get(newNode._originalId);
        if (
          originalNode &&
          (originalNode.type === "text" || !originalNode.isDynamic)
        ) {
          // If this is a text node or any other child element, it needs to follow its parent
          const originalParentId = childParentMap.get(newNode._originalId);
          if (originalParentId && idMap.has(originalParentId)) {
            // Make sure this node is assigned to the new parent, not the original
            newNode.parentId = idMap.get(originalParentId);

            // Also update dynamicParentId if needed
            if (newNode.dynamicParentId && idMap.has(newNode.dynamicParentId)) {
              newNode.dynamicParentId = idMap.get(newNode.dynamicParentId);
            }
          }
        }

        // ADDED: Update dynamicConnections with properly mapped IDs
        if (newNode._originalDynamicConnections) {
          newNode.dynamicConnections = newNode._originalDynamicConnections.map(
            (conn) => {
              const newConn = { ...conn };
              // Map source ID if it's in our idMap
              if (idMap.has(conn.sourceId)) {
                newConn.sourceId = idMap.get(conn.sourceId);
              }
              // Map target ID if it's in our idMap
              if (idMap.has(conn.targetId)) {
                newConn.targetId = idMap.get(conn.targetId);
              }
              return newConn;
            }
          );

          // Remove the temporary property
          delete newNode._originalDynamicConnections;
        }
      });
    }

    // Final pass: Fix any misaligned parent-child relationships
    // This ensures all child elements are correctly assigned to their new parent nodes, not the original ones
    const originalIdToNewIdMap = new Map();

    // Build a reverse mapping from original ID to new ID for easier lookup
    newNodes.forEach((node) => {
      if (node._originalId) {
        originalIdToNewIdMap.set(node._originalId, node.id);
      }
    });

    // Now fix any parent relationships
    newNodes.forEach((node) => {
      // Skip nodes without original parent IDs
      if (!node._originalParentId) return;

      // If we have a mapping for this parent, use the new parent ID
      if (originalIdToNewIdMap.has(node._originalParentId)) {
        // Update to the new parent ID
        node.parentId = originalIdToNewIdMap.get(node._originalParentId);

        // Also ensure dynamicParentId is consistent if it exists
        if (
          node.dynamicParentId &&
          originalIdToNewIdMap.has(node._originalParentId)
        ) {
          const originalDynamicParent = allFamilyNodes.find(
            (n) => n.id === node._originalParentId
          );
          if (originalDynamicParent && originalDynamicParent.isDynamic) {
            node.dynamicParentId = node.parentId;
          }
        }

        console.log(`Fixed node ${node.id} to have parent ${node.parentId}`);
      }
    });

    // Track insertion indices for each viewport to maintain ordering consistency
    const viewportInsertionIndices = new Map();

    // Determine insertion index for primary viewport (the one containing source node)
    const sourceParentId = sourceNode.parentId;
    if (sourceParentId) {
      // Get the source node's index within its parent
      const siblingsInParent = nodeState.nodes.filter(
        (n) => n.parentId === sourceParentId
      );
      const sourceNodeIndex = siblingsInParent.findIndex(
        (n) => n.id === sourceNodeId
      );

      // We want to insert right after the source node
      const insertionIndex = sourceNodeIndex + 1;

      // Store this index for the primary viewport
      viewportInsertionIndices.set(sourceNode.dynamicViewportId, {
        parentId: sourceParentId,
        index: insertionIndex,
      });

      // For other viewports, find corresponding nodes and determine their indices
      if (familyNodes.length > 1) {
        // Get other instances of this dynamic element across viewports
        const otherViewportInstances = familyNodes.filter(
          (n) => n.id !== sourceNodeId && n.sharedId === sourceNode.sharedId
        );

        // For each instance, determine its position among siblings
        otherViewportInstances.forEach((instance) => {
          if (instance.parentId) {
            const viewportSiblings = nodeState.nodes.filter(
              (n) => n.parentId === instance.parentId
            );
            const instanceIndex = viewportSiblings.findIndex(
              (n) => n.id === instance.id
            );

            if (instanceIndex !== -1) {
              // Store insertion info for this viewport
              viewportInsertionIndices.set(instance.dynamicViewportId, {
                parentId: instance.parentId,
                index: instanceIndex + 1, // Insert after this instance
              });
            }
          }
        });
      }
    }

    // Clean up temporary properties
    newNodes.forEach((node) => {
      delete node._originalId;
      delete node._originalParentId;
      delete node._isVariant;
      delete node._isDynamic;
    });

    // Insert nodes with proper ordering across all viewports
    if (viewportInsertionIndices.size > 0) {
      // Group nodes by their target viewport
      const nodesByViewport = new Map();

      newNodes.forEach((node) => {
        if (!node.dynamicViewportId) return;

        if (!nodesByViewport.has(node.dynamicViewportId)) {
          nodesByViewport.set(node.dynamicViewportId, []);
        }
        nodesByViewport.get(node.dynamicViewportId).push(node);
      });

      // Insert nodes viewport by viewport, maintaining correct ordering
      for (const [
        viewportId,
        insertionInfo,
      ] of viewportInsertionIndices.entries()) {
        const nodesForViewport = nodesByViewport.get(viewportId) || [];

        // Find the primary dynamic node for this viewport
        const primaryNode = nodesForViewport.find(
          (n) =>
            n.isDynamic && !n.isVariant && n.dynamicViewportId === viewportId
        );

        if (primaryNode) {
          // Insert the primary node first at the correct position
          nodeDisp.insertAtIndex(
            primaryNode,
            insertionInfo.index,
            insertionInfo.parentId
          );

          // Then insert all other nodes for this viewport
          const otherNodes = nodesForViewport.filter(
            (n) => n.id !== primaryNode.id
          );
          if (otherNodes.length > 0) {
            nodeDisp.pushNodes(otherNodes);
          }
        }
      }

      // Handle any remaining nodes that weren't explicitly placed
      const handledViewports = Array.from(viewportInsertionIndices.keys());
      const remainingNodes = newNodes.filter(
        (node) =>
          !node.dynamicViewportId ||
          !handledViewports.includes(node.dynamicViewportId)
      );

      if (remainingNodes.length > 0) {
        nodeDisp.pushNodes(remainingNodes);
      }
    } else {
      // Fall back to default behavior if we couldn't determine specific insertion indices
      nodeDisp.pushNodes(newNodes);
    }

    console.log(
      `Successfully duplicated ${newNodes.length} nodes with family ID ${newFamilyId}`
    );

    // Return the ID of the duplicated source node
    return idMap.get(sourceNodeId);
  }

  const handleContextMenuCanvasDuplication = (nodesToDuplicate: Node[]) => {
    const allClonedNodesByNode = new Map<string, Node[]>();
    const rootClonedNodes = new Map<string, Node>();
    let firstDuplicateId = null;

    // Clone all selected nodes
    nodesToDuplicate.forEach((node) => {
      const { rootClone, allClones } = cloneNode(node, nodeState.nodes);
      allClonedNodesByNode.set(node.id, allClones);
      rootClonedNodes.set(node.id, rootClone);

      // Store the first duplicate ID
      if (!firstDuplicateId) {
        firstDuplicateId = rootClone.id;
      }

      // Get the original node's dimensions
      const dimensions = dragState.nodeDimensions[node.id];
      const nodeWidth = dimensions?.width || 0;

      // Position the clone to the right of the original
      const originalLeft = parseFloat(node.style.left as string) || 0;
      const originalTop = parseFloat(node.style.top as string) || 0;

      const originalWidth = parseFloat(node.style.width as string) || 0;

      rootClone.style = {
        ...rootClone.style,
        position: "absolute",
        left: `${originalLeft + originalWidth + 50}px`,
        top: `${originalTop}px`,
      };
    });

    // Insert all cloned nodes
    for (const [originalNodeId, rootClone] of rootClonedNodes.entries()) {
      const allClones = allClonedNodesByNode.get(originalNodeId) || [];

      nodeDisp.insertAtIndex(rootClone, 0, null, dragState);

      const originalNode = nodeState.nodes.find((n) => n.id === originalNodeId);
      if (originalNode) {
        copyDimensions(originalNode, rootClone);
      }

      // Handle children
      const childClones = allClones.filter(
        (clone) => clone.id !== rootClone.id
      );
      for (const childClone of childClones) {
        nodeDisp.insertAtIndex(childClone, 0, childClone.parentId, dragState);

        const originalChildren = getAllChildNodes(
          originalNodeId,
          nodeState.nodes
        );
        const originalChild = originalChildren.find(
          (n) => n.parentId === originalNode?.id && n.type === childClone.type
        );

        if (originalChild) {
          copyDimensions(originalChild, childClone);
        }
      }
    }

    return firstDuplicateId;
  };

  // Canvas duplication helper
  const handleCanvasDuplication = (mainNode: Node) => {
    const mainDragPreview = document.querySelector(
      `[data-node-dragged="${mainNode.id}"]`
    );
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (!mainDragPreview || !containerRect) return;

    // Calculate positions and create clones
    const mainRect = mainDragPreview.getBoundingClientRect();
    const mainX =
      (mainRect.left - containerRect.left - transform.x) / transform.scale;
    const mainY =
      (mainRect.top - containerRect.top - transform.y) / transform.scale;

    const allClonedNodesByNode = new Map<string, Node[]>();
    const rootClonedNodes = new Map<string, Node>();

    const { rootClone: mainClone, allClones: mainAllClones } = cloneNode(
      mainNode,
      nodeState.nodes
    );
    allClonedNodesByNode.set(mainNode.id, mainAllClones);
    rootClonedNodes.set(mainNode.id, mainClone);

    mainClone.style = {
      ...mainClone.style,
      position: "absolute",
      left: `${mainX}px`,
      top: `${mainY}px`,
    };

    // Handle additional selected nodes
    if (dragState.additionalDraggedNodes?.length) {
      dragState.additionalDraggedNodes.forEach((info) => {
        const additionalNode = info.node;
        const { rootClone: additionalClone, allClones: additionalAllClones } =
          cloneNode(additionalNode, nodeState.nodes);

        allClonedNodesByNode.set(additionalNode.id, additionalAllClones);
        rootClonedNodes.set(additionalNode.id, additionalClone);

        if (!additionalNode.inViewport) {
          const originalMainLeft =
            parseFloat(mainNode.style.left as string) || 0;
          const originalMainTop = parseFloat(mainNode.style.top as string) || 0;
          const originalAddLeft =
            parseFloat(additionalNode.style.left as string) || 0;
          const originalAddTop =
            parseFloat(additionalNode.style.top as string) || 0;

          const relativeX = originalAddLeft - originalMainLeft;
          const relativeY = originalAddTop - originalMainTop;

          const newX = mainX + relativeX;
          const newY = mainY + relativeY;

          additionalClone.style = {
            ...additionalClone.style,
            position: "absolute",
            left: `${newX}px`,
            top: `${newY}px`,
          };
        }
      });
    }

    // Insert all cloned nodes
    for (const [originalNodeId, rootClone] of rootClonedNodes.entries()) {
      const allClones = allClonedNodesByNode.get(originalNodeId) || [];

      if (!rootClone.inViewport) {
        nodeDisp.insertAtIndex(rootClone, 0, null, dragState);
      }

      const originalNode = nodeState.nodes.find((n) => n.id === originalNodeId);
      if (originalNode) {
        copyDimensions(originalNode, rootClone);
      }

      const childClones = allClones.filter(
        (clone) => clone.id !== rootClone.id
      );
      for (const childClone of childClones) {
        nodeDisp.insertAtIndex(childClone, 0, childClone.parentId, dragState);

        const originalChildren = getAllChildNodes(
          originalNodeId,
          nodeState.nodes
        );
        const originalChild = originalChildren.find(
          (n) => n.parentId === originalNode?.id && n.type === childClone.type
        );

        if (originalChild) {
          copyDimensions(originalChild, childClone);
        }
      }
    }
  }; // Variant-aware viewport duplication handler
  // Variant-aware viewport duplication handler
  // Variant-aware viewport duplication handler
  // Variant-aware viewport duplication handler
  // Variant-aware viewport duplication handler
  const handleViewportDuplication = (
    nodesToDuplicate: Node[],
    fromContextMenu = false
  ): string | null => {
    // Helper function to find dynamic descendants within a node
    const findDynamicDescendants = (nodeId: string, nodes: Node[]): Node[] => {
      const dynamicElements: Node[] = [];
      // First check if the node itself is dynamic
      const node = nodes.find((n) => n.id === nodeId);
      if (node && node.isDynamic) {
        dynamicElements.push(node);
        return dynamicElements;
      }
      // Then check all its children recursively
      const processChildren = (parentId: string) => {
        const children = nodes.filter((n) => n.parentId === parentId);
        children.forEach((child) => {
          if (child.isDynamic) {
            dynamicElements.push(child);
          } else {
            processChildren(child.id);
          }
        });
      };
      processChildren(nodeId);
      return dynamicElements;
    };

    // Check if any of the nodes to duplicate have dynamic descendants
    const dynamicDescendantsByParent = new Map<string, Node[]>();
    nodesToDuplicate.forEach((node) => {
      const dynamicDescendants = findDynamicDescendants(
        node.id,
        nodeState.nodes
      );
      if (dynamicDescendants.length > 0) {
        dynamicDescendantsByParent.set(node.id, dynamicDescendants);
      }
    });

    // If we find dynamic descendants, use the mixed content duplication routine
    if (dynamicDescendantsByParent.size > 0) {
      return handleMixedContentDuplication(
        nodesToDuplicate,
        dynamicDescendantsByParent,
        fromContextMenu
      );
    }

    // Normal duplication process for non-dynamic content
    const allClonedNodes: Node[] = [];
    const rootClonedNodes: Node[] = [];
    let firstDuplicateId: string | null = null;

    // Create ID mappings
    const idMapping = new Map<string, string>();
    const sharedIdMapping = new Map<string, string>();
    const variantRespIdMapping = new Map<string, string>();

    // Track created variant families by viewport
    const viewportVariantMappings = new Map<string, Map<string, boolean>>();

    // Generate completely new IDs for anything with a variantResponsiveId
    const generateNewVariantResponsiveIds = (
      node: Node
    ): string | undefined => {
      if (node.variantResponsiveId) {
        const newRespId = nanoid();
        variantRespIdMapping.set(node.variantResponsiveId, newRespId);
        if (!viewportVariantMappings.has(newRespId)) {
          viewportVariantMappings.set(newRespId, new Map());
        }
        if (node.dynamicViewportId) {
          viewportVariantMappings
            .get(newRespId)!
            .set(node.dynamicViewportId, true);
        }
        return newRespId;
      }
      return node.variantResponsiveId;
    };

    // First pass: Create primary clones for each node to duplicate.
    nodesToDuplicate.forEach((node) => {
      console.log(`Cloning node ${node.id}`);
      const { rootClone, allClones } = cloneNode(node, nodeState.nodes);
      rootClonedNodes.push(rootClone);
      allClonedNodes.push(...allClones);
      idMapping.set(node.id, rootClone.id);

      // Generate a new sharedId if needed
      if (node.sharedId) {
        const newSharedId = nanoid();
        sharedIdMapping.set(node.sharedId, newSharedId);
        rootClone.sharedId = newSharedId;
      }

      // Generate new variantResponsiveId to break connection with the original
      rootClone.variantResponsiveId = generateNewVariantResponsiveIds(node);

      if (!firstDuplicateId) {
        firstDuplicateId = rootClone.id;
      }

      copyDimensions(node, rootClone);
    });

    // Second pass: Update parent references for all clones
    allClonedNodes.forEach((clone) => {
      if (clone.parentId && idMapping.has(clone.parentId)) {
        clone.parentId = idMapping.get(clone.parentId)!;
      }
      if (clone.sharedId && sharedIdMapping.has(clone.sharedId)) {
        clone.sharedId = sharedIdMapping.get(clone.sharedId)!;
      }
      // For child nodes, generate a new variantResponsiveId
      if (!rootClonedNodes.includes(clone) && clone.variantResponsiveId) {
        clone.variantResponsiveId = nanoid();
      } else if (
        clone.variantResponsiveId &&
        variantRespIdMapping.has(clone.variantResponsiveId)
      ) {
        clone.variantResponsiveId = variantRespIdMapping.get(
          clone.variantResponsiveId
        )!;
      }
    });

    // Insert all primary (root) clones into their parent viewports
    rootClonedNodes.forEach((rootClone) => {
      const originalNode = nodesToDuplicate.find(
        (n) => n.type === rootClone.type && n.parentId === rootClone.parentId
      );
      if (originalNode) {
        const originalIndex = findIndexWithinParent(
          nodeState.nodes,
          originalNode.id,
          originalNode.parentId
        );
        const targetIndex = fromContextMenu ? originalIndex + 1 : originalIndex;
        nodeDisp.insertAtIndex(
          rootClone,
          targetIndex,
          rootClone.parentId,
          dragState
        );
        console.log(`Inserted primary clone ${rootClone.id}`);
      }
    });

    // Insert child clones for all non-root nodes
    const childNodes = allClonedNodes.filter(
      (node) => !rootClonedNodes.includes(node)
    );
    childNodes.forEach((childNode) => {
      nodeDisp.insertAtIndex(childNode, 0, childNode.parentId, dragState);
      console.log(
        `Inserted child ${childNode.id} with parent ${childNode.parentId}`
      );
    });

    // FIX: For non-dynamic duplication we no longer call pushNodes
    // because the nodes have already been inserted via insertAtIndex.
    // We only force a sync across viewports.
    if (!dragState.dynamicModeNodeId) {
      nodeDisp.syncViewports();
      return firstDuplicateId;
    }

    // ---------- Dynamic Mode (Variant-Aware) Duplication ----------
    // Create a mapping of root clones by their viewport
    const rootClonesByViewport = new Map<string, Node[]>();
    rootClonedNodes.forEach((rootClone) => {
      if (rootClone.dynamicViewportId) {
        if (!rootClonesByViewport.has(rootClone.dynamicViewportId)) {
          rootClonesByViewport.set(rootClone.dynamicViewportId, []);
        }
        rootClonesByViewport.get(rootClone.dynamicViewportId)!.push(rootClone);
      }
    });

    // Create a mapping of children by their parent
    const childrenByParent = new Map<string, Node[]>();
    childNodes.forEach((childNode) => {
      if (childNode.parentId) {
        if (!childrenByParent.has(childNode.parentId)) {
          childrenByParent.set(childNode.parentId, []);
        }
        childrenByParent.get(childNode.parentId)!.push(childNode);
      }
    });

    // Process cross-viewport duplication for dynamic nodes
    rootClonedNodes.forEach((rootClone) => {
      const originalNode = nodesToDuplicate.find(
        (n) => idMapping.get(n.id) === rootClone.id
      );
      if (!originalNode || !rootClone.variantResponsiveId) return;
      const primaryViewport = rootClone.dynamicViewportId;
      const relatedOriginalNodes = nodeState.nodes.filter(
        (n) =>
          n.variantResponsiveId === originalNode.variantResponsiveId &&
          n.id !== originalNode.id &&
          n.dynamicViewportId !== originalNode.dynamicViewportId
      );
      relatedOriginalNodes.forEach((relatedNode) => {
        if (
          viewportVariantMappings
            .get(rootClone.variantResponsiveId)
            ?.has(relatedNode.dynamicViewportId)
        ) {
          return;
        }
        const viewportClone = {
          ...JSON.parse(JSON.stringify(rootClone)),
          id: nanoid(),
          parentId: relatedNode.parentId,
          dynamicViewportId: relatedNode.dynamicViewportId,
          dynamicParentId: relatedNode.dynamicParentId,
          variantParentId: relatedNode.variantParentId,
          isVariant: relatedNode.isVariant,
          variantInfo: relatedNode.variantInfo
            ? { ...relatedNode.variantInfo }
            : undefined,
        };
        viewportClone.variantResponsiveId = rootClone.variantResponsiveId;
        if (!viewportVariantMappings.has(rootClone.variantResponsiveId)) {
          viewportVariantMappings.set(rootClone.variantResponsiveId, new Map());
        }
        viewportVariantMappings
          .get(rootClone.variantResponsiveId)!
          .set(relatedNode.dynamicViewportId, true);
        const relatedIndex = findIndexWithinParent(
          nodeState.nodes,
          relatedNode.id,
          relatedNode.parentId
        );
        const targetIndex = fromContextMenu ? relatedIndex + 1 : relatedIndex;
        nodeDisp.insertAtIndex(
          viewportClone,
          targetIndex,
          viewportClone.parentId,
          dragState
        );
        console.log(
          `Created cross-viewport clone ${viewportClone.id} in viewport ${relatedNode.dynamicViewportId}`
        );
        const originalChildren = childrenByParent.get(rootClone.id) || [];
        originalChildren.forEach((childClone) => {
          const viewportChildClone = {
            ...JSON.parse(JSON.stringify(childClone)),
            id: nanoid(),
            parentId: viewportClone.id,
            dynamicViewportId: relatedNode.dynamicViewportId,
            dynamicParentId: relatedNode.dynamicParentId,
            variantParentId: viewportClone.id,
            isVariant: relatedNode.isVariant,
            variantInfo: relatedNode.variantInfo
              ? { ...relatedNode.variantInfo }
              : undefined,
          };
          viewportChildClone.variantResponsiveId =
            childClone.variantResponsiveId;
          nodeDisp.insertAtIndex(
            viewportChildClone,
            0,
            viewportChildClone.parentId,
            dragState
          );
          console.log(
            `Created child ${viewportChildClone.id} for viewport clone ${viewportClone.id}`
          );
          const handleChildrenRecursively = (
            parentId: string,
            newParentId: string,
            viewportId: string
          ) => {
            const children = allClonedNodes.filter(
              (n) => n.parentId === parentId
            );
            children.forEach((child) => {
              const childClone = {
                ...JSON.parse(JSON.stringify(child)),
                id: nanoid(),
                parentId: newParentId,
                dynamicViewportId: viewportId,
                variantParentId: newParentId,
                isVariant: relatedNode.isVariant,
                variantInfo: relatedNode.variantInfo
                  ? { ...relatedNode.variantInfo }
                  : undefined,
              };
              childClone.variantResponsiveId = child.variantResponsiveId;
              nodeDisp.insertAtIndex(
                childClone,
                0,
                childClone.parentId,
                dragState
              );
              handleChildrenRecursively(child.id, childClone.id, viewportId);
            });
          };
          handleChildrenRecursively(
            childClone.id,
            viewportChildClone.id,
            relatedNode.dynamicViewportId
          );
        });
      });
      // After variant processing, trigger a delayed sync for variants
      setTimeout(() => {
        rootClonedNodes.forEach((node) => {
          if (nodeDisp.syncVariants) {
            nodeDisp.syncVariants(node.id);
          }
        });
      }, 10);
    });

    return firstDuplicateId;
  };

  // New function to handle duplication of frames with dynamic elements inside
  // New function to handle duplication of frames with dynamic elements inside
  // New function to handle duplication of frames with dynamic elements inside
  // New function to handle duplication of frames with dynamic elements inside
  // New function to handle duplication of frames with dynamic elements inside
  // New function to handle duplication of frames with dynamic elements inside
  const handleMixedContentDuplication = (
    nodesToDuplicate: Node[],
    dynamicDescendantsByParent: Map<string, Node[]>,
    fromContextMenu = false
  ): string | null => {
    console.group("handleMixedContentDuplication START");
    let firstDuplicateId: string | null = null;

    // Create mappings
    const originalToNewIdMap = new Map();
    const originalToNewSharedIdMap = new Map();
    const viewportParentMaps = new Map();

    // Initialize viewport mappings
    const viewports = nodeState.nodes.filter((n) => n.isViewport);
    viewports.forEach((viewport) => {
      viewportParentMaps.set(viewport.id, new Map());
    });

    // Helper function to find all intermediate frames between a node and its top-level parent
    const findIntermediateFrames = (
      startNodeId: string,
      topLevelParentId: string
    ): Node[] => {
      const frames: Node[] = [];
      let currentNodeId = startNodeId;

      // Traverse up the tree to find all intermediate frames
      while (currentNodeId && currentNodeId !== topLevelParentId) {
        const node = nodeState.nodes.find((n) => n.id === currentNodeId);
        if (!node) break;

        // Get the parent
        currentNodeId = node.parentId;
        if (!currentNodeId || currentNodeId === topLevelParentId) break;

        const parentNode = nodeState.nodes.find((n) => n.id === currentNodeId);
        if (!parentNode) break;

        // If the parent is a frame and not a viewport, add it to our intermediate frames
        if (parentNode.type === "frame" && !parentNode.isViewport) {
          frames.push(parentNode);
        }
      }

      return frames;
    };

    // STEP 1: First collect all frames to duplicate including intermediate ones
    const intermediateFramesByParent = new Map<string, Set<Node>>();
    const allIntermediateFrames = new Set<Node>();

    for (const [
      parentId,
      dynamicElements,
    ] of dynamicDescendantsByParent.entries()) {
      const intermediateFramesSet = new Set<Node>();

      for (const dynamicElement of dynamicElements) {
        // Find all intermediate frames between this dynamic element and the parent
        const frames = findIntermediateFrames(dynamicElement.id, parentId);

        // Add these frames to our sets
        frames.forEach((frame) => {
          intermediateFramesSet.add(frame);
          allIntermediateFrames.add(frame);
        });
      }

      intermediateFramesByParent.set(parentId, intermediateFramesSet);
    }

    // Prepare shared IDs for all frames that need duplication
    for (const parentNode of nodesToDuplicate) {
      if (parentNode.isDynamic) continue;
      if (
        parentNode.sharedId &&
        !originalToNewSharedIdMap.has(parentNode.sharedId)
      ) {
        originalToNewSharedIdMap.set(parentNode.sharedId, nanoid());
      }
    }

    // Also prepare shared IDs for all intermediate frames
    for (const frame of allIntermediateFrames) {
      if (frame.sharedId && !originalToNewSharedIdMap.has(frame.sharedId)) {
        originalToNewSharedIdMap.set(frame.sharedId, nanoid());
      }
    }

    // STEP 2: Duplicate top-level parent frames across all viewports
    for (const viewport of viewports) {
      const nodesToProcess = nodeState.nodes.filter(
        (n) =>
          !n.isDynamic &&
          n.parentId === viewport.id &&
          n.sharedId &&
          originalToNewSharedIdMap.has(n.sharedId)
      );

      for (const parentNode of nodesToProcess) {
        const newId = nanoid();
        const newSharedId = originalToNewSharedIdMap.get(parentNode.sharedId);

        const parentClone = JSON.parse(JSON.stringify(parentNode));
        parentClone.id = newId;
        parentClone.sharedId = newSharedId;

        originalToNewIdMap.set(parentNode.id, newId);
        const viewportMap = viewportParentMaps.get(viewport.id);
        if (viewportMap) {
          viewportMap.set(parentNode.sharedId, newId);
        }

        if (!firstDuplicateId) {
          firstDuplicateId = newId;
        }

        const index = findIndexWithinParent(
          nodeState.nodes,
          parentNode.id,
          viewport.id
        );
        const targetIndex = fromContextMenu ? index + 1 : index;

        console.log(
          `Duplicating parent frame ${parentNode.id} → ${newId} in viewport ${viewport.id}`
        );
        nodeDisp.insertAtIndex(parentClone, targetIndex, viewport.id);
        copyDimensions(parentNode, parentClone);
      }
    }

    // STEP 3: Duplicate intermediate frames across all viewports
    // Map to keep track of original-to-new frame mappings by shared ID
    const frameSharedIdMap = new Map<string, Map<string, string>>();

    // Initialize frame shared ID map for each viewport
    viewports.forEach((viewport) => {
      frameSharedIdMap.set(viewport.id, new Map());
    });

    // Process intermediate frames level by level from top to bottom
    // First, we need to sort them by their depth in the tree
    const framesByDepth = new Map<string, number>();
    const frameParentMap = new Map<string, string>();

    // Calculate depth for each frame
    for (const frame of allIntermediateFrames) {
      let depth = 0;
      let currentNodeId = frame.id;
      let parentPath = [];

      while (currentNodeId) {
        const node = nodeState.nodes.find((n) => n.id === currentNodeId);
        if (!node) break;

        if (node.parentId) {
          const parent = nodeState.nodes.find((p) => p.id === node.parentId);
          if (parent && parent.type === "frame" && !parent.isViewport) {
            depth++;
            parentPath.push(parent.id);
          }
        }

        currentNodeId = node.parentId;
      }

      framesByDepth.set(frame.id, depth);
      frameParentMap.set(frame.id, parentPath[0] || null);
    }

    // Sort intermediate frames by depth (shallowest first)
    const sortedFrames = [...allIntermediateFrames].sort((a, b) => {
      const depthA = framesByDepth.get(a.id) || 0;
      const depthB = framesByDepth.get(b.id) || 0;
      return depthA - depthB;
    });

    // Duplicate intermediate frames in sorted order
    for (const frame of sortedFrames) {
      // Skip if this frame was already duplicated
      if (originalToNewIdMap.has(frame.id)) continue;

      // Find all frames with the same shared ID across viewports
      const framesWithSameSharedId = nodeState.nodes.filter(
        (n) => n.sharedId === frame.sharedId
      );

      for (const sameSharedFrame of framesWithSameSharedId) {
        // Find which viewport this frame is in
        let parentId = sameSharedFrame.parentId;
        let viewport = null;

        // Find the viewport by traversing up the tree
        while (parentId) {
          const parent = nodeState.nodes.find((n) => n.id === parentId);
          if (!parent) break;

          if (parent.isViewport) {
            viewport = parent.id;
            break;
          }

          parentId = parent.parentId;
        }

        if (!viewport) continue;

        // Determine the new parent for this frame
        let newParentId = null;
        const originalParentId = sameSharedFrame.parentId;

        if (originalParentId) {
          // If the parent was already duplicated, use the new parent
          if (originalToNewIdMap.has(originalParentId)) {
            newParentId = originalToNewIdMap.get(originalParentId);
          }
          // If the parent has a shared ID that was duplicated, find the new parent by shared ID
          else {
            const originalParent = nodeState.nodes.find(
              (n) => n.id === originalParentId
            );
            if (originalParent && originalParent.sharedId) {
              const viewportMap = viewportParentMaps.get(viewport);
              if (viewportMap && viewportMap.has(originalParent.sharedId)) {
                newParentId = viewportMap.get(originalParent.sharedId);
              }
            }
          }
        }

        // If we couldn't find a new parent, skip this frame
        if (!newParentId) continue;

        // Create the duplicate frame
        const newId = nanoid();
        const newSharedId = originalToNewSharedIdMap.get(
          sameSharedFrame.sharedId
        );

        const frameClone = JSON.parse(JSON.stringify(sameSharedFrame));
        frameClone.id = newId;
        frameClone.sharedId = newSharedId;
        frameClone.parentId = newParentId;

        // Update our mappings
        originalToNewIdMap.set(sameSharedFrame.id, newId);

        // Update viewport tracking
        const viewportMap = viewportParentMaps.get(viewport);
        if (viewportMap) {
          viewportMap.set(sameSharedFrame.sharedId, newId);
        }

        // Update frame shared ID map
        const frameMap = frameSharedIdMap.get(viewport);
        if (frameMap) {
          frameMap.set(sameSharedFrame.sharedId, newId);
        }

        console.log(
          `Duplicating intermediate frame ${sameSharedFrame.id} → ${newId} with parent ${newParentId} in viewport ${viewport}`
        );
        nodeDisp.insertAtIndex(frameClone, 0, newParentId);
        copyDimensions(sameSharedFrame, frameClone);
      }
    }

    // STEP 4: Process dynamic families
    const processedFamilies = new Set();

    for (const [
      originalParentId,
      dynamicElements,
    ] of dynamicDescendantsByParent.entries()) {
      const newParentId = originalToNewIdMap.get(originalParentId);
      if (!newParentId) continue;

      const originalParent = nodeState.nodes.find(
        (n) => n.id === originalParentId
      );
      if (!originalParent || !originalParent.sharedId) continue;

      for (const dynamicElement of dynamicElements) {
        if (
          !dynamicElement.dynamicFamilyId ||
          processedFamilies.has(dynamicElement.dynamicFamilyId)
        )
          continue;
        processedFamilies.add(dynamicElement.dynamicFamilyId);

        const newFamilyId = nanoid();

        // --- GATHER ALL RELATED NODES ---
        // First get all nodes with this family ID (both base and variants)
        const familyNodes = nodeState.nodes.filter(
          (n) => n.dynamicFamilyId === dynamicElement.dynamicFamilyId
        );

        // Find all nodes that are children of family nodes (including children of variants)
        const familyNodeIds = familyNodes.map((n) => n.id);
        const childNodes = [];

        // Find all children recursively
        const findAllChildren = (parentIds) => {
          // Look for direct children of any parent in parentIds
          const directChildren = nodeState.nodes.filter((n) =>
            parentIds.includes(n.parentId)
          );

          // Add these children if they're not already in the family nodes
          directChildren.forEach((child) => {
            if (
              !familyNodes.some((fn) => fn.id === child.id) &&
              !childNodes.some((cn) => cn.id === child.id)
            ) {
              childNodes.push(child);
              console.log(
                `Found child node: ${child.id}, parent: ${child.parentId}`
              );
            }
          });

          // Recursively find children of these children
          if (directChildren.length > 0) {
            findAllChildren(directChildren.map((c) => c.id));
          }
        };

        // Start recursive search
        findAllChildren(familyNodeIds);

        // Combine all nodes to duplicate
        const allFamilyNodes = [...familyNodes, ...childNodes];

        // Check if we have variants
        const hasVariants = familyNodes.some((n) => n.isVariant);
        console.log(
          `Found ${familyNodes.length} family nodes and ${childNodes.length} child nodes. Has variants: ${hasVariants}`
        );

        // --- CREATE ID MAPPINGS ---
        const idMap = new Map(); // old ID -> new ID
        const sharedIdMap = new Map(); // old sharedId -> new sharedId
        const variantRespIdMap = new Map(); // old variantResponseId -> new variantResponseId
        const variantInfoIdMap = new Map(); // old variantInfo.id -> new variantInfo.id

        // Generate new unique IDs for all relevant properties
        allFamilyNodes.forEach((node) => {
          // Create new unique ID for each node
          idMap.set(node.id, nanoid());

          // Map sharedIds (same old ID gets same new ID)
          if (node.sharedId && !sharedIdMap.has(node.sharedId)) {
            sharedIdMap.set(node.sharedId, nanoid());
          }

          // Map variantResponsiveIds
          if (
            node.variantResponsiveId &&
            !variantRespIdMap.has(node.variantResponsiveId)
          ) {
            variantRespIdMap.set(node.variantResponsiveId, nanoid());
          }

          // Map variantInfo.id values
          if (
            node.variantInfo?.id &&
            !variantInfoIdMap.has(node.variantInfo.id)
          ) {
            variantInfoIdMap.set(
              node.variantInfo.id,
              `variant-${Math.floor(Math.random() * 10000)}`
            );
          }
        });

        // --- CREATE DUPLICATED NODES WITH UPDATED IDs ---
        const newNodes = [];

        // Create a map to track relationships between original and new nodes
        const originalToNewMap = new Map();

        allFamilyNodes.forEach((originalNode) => {
          // Deep clone the node
          const newNode = JSON.parse(JSON.stringify(originalNode));

          // Set new node ID
          newNode.id = idMap.get(originalNode.id);

          // Store mapping for later reference
          originalToNewMap.set(originalNode.id, newNode);

          // Update family ID if applicable
          if (originalNode.dynamicFamilyId === dynamicElement.dynamicFamilyId) {
            newNode.dynamicFamilyId = newFamilyId;
          }

          // Update sharedId if present
          if (originalNode.sharedId && sharedIdMap.has(originalNode.sharedId)) {
            newNode.sharedId = sharedIdMap.get(originalNode.sharedId);
          }

          // Update variantResponsiveId if present
          if (
            originalNode.variantResponsiveId &&
            variantRespIdMap.has(originalNode.variantResponsiveId)
          ) {
            newNode.variantResponsiveId = variantRespIdMap.get(
              originalNode.variantResponsiveId
            );
          }

          // Update variantInfo.id if present
          if (
            originalNode.variantInfo?.id &&
            variantInfoIdMap.has(originalNode.variantInfo.id)
          ) {
            newNode.variantInfo = {
              ...originalNode.variantInfo,
              id: variantInfoIdMap.get(originalNode.variantInfo.id),
            };
          }

          // Ensure dynamic nodes are visible in all viewports
          if (originalNode.isDynamic) {
            newNode.inViewport = true;
            if (newNode.originalState) {
              newNode.originalState.inViewport = true;
            }
          }

          // Update dynamicParentId reference
          if (
            originalNode.dynamicParentId &&
            idMap.has(originalNode.dynamicParentId)
          ) {
            newNode.dynamicParentId = idMap.get(originalNode.dynamicParentId);
          }

          // Update variantParentId reference
          if (
            originalNode.variantParentId &&
            idMap.has(originalNode.variantParentId)
          ) {
            newNode.variantParentId = idMap.get(originalNode.variantParentId);
          }

          // IMPORTANT: Store original dynamic connections for later processing
          if (
            originalNode.dynamicConnections &&
            originalNode.dynamicConnections.length > 0
          ) {
            newNode._originalDynamicConnections =
              originalNode.dynamicConnections;
          }

          // Store original IDs for reference
          newNode._originalId = originalNode.id;
          newNode._originalParentId = originalNode.parentId;
          newNode._isVariant = originalNode.isVariant === true;
          newNode._isDynamic = originalNode.isDynamic === true;

          // Store the complete parent chain for better parent resolution
          const parentChain = [];
          let currentId = originalNode.parentId;
          let depth = 0;
          // Prevent potential infinite loops with a reasonable depth limit
          while (currentId && depth < 10) {
            parentChain.push(currentId);
            const parent = nodeState.nodes.find((n) => n.id === currentId);
            if (!parent) break;
            currentId = parent.parentId;
            depth++;
          }
          newNode._parentChain = parentChain;

          newNodes.push(newNode);
        });

        // --- SET PARENT-CHILD RELATIONSHIPS ---
        if (hasVariants) {
          // Create lookup map for variant children
          const variantChildMap = new Map();

          // Identify which nodes are children of variants in the original tree
          allFamilyNodes.forEach((originalNode) => {
            if (originalNode.parentId) {
              const parent = allFamilyNodes.find(
                (n) => n.id === originalNode.parentId
              );
              if (parent && parent.isVariant) {
                variantChildMap.set(originalNode.id, parent.id);
              }
            }
          });

          // Create a map to track child-parent relationships
          const childParentMap = new Map();

          // Build child-parent relationships from original tree
          allFamilyNodes.forEach((node) => {
            if (node.parentId) {
              childParentMap.set(node.id, node.parentId);
            }
          });

          // Set parent-child relationships for variants
          newNodes.forEach((newNode) => {
            // For variants, always set parentId to null
            if (newNode._isVariant) {
              newNode.parentId = null;
            }
            // For dynamic nodes in viewport
            else if (newNode._isDynamic) {
              // If original node had a parent that wasn't a viewport, preserve that relationship
              if (
                newNode._originalParentId &&
                !newNode._originalParentId.includes("viewport")
              ) {
                // Resolution priority:
                // 1. Check if parent is in idMap (from dynamic family)
                if (idMap.has(newNode._originalParentId)) {
                  newNode.parentId = idMap.get(newNode._originalParentId);
                }
                // 2. Check if parent is in originalToNewIdMap (from frame duplication)
                else if (originalToNewIdMap.has(newNode._originalParentId)) {
                  newNode.parentId = originalToNewIdMap.get(
                    newNode._originalParentId
                  );
                }
                // 3. Try to find any frame in the parent chain that was duplicated
                else if (
                  newNode._parentChain &&
                  newNode._parentChain.length > 0
                ) {
                  let foundParent = false;
                  for (const parentId of newNode._parentChain) {
                    // Try idMap first
                    if (idMap.has(parentId)) {
                      newNode.parentId = idMap.get(parentId);
                      foundParent = true;
                      break;
                    }
                    // Then try originalToNewIdMap
                    if (originalToNewIdMap.has(parentId)) {
                      newNode.parentId = originalToNewIdMap.get(parentId);
                      foundParent = true;
                      break;
                    }
                  }

                  // 4. If no direct parent, check by shared ID
                  if (!foundParent) {
                    const originalParent = nodeState.nodes.find(
                      (n) => n.id === newNode._originalParentId
                    );
                    if (originalParent && originalParent.sharedId) {
                      const viewportId = newNode.dynamicViewportId;
                      if (viewportId) {
                        const viewportMap = viewportParentMaps.get(viewportId);
                        if (
                          viewportMap &&
                          viewportMap.has(originalParent.sharedId)
                        ) {
                          newNode.parentId = viewportMap.get(
                            originalParent.sharedId
                          );
                        }
                      }
                    }
                  }
                }

                // 5. Last resort - if still no parent found, try the new parent frame
                if (
                  !newNode.parentId ||
                  newNode.parentId === newNode._originalParentId
                ) {
                  const viewportId = newNode.dynamicViewportId;
                  if (viewportId) {
                    const viewportMap = viewportParentMaps.get(viewportId);
                    if (viewportMap && originalParent.sharedId) {
                      const newViewportParentId = viewportMap.get(
                        originalParent.sharedId
                      );
                      if (newViewportParentId) {
                        newNode.parentId = newViewportParentId;
                        if (newNode.dynamicParentId) {
                          newNode.dynamicParentId = newViewportParentId;
                        }
                      }
                    }
                  }
                }
              } else {
                // Only use viewport as direct parent if original was direct child of viewport
                newNode.parentId = newNode.dynamicViewportId;
              }
            }
            // For children nodes with parents in our mapping
            else if (
              newNode._originalParentId &&
              idMap.has(newNode._originalParentId)
            ) {
              newNode.parentId = idMap.get(newNode._originalParentId);
            }

            // Special handling for variant children - CRITICAL FIX
            if (variantChildMap.has(newNode._originalId)) {
              const originalVariantParentId = variantChildMap.get(
                newNode._originalId
              );
              if (idMap.has(originalVariantParentId)) {
                newNode.parentId = idMap.get(originalVariantParentId);
              }
            }

            // For child elements of dynamic nodes or variants
            const originalNode = originalToNewMap.get(newNode._originalId);
            if (
              originalNode &&
              (originalNode.type === "text" || !originalNode.isDynamic)
            ) {
              // If this is a child element, make sure it follows its parent
              const originalParentId = childParentMap.get(newNode._originalId);
              if (originalParentId && idMap.has(originalParentId)) {
                // Make sure this node is assigned to the new parent
                newNode.parentId = idMap.get(originalParentId);

                // Also update dynamicParentId if needed
                if (
                  newNode.dynamicParentId &&
                  idMap.has(newNode.dynamicParentId)
                ) {
                  newNode.dynamicParentId = idMap.get(newNode.dynamicParentId);
                }
              }
            }

            // CRITICAL: Process dynamic connections
            if (newNode._originalDynamicConnections) {
              // Update all IDs in the dynamic connections to point to new IDs
              newNode.dynamicConnections =
                newNode._originalDynamicConnections.map((conn) => {
                  const newConn = { ...conn };
                  // Map source ID if it's in our idMap
                  if (idMap.has(conn.sourceId)) {
                    newConn.sourceId = idMap.get(conn.sourceId);
                  }
                  // Map target ID if it's in our idMap
                  if (idMap.has(conn.targetId)) {
                    newConn.targetId = idMap.get(conn.targetId);
                  }
                  return newConn;
                });

              // Remove the temporary property
              delete newNode._originalDynamicConnections;
            }
          });
        } else {
          // Simpler handling for non-variant dynamic elements
          // Create a mapping of original node IDs to new node IDs for parent reassignment
          const nodeOriginalToNewIdMap = new Map();
          newNodes.forEach((newNode) => {
            if (newNode._originalId) {
              nodeOriginalToNewIdMap.set(newNode._originalId, newNode.id);
            }
          });

          // Fix parent-child relationships
          newNodes.forEach((newNode) => {
            // If this node has a parent that was duplicated, update the reference
            if (
              newNode._originalParentId &&
              nodeOriginalToNewIdMap.has(newNode._originalParentId)
            ) {
              newNode.parentId = nodeOriginalToNewIdMap.get(
                newNode._originalParentId
              );
            } else if (newNode._isDynamic) {
              // Try to find the right parent for dynamic nodes
              let foundParent = false;

              // First check if parent is in our dynamic node mapping
              if (
                newNode._originalParentId &&
                nodeOriginalToNewIdMap.has(newNode._originalParentId)
              ) {
                newNode.parentId = nodeOriginalToNewIdMap.get(
                  newNode._originalParentId
                );
                foundParent = true;
              }
              // Then check if parent is in our intermediate/parent frame mapping
              else if (
                newNode._originalParentId &&
                originalToNewIdMap.has(newNode._originalParentId)
              ) {
                newNode.parentId = originalToNewIdMap.get(
                  newNode._originalParentId
                );
                foundParent = true;
              }
              // Check the parent chain for any duplicated parent
              else if (
                newNode._parentChain &&
                newNode._parentChain.length > 0
              ) {
                for (const parentId of newNode._parentChain) {
                  // Try nodeOriginalToNewIdMap first
                  if (nodeOriginalToNewIdMap.has(parentId)) {
                    newNode.parentId = nodeOriginalToNewIdMap.get(parentId);
                    foundParent = true;
                    break;
                  }
                  // Then try originalToNewIdMap
                  if (originalToNewIdMap.has(parentId)) {
                    newNode.parentId = originalToNewIdMap.get(parentId);
                    foundParent = true;
                    break;
                  }
                }
              }

              // If still no parent found, try to find by shared ID
              if (!foundParent) {
                // Look for the parent by shared ID
                const originalParent = nodeState.nodes.find(
                  (n) => n.id === newNode._originalParentId
                );
                if (originalParent && originalParent.sharedId) {
                  const viewportId = newNode.dynamicViewportId;
                  if (viewportId) {
                    const viewportMap = viewportParentMaps.get(viewportId);
                    if (
                      viewportMap &&
                      viewportMap.has(originalParent.sharedId)
                    ) {
                      newNode.parentId = viewportMap.get(
                        originalParent.sharedId
                      );
                      foundParent = true;
                    }
                  }
                }
              }

              // Last resort - use the top level parent
              if (!foundParent) {
                const viewportId = newNode.dynamicViewportId;
                if (viewportId) {
                  const viewportMap = viewportParentMaps.get(viewportId);
                  if (viewportMap && originalParent.sharedId) {
                    const newViewportParentId = viewportMap.get(
                      originalParent.sharedId
                    );
                    if (newViewportParentId) {
                      newNode.parentId = newViewportParentId;
                      if (newNode.dynamicParentId) {
                        newNode.dynamicParentId = newViewportParentId;
                      }
                    }
                  }
                }
              }
            }

            // HANDLE DYNAMIC CONNECTIONS
            if (newNode._originalDynamicConnections) {
              // Update all IDs in the dynamic connections to point to new IDs
              newNode.dynamicConnections =
                newNode._originalDynamicConnections.map((conn) => {
                  const newConn = { ...conn };
                  // Map source ID if it's in our idMap
                  if (idMap.has(conn.sourceId)) {
                    newConn.sourceId = idMap.get(conn.sourceId);
                  }
                  // Map target ID if it's in our idMap
                  if (idMap.has(conn.targetId)) {
                    newConn.targetId = idMap.get(conn.targetId);
                  }
                  return newConn;
                });

              // Remove the temporary property
              delete newNode._originalDynamicConnections;
            }
          });
        }

        // Final pass: Fix any misaligned parent-child relationships
        const originalIdToNewIdMap = new Map();

        // Build reverse mapping from original ID to new ID
        newNodes.forEach((node) => {
          if (node._originalId) {
            originalIdToNewIdMap.set(node._originalId, node.id);
          }
        });

        // Fix parent relationships
        newNodes.forEach((node) => {
          if (!node._originalParentId) return;

          // If we have a mapping for this parent, use the new parent ID
          if (originalIdToNewIdMap.has(node._originalParentId)) {
            node.parentId = originalIdToNewIdMap.get(node._originalParentId);

            // Ensure dynamicParentId is consistent if needed
            if (
              node.dynamicParentId &&
              originalIdToNewIdMap.has(node._originalParentId)
            ) {
              const originalDynamicParent = allFamilyNodes.find(
                (n) => n.id === node._originalParentId
              );
              if (originalDynamicParent && originalDynamicParent.isDynamic) {
                node.dynamicParentId = node.parentId;
              }
            }
          }

          // One final check for dynamic connections
          if (node.dynamicConnections) {
            node.dynamicConnections = node.dynamicConnections.map((conn) => {
              const newConn = { ...conn };
              // If source ID is in our originalIdToNewIdMap, update it
              if (originalIdToNewIdMap.has(conn.sourceId)) {
                newConn.sourceId = originalIdToNewIdMap.get(conn.sourceId);
              }
              // If target ID is in our originalIdToNewIdMap, update it
              if (originalIdToNewIdMap.has(conn.targetId)) {
                newConn.targetId = originalIdToNewIdMap.get(conn.targetId);
              }
              return newConn;
            });
          }
        });

        // Clean up temporary properties
        newNodes.forEach((node) => {
          delete node._originalId;
          delete node._originalParentId;
          delete node._isVariant;
          delete node._isDynamic;
          delete node._originalDynamicConnections;
        });

        // Insert all nodes with appropriate parent relationships
        nodeDisp.pushNodes(newNodes);

        console.log(
          `Successfully duplicated ${newNodes.length} nodes with family ID ${newFamilyId}`
        );
      }
    }

    console.groupEnd();
    return firstDuplicateId;
  };

  const handleCopy = () => {
    const selectedIds = currentSelectedIds();

    const selectedNodes = selectedIds
      .map((id) => nodeState.nodes.find((n) => n.id === id))
      .filter((n): n is Node => n !== undefined);

    if (selectedNodes.length === 0) return;

    // Store the selected nodes and their children
    const allNodesToCopy: Node[] = [];
    selectedNodes.forEach((node) => {
      allNodesToCopy.push(node);
      const children = getAllChildNodes(node.id, nodeState.nodes);
      allNodesToCopy.push(...children);
    });

    // Create clipboard data structure
    const clipboardData = {
      nodes: allNodesToCopy,
      timestamp: Date.now(),
    };

    // Store in localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clipboardData));
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handlePaste = (x?: number, y?: number) => {
    const clipboardJson = localStorage.getItem(STORAGE_KEY);
    if (!clipboardJson) return;

    try {
      const clipboardData = JSON.parse(clipboardJson);
      const copiedNodes = clipboardData.nodes as Node[];

      if (!copiedNodes?.length) return;

      const rootNodes = copiedNodes.filter(
        (node) => !copiedNodes.find((n) => n.id === node.parentId)
      );

      const allClonedNodesByNode = new Map<string, Node[]>();
      const rootClonedNodes = new Map<string, Node>();
      const rect = containerRef.current?.getBoundingClientRect();

      // Find the top-left most node to use as reference point
      const referenceNode = rootNodes.reduce((ref, node) => {
        const nodeLeft = parseFloat(node.style.left as string) || 0;
        const nodeTop = parseFloat(node.style.top as string) || 0;
        const refLeft = parseFloat(ref?.style.left as string) || Infinity;
        const refTop = parseFloat(ref?.style.top as string) || Infinity;

        if (nodeLeft < refLeft || (nodeLeft === refLeft && nodeTop < refTop)) {
          return node;
        }
        return ref;
      }, rootNodes[0]);

      const referenceLeft = parseFloat(referenceNode.style.left as string) || 0;
      const referenceTop = parseFloat(referenceNode.style.top as string) || 0;

      // Clone all root nodes first
      rootNodes.forEach((node) => {
        const { rootClone, allClones } = cloneNode(node, nodeState.nodes);
        allClonedNodesByNode.set(node.id, allClones);
        rootClonedNodes.set(node.id, rootClone);

        if (!node.inViewport && !node.parentId) {
          if (x && y && rect) {
            // Calculate relative position from reference node
            const originalLeft = parseFloat(node.style.left as string) || 0;
            const originalTop = parseFloat(node.style.top as string) || 0;
            const relativeLeft = originalLeft - referenceLeft;
            const relativeTop = originalTop - referenceTop;

            // Apply relative position to new paste coordinates
            const canvasX = (x - rect.left - transform.x) / transform.scale;
            const canvasY = (y - rect.top - transform.y) / transform.scale;

            rootClone.style = {
              ...rootClone.style,
              position: "absolute",
              left: `${canvasX + relativeLeft}px`,
              top: `${canvasY + relativeTop}px`,
            };
          } else {
            // Original offset behavior
            const nodeWidth = parseFloat(node.style.width as string) || 0;
            const originalLeft = parseFloat(node.style.left as string) || 0;
            const originalTop = parseFloat(node.style.top as string) || 0;

            rootClone.style = {
              ...rootClone.style,
              position: "absolute",
              left: `${originalLeft + nodeWidth + 50}px`,
              top: `${originalTop}px`,
            };
          }
        }
      });

      // Rest of the function remains the same...
      for (const [originalNodeId, rootClone] of rootClonedNodes.entries()) {
        const allClones = allClonedNodesByNode.get(originalNodeId) || [];
        const originalNode = copiedNodes.find((n) => n.id === originalNodeId);

        if (!originalNode) continue;

        if (originalNode.inViewport || originalNode.parentId) {
          const siblingNodes = nodeState.nodes.filter(
            (n) => n.parentId === originalNode.parentId
          );
          const originalIndex = siblingNodes.findIndex(
            (n) => n.id === originalNode.id
          );
          nodeDisp.insertAtIndex(
            rootClone,
            originalIndex + 1,
            originalNode.parentId
          );
        } else {
          nodeDisp.insertAtIndex(rootClone, 0, null);
        }

        const childClones = allClones.filter(
          (clone) => clone.id !== rootClone.id
        );
        for (const childClone of childClones) {
          nodeDisp.insertAtIndex(childClone, 0, childClone.parentId);
        }
      }

      const hasViewportNodes = copiedNodes.some((node) => node.inViewport);
      if (hasViewportNodes) {
        nodeDisp.syncViewports();
      }

      const newNodeIds = Array.from(rootClonedNodes.values()).map(
        (node) => node.id
      );
      clearSelection();
      newNodeIds.forEach((id) => addToSelection(id));
    } catch (error) {
      console.error("Failed to paste from clipboard:", error);
    }
  };

  return {
    handleDelete,
    handleDuplicate,
    getAllChildNodes,
    handleCopy,
    handlePaste,
  };
};
