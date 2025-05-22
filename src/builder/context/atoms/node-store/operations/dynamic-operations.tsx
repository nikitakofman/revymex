import { nanoid } from "nanoid";
import {
  batchNodeUpdates,
  getCurrentNodes,
  markNodeAsTopLevelDynamic,
  nodeDynamicInfoAtom,
  NodeId,
  nodeStore,
  updateNodeDynamicInfo,
} from "..";
import {
  _internalDynamicStateAtom,
  dynamicOps,
  dynamicStore,
} from "../../dynamic-store";
import { createNodeInStore } from "./global-operations";
import { addNode } from "./insert-operations";
import { updateNodeFlags } from "./update-operations";
import { childrenMapAtom, hierarchyStore } from "../hierarchy-store";
/**
 * Creates a variant from a specific node across all viewports with full syncing across viewports
 * @param sourceNodeId ID of the node to create variants for (base or variant)
 * @param activeViewportId Current active viewport ID in dynamic mode
 * @param positionInfo Optional position information for exact button positioning
 * @returns ID of the variant created in the current viewport
 */
export function createDynamicVariant(
  sourceNodeId: NodeId,
  activeViewportId: NodeId,
  positionInfo: any = null
): NodeId | null {
  // 1. Get source node
  const allNodes = getCurrentNodes();
  const sourceNode = allNodes.find((n) => n.id === sourceNodeId);

  if (!sourceNode) {
    console.error("Source node not found");
    return null;
  }

  // 2. Get the family ID this node belongs to
  const familyId = sourceNode.dynamicFamilyId || nanoid();

  // 3. Generate shared responsive ID for all new variants
  const variantResponsiveId = nanoid();

  // 4. Validate active viewport
  const currentViewportId = activeViewportId;
  if (!currentViewportId) {
    console.error("No active viewport in dynamic mode");
    return null;
  }

  // 5. Find corresponding nodes in other viewports
  const viewportToSourceMap = new Map<NodeId, NodeId>();

  // Add the source node for the current viewport
  viewportToSourceMap.set(currentViewportId, sourceNodeId);

  // Find all viewports
  const viewports = allNodes.filter((n) => n.isViewport).map((n) => n.id);

  // Find corresponding nodes in other viewports using the most reliable method
  if (sourceNode.isVariant) {
    // Source is a variant - find variants with the same variantResponsiveId
    const sourceVariantResponsiveId = sourceNode.variantResponsiveId;

    if (sourceVariantResponsiveId) {
      for (const viewport of viewports) {
        if (viewport === currentViewportId) continue; // Skip current viewport

        // Find matching variant in this viewport
        const matchingVariant = allNodes.find(
          (n) =>
            n.isVariant &&
            n.variantResponsiveId === sourceVariantResponsiveId &&
            n.dynamicViewportId === viewport
        );

        if (matchingVariant) {
          console.log(
            `Found matching variant in viewport ${viewport}: ${matchingVariant.id}`
          );
          viewportToSourceMap.set(viewport, matchingVariant.id);
        }
      }
    }
  } else {
    // Source is a base node - first try to find by sharedId
    const sharedId = sourceNode.sharedId;

    if (sharedId) {
      for (const viewport of viewports) {
        if (viewport === currentViewportId) continue; // Skip current viewport

        // Find matching node by sharedId
        const matchingNode = allNodes.find(
          (n) =>
            !n.isVariant &&
            n.isDynamic &&
            n.sharedId === sharedId &&
            n.dynamicViewportId === viewport
        );

        if (matchingNode) {
          console.log(
            `Found matching base node by sharedId in viewport ${viewport}: ${matchingNode.id}`
          );
          viewportToSourceMap.set(viewport, matchingNode.id);
        }
      }
    }

    // If some viewports still don't have a source, try by family ID
    for (const viewport of viewports) {
      if (viewportToSourceMap.has(viewport)) continue; // Skip if already found

      // Find by familyId
      const matchingNode = allNodes.find(
        (n) =>
          !n.isVariant &&
          n.isDynamic &&
          n.dynamicFamilyId === familyId &&
          n.dynamicViewportId === viewport
      );

      if (matchingNode) {
        console.log(
          `Found matching base node by familyId in viewport ${viewport}: ${matchingNode.id}`
        );
        viewportToSourceMap.set(viewport, matchingNode.id);
      }
    }
  }

  // If we still don't have sources for some viewports, warn
  if (viewportToSourceMap.size < viewports.length) {
    console.warn(
      "Could not find source nodes for all viewports. Missing:",
      viewports.filter((vp) => !viewportToSourceMap.has(vp))
    );
  }

  console.log(
    "Source nodes by viewport:",
    Object.fromEntries(viewportToSourceMap)
  );

  // 6. Create variants in each viewport that has a source node
  const variantIds = new Map<NodeId, NodeId>();

  // Keep track of all ID mappings from source to variant
  const idMappingsByViewport = new Map<NodeId, Map<NodeId, NodeId>>();

  // Check if we're in dynamic mode
  const isDynamicMode = !!dynamicOps.getState().dynamicModeNodeId;

  batchNodeUpdates(() => {
    // Process each viewport independently
    for (const [
      viewportId,
      viewportSourceId,
    ] of viewportToSourceMap.entries()) {
      console.log(
        `Creating variant in viewport ${viewportId} from source ${viewportSourceId}`
      );

      // Create a new ID mapping for this viewport
      const idMap = new Map<NodeId, NodeId>();
      idMappingsByViewport.set(viewportId, idMap);

      // Function to create a variant node with proper properties
      const createVariantNode = (
        srcId: NodeId,
        parentId: NodeId | null,
        isRoot: boolean
      ): NodeId => {
        // Get source node data
        const src = allNodes.find((n) => n.id === srcId);
        if (!src) return null;

        // Generate new variant ID
        const variantId = nanoid();

        // CRITICAL FIX: Use the exact same shared ID as the source
        const newSharedId = src.sharedId;
        console.log(
          `Using exact shared ID ${newSharedId} from source node ${srcId}`
        );

        // Deep clone style
        let newStyle = JSON.parse(JSON.stringify(src.style || {}));

        // Update position for root variant
        if (isRoot) {
          // For root variants, position absolutely
          newStyle.position = "absolute";

          // IMPROVED: Use precise positioning when positionInfo is available
          if (positionInfo) {
            // Apply the same positioning to ALL viewports, not just the current one
            const { sourceNode, buttonPosition, dimensions } = positionInfo;

            // For other viewports, we need to find the corresponding source node
            // to get its position and dimensions
            const viewportSourceNode =
              viewportId === currentViewportId
                ? sourceNode
                : getCorrespondingSourceNodeStyle(viewportId);

            // If we have a corresponding node in this viewport, use its position
            if (viewportSourceNode) {
              // Parse numeric values from the source node
              const sourceLeft = parseInt(viewportSourceNode.left) || 0;
              const sourceTop = parseInt(viewportSourceNode.top) || 0;
              const sourceWidth = parseInt(viewportSourceNode.width) || 0;
              const sourceHeight = parseInt(viewportSourceNode.height) || 0;

              // Use the same position type for consistent placement across viewports
              const { position: buttonPos, padding } = buttonPosition;

              // Log viewport-specific positioning
              console.log(
                `Positioning variant in viewport ${viewportId} using button at ${buttonPos}`
              );

              // Calculate the exact pixel position based on the button position type
              // Apply the SAME logic across all viewports
              if (buttonPos === "right") {
                // Button is on the right of the source node
                newStyle.left = `${sourceLeft + sourceWidth + padding}px`;

                // If centered vertically, align centers
                newStyle.top = `${
                  sourceTop + sourceHeight / 2 - dimensions.elementHeight / 2
                }px`;
              } else if (buttonPos === "left") {
                // Button is on the left of the source node
                newStyle.left = `${
                  sourceLeft - dimensions.elementWidth - padding
                }px`;

                // If centered vertically, align centers
                newStyle.top = `${
                  sourceTop + sourceHeight / 2 - dimensions.elementHeight / 2
                }px`;
              } else if (buttonPos === "bottom") {
                // Button is below the source node
                newStyle.top = `${sourceTop + sourceHeight + padding}px`;

                // If centered horizontally, align centers
                newStyle.left = `${
                  sourceLeft + sourceWidth / 2 - dimensions.elementWidth / 2
                }px`;
              } else if (buttonPos === "top") {
                // Button is above the source node
                newStyle.top = `${
                  sourceTop - dimensions.elementHeight - padding
                }px`;

                // If centered horizontally, align centers
                newStyle.left = `${
                  sourceLeft + sourceWidth / 2 - dimensions.elementWidth / 2
                }px`;
              }

              console.log(
                `Setting variant position in viewport ${viewportId} to left=${newStyle.left}, top=${newStyle.top}`
              );
            } else {
              // No corresponding node found in this viewport - fall back to default positioning
              console.log(
                `No corresponding node found in viewport ${viewportId}, using default positioning`
              );
              applyDefaultPositioning();
            }
          } else {
            // No position info provided - use default positioning
            applyDefaultPositioning();
          }

          // Helper function for default positioning - extracted to avoid code duplication
          function applyDefaultPositioning() {
            if (src.style?.position === "absolute") {
              // Offset from existing absolute position
              const leftVal = parseInt(src.style.left as string) || 0;
              const topVal = parseInt(src.style.top as string) || 0;
              newStyle.left = `${leftVal + 20}px`;
              newStyle.top = `${topVal + 20}px`;
            } else {
              // Position near center of viewport
              const viewport = allNodes.find((n) => n.id === viewportId);
              if (viewport?.style) {
                const viewportWidth =
                  parseInt(viewport.style.width as string) || 1000;
                const viewportHeight =
                  parseInt(viewport.style.height as string) || 1000;
                newStyle.left = `${Math.max(20, viewportWidth / 3)}px`;
                newStyle.top = `${Math.max(20, viewportHeight / 3)}px`;
              } else {
                // Fallback positioning
                newStyle.left = "100px";
                newStyle.top = "100px";
              }
            }
          }

          // Helper function to find corresponding source node in other viewports
          function getCorrespondingSourceNodeStyle(viewportId) {
            // Find the source node ID for this viewport
            const viewportSourceId = viewportToSourceMap.get(viewportId);
            if (!viewportSourceId) return null;

            // Get the source node
            const viewportSource = allNodes.find(
              (n) => n.id === viewportSourceId
            );
            if (!viewportSource) return null;

            // Return style and dimension info mimicking the original sourceNode format
            return {
              id: viewportSource.id,
              left: viewportSource.style?.left || "0px",
              top: viewportSource.style?.top || "0px",
              width: viewportSource.style?.width || "auto",
              height: viewportSource.style?.height || "auto",
              position: viewportSource.style?.position || "relative",
            };
          }
        }

        // When creating a variant in dynamic mode, we need a special parent handling
        const effectiveParentId = isDynamicMode && isRoot ? null : parentId;

        // Create the node with proper properties
        // IMPORTANT: Explicitly set isTopLevelDynamicNode for root variants
        const nodeProperties = {
          ...JSON.parse(JSON.stringify(src)), // Deep clone base properties
          id: variantId,
          parentId: effectiveParentId,
          style: newStyle,
          sharedId: newSharedId,
          isDynamic: true,
          isVariant: true,
          isTopLevelDynamicNode: isRoot, // Important: Always set this for root variants
          dynamicFamilyId: familyId,
          dynamicViewportId: viewportId,
          variantParentId: srcId,
          variantResponsiveId: variantResponsiveId,
          // Ensure inViewport is false if we're placing directly on canvas
          inViewport: !(isDynamicMode && isRoot),
        };

        // Create the node in the store
        createNodeInStore(nodeProperties);

        // Add to parent
        addNode(variantId, effectiveParentId);

        // CRITICAL FIX: For root variants, explicitly set isTopLevelDynamicNode using the node store directly
        if (isRoot) {
          console.log(
            `Setting isTopLevelDynamicNode=true for variant ${variantId} in viewport ${viewportId}`
          );

          // Use updateNodeDynamicInfo function from node-store
          updateNodeDynamicInfo(variantId, {
            isTopLevelDynamicNode: true,
          });

          // Also use updateNodeFlags to ensure other flags are properly set
          updateNodeFlags(variantId, {
            isDynamic: true,
            isVariant: true,
          });

          // Extra step: Use markNodeAsTopLevelDynamic helper function for additional safety
          markNodeAsTopLevelDynamic(variantId, true);
        }

        // CRITICAL FIX: Store dynamic state differently for variants vs base nodes
        if (isDynamicMode && isRoot) {
          // For variants, we need special handling
          // Store the original state but DON'T add to the detached nodes set
          // This way, variants won't be restored when exiting dynamic mode

          // First, store original state for the variant to track its position and state
          const originalState = {
            parentId: effectiveParentId,
            inViewport: false, // Variants will remain detached after exiting dynamic mode
            position: newStyle.position || "absolute",
            left: newStyle.left || "",
            top: newStyle.top || "",
            zIndex: newStyle.zIndex || "",
          };

          // Store this in the dynamic state atom without adding to detached nodes
          dynamicStore.set(_internalDynamicStateAtom, (prev) => {
            const storedNodePositions = { ...prev.storedNodePositions };
            const originalParents = { ...prev.originalParents };

            storedNodePositions[variantId] = {
              position: newStyle.position,
              left: newStyle.left,
              top: newStyle.top,
            };

            originalParents[variantId] = {
              parentId: effectiveParentId,
              inViewport: false, // Important: keep variants detached
              originalPosition: newStyle.position || "absolute",
              originalLeft: newStyle.left || "",
              originalTop: newStyle.top || "",
              originalZIndex: newStyle.zIndex || "",
            };

            // Note: We're intentionally NOT adding to detachedNodes
            // This prevents automatic restoration when exiting dynamic mode

            return {
              ...prev,
              storedNodePositions,
              originalParents,
            };
          });
        }

        // Track mapping from source to variant
        idMap.set(srcId, variantId);

        return variantId;
      };

      // Function to recursively duplicate children, using our current variant as the new parent
      const duplicateChildren = (sourceId: NodeId, newParentId: NodeId) => {
        // CRITICAL FIX 2: Get children more reliably
        const children =
          hierarchyStore.get(childrenMapAtom).get(sourceId) || [];

        if (children.length > 0) {
          console.log(
            `Duplicating ${children.length} children of ${sourceId} under ${newParentId}`
          );
        }

        // Process each child
        for (const childId of children) {
          // Create a variant of this child with the new parent
          const childVariantId = createVariantNode(childId, newParentId, false);

          if (childVariantId) {
            // Recursively handle this child's children
            duplicateChildren(childId, childVariantId);
          }
        }
      };

      // Create the root variant
      const rootParentId = isDynamicMode ? null : viewportId;
      const rootVariantId = createVariantNode(
        viewportSourceId,
        rootParentId,
        true // Always true for root variants
      );

      // Store the root variant ID for this viewport
      if (rootVariantId) {
        variantIds.set(viewportId, rootVariantId);

        // Double-check that the top-level node has isTopLevelDynamicNode set
        // Use multiple approaches to ensure it gets set properly

        // 1. Direct update via nodeDynamicInfoAtom using nodeStore
        nodeStore.set(nodeDynamicInfoAtom(rootVariantId), (prev) => ({
          ...prev,
          isTopLevelDynamicNode: true,
        }));

        // 2. Use updateNodeFlags for flags
        updateNodeFlags(rootVariantId, {
          isTopLevelDynamicNode: true,
          isDynamic: true,
          isVariant: true,
        });

        // 3. Use helper function for specialized updates
        markNodeAsTopLevelDynamic(rootVariantId, true);

        // CRITICAL FIX 3: ALWAYS duplicate children, unconditionally
        console.log(
          `Duplicating children for variant ${rootVariantId} in viewport ${viewportId}`
        );
        duplicateChildren(viewportSourceId, rootVariantId);
      }
    }
  });

  // Return the variant created in current viewport
  return variantIds.get(currentViewportId) || null;
}

