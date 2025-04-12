// useNodeActions.ts
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { nanoid } from "nanoid";
import { findIndexWithinParent } from "../utils";

export const useNodeActions = () => {
  const { dragState, nodeState, dragDisp, nodeDisp, transform, containerRef } =
    useBuilder();

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
    if (!dragState.selectedIds?.length) return;

    const nodesToRemove = new Set<string | number>();

    // Step 1: First collect all nodes to be deleted (selected nodes and their children)
    dragState.selectedIds.forEach((nodeId) => {
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

      if (fromContextMenu) {
        nodesToDuplicate = dragState.selectedIds
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
            dragDisp.clearSelection();
            dragDisp.addToSelection(newTopNodeId);
          }, 100);
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
              dragDisp.selectNode(newVariantId);
            }, 1);
          }
        } else {
          // Not a top-level dynamic node, use regular duplication
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

    const findAllChildren = (parentIds) => {
      const children = nodeState.nodes.filter(
        (n) =>
          !familyNodes.some((fn) => fn.id === n.id) &&
          parentIds.includes(n.parentId)
      );

      if (children.length === 0) return;

      children.forEach((child) => {
        childNodes.push(child);
      });

      // Recursively find children of these children
      findAllChildren(children.map((c) => c.id));
    };

    findAllChildren(familyNodeIds);

    // Combine all nodes to duplicate
    const allFamilyNodes = [...familyNodes, ...childNodes];

    // Quick check if there are any nodes to duplicate
    if (allFamilyNodes.length === 0) {
      console.warn("No nodes found to duplicate");
      return null;
    }

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

    allFamilyNodes.forEach((originalNode) => {
      // Deep clone the node
      const newNode = JSON.parse(JSON.stringify(originalNode));

      // Set new node ID
      newNode.id = idMap.get(originalNode.id);

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

    // Special case for dynamic elements with no variants - just update references directly
    if (!hasVariants) {
      // Update dynamicConnections with properly mapped IDs
      newNodes.forEach((newNode) => {
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

        // Clean up temporary properties
        delete newNode._originalId;
        delete newNode._originalParentId;
        delete newNode._isVariant;
        delete newNode._isDynamic;
      });

      // Insert all nodes directly with their original parentId structure
      nodeDisp.pushNodes(newNodes);

      console.log(
        `Successfully duplicated ${newNodes.length} nodes with family ID ${newFamilyId} (no variants)`
      );

      // Return the ID of the duplicated source node
      return idMap.get(sourceNodeId);
    }

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

    // 6. SECOND PASS: SET PARENT-CHILD RELATIONSHIPS
    newNodes.forEach((newNode) => {
      // CRITICAL FIX: For variants, always set parentId to null
      if (newNode._isVariant) {
        newNode.parentId = null;
      }
      // For dynamic nodes: parentId should be the viewport
      else if (newNode._isDynamic) {
        newNode.parentId = newNode.dynamicViewportId;
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

      // Clean up temporary properties
      delete newNode._originalId;
      delete newNode._originalParentId;
      delete newNode._isVariant;
      delete newNode._isDynamic;
    });

    // 7. DIRECT INSERTION USING THE pushNodes METHOD
    nodeDisp.pushNodes(newNodes);

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
  };

  // Viewport duplication helper
  const handleViewportDuplication = (
    nodesToDuplicate: Node[],
    fromContextMenu = false
  ) => {
    const allClonedNodes: Node[] = [];
    const rootClonedNodes: Node[] = [];
    let firstDuplicateId = null;

    nodesToDuplicate.forEach((node) => {
      const { rootClone, allClones } = cloneNode(node, nodeState.nodes);
      rootClonedNodes.push(rootClone);
      allClonedNodes.push(...allClones);

      // Store the first duplicate's ID
      if (!firstDuplicateId) {
        firstDuplicateId = rootClone.id;
      }

      copyDimensions(node, rootClone);
    });

    // Insert root nodes
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
        // If from context menu, insert after the original node
        const targetIndex = fromContextMenu ? originalIndex + 1 : originalIndex;
        nodeDisp.insertAtIndex(
          rootClone,
          targetIndex,
          rootClone.parentId,
          dragState
        );
      }
    });

    // Insert child nodes
    const childNodes = allClonedNodes.filter(
      (node) => !rootClonedNodes.includes(node)
    );
    childNodes.forEach((childNode) => {
      nodeDisp.insertAtIndex(childNode, 0, childNode.parentId, dragState);

      const originalParentId = nodesToDuplicate.find(
        (n) =>
          allClonedNodes.find((clone) => clone.id === childNode.parentId)
            ?.type === n.type
      )?.id;

      if (originalParentId) {
        const originalChildren = getAllChildNodes(
          originalParentId,
          nodeState.nodes
        );
        const originalChild = originalChildren.find(
          (child) => child.type === childNode.type
        );

        if (originalChild) {
          copyDimensions(originalChild, childNode);
        }
      }
    });

    nodeDisp.syncViewports();

    return firstDuplicateId;
  };

  const handleCopy = () => {
    const selectedNodes = dragState.selectedIds
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
      dragDisp.clearSelection();
      newNodeIds.forEach((id) => dragDisp.addToSelection(id));
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