export function addUniqueConnection(
  sourceId: NodeId,
  targetId: NodeId,
  connectionType: "click" | "hover" | "mouseLeave"
): boolean {
  // Get current nodes to verify they exist and are part of a dynamic family
  const allNodes = getCurrentNodes();
  const sourceNode = allNodes.find((n) => n.id === sourceId);
  const targetNode = allNodes.find((n) => n.id === targetId);

  // Verify both nodes exist
  if (!sourceNode || !targetNode) {
    console.error("Connection failed: Source or target node not found");
    return false;
  }

  console.log("sourceNode:", sourceNode);
  console.log("targetNode:", targetNode);

  // SOURCE can be any node in a dynamic family
  if (!sourceNode.dynamicFamilyId) {
    console.error(
      "Connection failed: Source node is not part of a dynamic family"
    );
    return false;
  }

  // TARGET must be a top-level dynamic node
  if (!targetNode.isTopLevelDynamicNode) {
    console.error(
      "Connection failed: Target node is not a top-level dynamic node"
    );
    return false;
  }

  // Check if identical connection already exists (same type between same nodes)
  const existingConnections = sourceNode.dynamicConnections || [];
  const duplicateConnection = existingConnections.find(
    (conn) => conn.targetId === targetId && conn.type === connectionType
  );

  if (duplicateConnection) {
    console.log(
      `Connection of type ${connectionType} already exists, not adding duplicate`
    );
    return false;
  }

  // IMPROVED: Check for and remove any existing connection of the same type
  // This allows replacing a connection of the same type
  const filteredConnections = existingConnections.filter(
    (conn) => !(conn.targetId === targetId && conn.type === connectionType)
  );

  // Create the new connection
  const newConnection = {
    sourceId,
    targetId,
    type: connectionType,
  };

  // Update the dynamic info with the new connection
  batchNodeUpdates(() => {
    nodeStore.set(nodeDynamicInfoAtom(sourceId), (prev) => {
      return {
        ...prev,
        dynamicConnections: [...filteredConnections, newConnection],
      };
    });
  });

  console.log(
    `Added ${connectionType} connection from ${sourceId} to ${targetId}`
  );
  return true;
}
