import { original, produce } from "immer";
import { nanoid } from "nanoid";
import { CSSProperties } from "react";
import { findParentViewport } from "../context/utils";

export interface Position {
  x: number;
  y: number;
}

export interface VariantInfo {
  name: string;
  id: string;
}

export interface Node {
  id: string;
  type: "frame" | "image" | "text" | "placeholder" | string;
  customName?: string;
  dynamicState?: {
    hovered?: CSSProperties & {
      src?: string;
      text?: string;
      backgroundImage?: string;
      isVideoBackground?: boolean;
      backgroundVideo?: string;
    };
  };
  style: CSSProperties & {
    src?: string;
    text?: string;
    backgroundImage?: string;
    isVideoBackground?: boolean;
    backgroundVideo?: string;
  };
  isLocked?: boolean;
  sharedId?: string;
  independentStyles?: {
    [styleProperty: string]: boolean;
  };
  src?: string;
  text?: string;
  parentId?: string | number | null;
  position?: Position;
  inViewport?: boolean;
  isViewport?: boolean;
  viewportName?: string;
  viewportWidth?: number;
  isDynamic?: boolean;
  dynamicParentId?: string | number;
  dynamicViewportId?: string | number;
  dynamicConnections?: {
    sourceId: string | number;
    targetId: string | number;
    type: "click" | "hover" | "mouseLeave";
  }[];
  dynamicPosition?: Position;
  originalState?: {
    parentId: string | number | null;
    inViewport: boolean;
  };
  isAbsoluteInFrame?: boolean;
  isVariant?: boolean;
  variantParentId?: string | number;
  variantInfo?: VariantInfo;
  dynamicFamilyId?: string;
  originalParentId?: string;
}

export interface NodeState {
  nodes: Node[];
}

export interface SetStateOptions {
  skipHistory?: boolean;
  batch?: boolean;
}

export class NodeDispatcher {
  constructor(
    private setState: React.Dispatch<React.SetStateAction<NodeState>>
  ) {}

  addNode(
    node: Node,
    targetId: string | number | null,
    position: "before" | "after" | "inside" | null,
    shouldBeInViewport: boolean
  ) {
    // Track if we need to sync this node after adding
    let needsSync = false;
    let targetIsDynamic = false;

    this.setState((prev) =>
      produce(prev, (draft) => {
        // Ensure node has a sharedId if it's going to be in a viewport
        const newNode = {
          ...node,
          inViewport: shouldBeInViewport,
          sharedId:
            shouldBeInViewport && !node.sharedId ? nanoid() : node.sharedId,
        };

        // Continue with the existing logic...
        if (!targetId) {
          newNode.parentId = null;
          draft.nodes.push(newNode);
          return;
        }

        // Clean up incompatible properties based on node type
        if (newNode.type === "image") {
          // Remove text property from image nodes
          if (newNode.style.text) delete newNode.style.text;
          if (newNode.text) delete newNode.text;
        } else if (newNode.type === "text") {
          // Remove src property from text nodes
          if (newNode.style.src) delete newNode.style.src;
          if (newNode.src) delete newNode.src;
        }

        const targetIndex = draft.nodes.findIndex((n) => n.id === targetId);
        if (targetIndex === -1) {
          newNode.parentId = null;
          draft.nodes.push(newNode);
          return;
        }

        const targetNode = draft.nodes[targetIndex];

        targetIsDynamic =
          targetNode.isDynamic ||
          targetNode.isVariant ||
          targetNode.dynamicFamilyId ||
          (targetNode.isVariant && targetNode.dynamicParentId);

        // Check if we're adding to a dynamic node or variant
        if (
          position === "inside" &&
          (targetNode.isDynamic ||
            (targetNode.isVariant && targetNode.dynamicParentId))
        ) {
          // Mark for synchronization after state update
          needsSync = true;
        }

        if (position === "inside") {
          newNode.parentId = targetNode.id;
          draft.nodes.push(newNode);
          return;
        }

        newNode.parentId = targetNode.parentId;

        const siblingInfo = draft.nodes
          .map((n, idx) => ({ node: n, index: idx }))
          .filter((obj) => obj.node.parentId === targetNode.parentId);

        const siblingIndex = siblingInfo.findIndex(
          (obj) => obj.node.id === targetId
        );

        if (siblingIndex === -1) {
          draft.nodes.push(newNode);
          return;
        }

        const insertGlobalIndex =
          position === "after"
            ? siblingInfo[siblingIndex].index + 1
            : siblingInfo[siblingIndex].index;

        draft.nodes.splice(insertGlobalIndex, 0, newNode);
      })
    );
  }

  /**
   * Helper method to access node state
   */
  private getNodeState(): NodeState {
    let state: NodeState = { nodes: [] };
    this.setState((prev) => {
      state = prev;
      return prev;
    });
    return state;
  }

  updateNodeStyle(nodeIds: (string | number)[], style: Partial<CSSProperties>) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const nodesToUpdate = draft.nodes.filter((n) => nodeIds.includes(n.id));
        if (nodesToUpdate.length === 0) return;

        const positioningStyles: Partial<CSSProperties> = {};
        const dimensionStyles: Partial<CSSProperties> = {};
        const otherStyles: Partial<CSSProperties> = {};

        Object.entries(style).forEach(([key, value]) => {
          if (["left", "top", "right", "bottom", "position"].includes(key)) {
            positioningStyles[key] = value;
          } else if (["width", "height"].includes(key)) {
            dimensionStyles[key] = value;
          } else {
            otherStyles[key] = value;
          }
        });

        const processedNodes = new Set<string | number>();

        // Set of viewports directly updated
        const updatedViewportIds = new Set();
        nodesToUpdate.forEach((node) => {
          const viewportId =
            findParentViewport(node.parentId, draft.nodes) ||
            node.dynamicViewportId;
          if (viewportId) {
            updatedViewportIds.add(viewportId);
          }
        });

        nodesToUpdate.forEach((node) => {
          if (processedNodes.has(node.id)) return;
          processedNodes.add(node.id);

          const nodeViewportId =
            findParentViewport(node.parentId, draft.nodes) ||
            node.dynamicViewportId;

          if (!node.independentStyles) {
            node.independentStyles = {};
          }

          const isBaseNode = node.isDynamic;
          const isVariant = node.isVariant && node.variantInfo?.id;

          // Mark as independent if in a non-desktop viewport
          if (nodeViewportId && nodeViewportId !== "viewport-1440") {
            [
              ...Object.keys(positioningStyles),
              ...Object.keys(dimensionStyles),
              ...Object.keys(otherStyles),
            ].forEach((prop) => {
              node.independentStyles![prop] = true;
            });
          }

          Object.assign(node.style, positioningStyles);
          Object.assign(node.style, dimensionStyles);
          Object.assign(node.style, otherStyles);

          const changedProps = [
            ...Object.keys(positioningStyles),
            ...Object.keys(dimensionStyles),
            ...Object.keys(otherStyles),
          ];

          if (nodeViewportId && nodeViewportId !== "viewport-1440") {
            // Only proceed if there are same-width viewports
            const sameWidthViewports = findSameWidthViewports(
              nodeViewportId,
              draft.nodes
            );
            if (sameWidthViewports.length === 0) {
              return;
            }
          }

          if (node.sharedId) {
            const sameTypeNodesAcrossViewports = draft.nodes.filter((n) => {
              if (n.id === node.id) return false;
              if (n.sharedId !== node.sharedId) return false;

              if (isBaseNode && !n.isDynamic) return false;

              if (isVariant) {
                if (!n.isVariant) return false;
                return n.variantInfo?.id === node.variantInfo?.id;
              }

              // Skip nodes with independent styles when updating from desktop
              if (nodeViewportId === "viewport-1440") {
                const hasIndependentStyle = changedProps.some(
                  (prop) => n.independentStyles && n.independentStyles[prop]
                );
                if (hasIndependentStyle) return false;
              }

              // When updating from non-desktop, ONLY include nodes from the same viewport
              if (nodeViewportId !== "viewport-1440") {
                const nViewportId =
                  findParentViewport(n.parentId, draft.nodes) ||
                  n.dynamicViewportId;

                // Only include if it's in the EXACT SAME viewport we're updating
                return nViewportId === nodeViewportId;
              }

              return true;
            });

            sameTypeNodesAcrossViewports.forEach((relatedNode) => {
              if (processedNodes.has(relatedNode.id)) return;
              processedNodes.add(relatedNode.id);

              const relatedViewportId =
                findParentViewport(relatedNode.parentId, draft.nodes) ||
                relatedNode.dynamicViewportId;

              const shouldSkipPositioning =
                isVariant && relatedViewportId === "viewport-1440";

              const propsToSync = shouldSkipPositioning
                ? changedProps.filter(
                    (p) =>
                      !["left", "top", "right", "bottom", "position"].includes(
                        p
                      )
                  )
                : changedProps;

              propsToSync.forEach((prop) => {
                if (
                  relatedNode.independentStyles &&
                  relatedNode.independentStyles[prop]
                ) {
                  return;
                }

                if (prop in style && style[prop] !== undefined) {
                  relatedNode.style[prop] = style[prop];

                  // Mark as independent ONLY if in a non-desktop viewport AND
                  // only if the viewport is in our directly updated set
                  if (
                    relatedViewportId &&
                    relatedViewportId !== "viewport-1440" &&
                    updatedViewportIds.has(relatedViewportId)
                  ) {
                    if (!relatedNode.independentStyles) {
                      relatedNode.independentStyles = {};
                    }
                    relatedNode.independentStyles[prop] = true;
                  }
                }
              });
            });
          }

          if (isBaseNode) {
            const allRelatedVariants = draft.nodes.filter(
              (n) =>
                n.isVariant &&
                n.dynamicFamilyId === node.dynamicFamilyId &&
                (n.dynamicParentId === node.id ||
                  n.variantParentId === node.id ||
                  (node.sharedId &&
                    n.dynamicParentId &&
                    draft.nodes.some(
                      (baseNode) =>
                        baseNode.id === n.dynamicParentId &&
                        baseNode.sharedId === node.sharedId
                    )))
            );

            allRelatedVariants.forEach((variant) => {
              if (processedNodes.has(variant.id)) return;
              processedNodes.add(variant.id);

              const variantViewportId =
                findParentViewport(variant.parentId, draft.nodes) ||
                variant.dynamicViewportId;

              const propsToSync =
                !variantViewportId || variantViewportId === "viewport-1440"
                  ? changedProps.filter(
                      (p) =>
                        ![
                          "left",
                          "top",
                          "right",
                          "bottom",
                          "position",
                        ].includes(p)
                    )
                  : changedProps;

              propsToSync.forEach((prop) => {
                if (
                  variant.independentStyles &&
                  variant.independentStyles[prop]
                ) {
                  return;
                }

                if (prop in style && style[prop] !== undefined) {
                  variant.style[prop] = style[prop];
                }
              });

              const dimensionPropsUpdated =
                Object.keys(dimensionStyles).length > 0;

              if (dimensionPropsUpdated) {
                const variantChildren = draft.nodes.filter(
                  (n) => n.parentId === variant.id
                );

                variantChildren.forEach((child) => {
                  if (!child.sharedId) return;

                  const baseChild = draft.nodes.find(
                    (n) =>
                      n.parentId === node.id && n.sharedId === child.sharedId
                  );

                  if (baseChild && !processedNodes.has(child.id)) {
                    if (
                      !(
                        child.independentStyles && child.independentStyles.width
                      ) &&
                      !(
                        child.independentStyles &&
                        child.independentStyles.height
                      )
                    ) {
                      if (child.style.width !== baseChild.style.width) {
                        child.style.width = baseChild.style.width;
                      }
                      if (child.style.height !== baseChild.style.height) {
                        child.style.height = baseChild.style.height;
                      }

                      // CRITICAL FIX: Make sure children maintain relative positioning
                      // This ensures children don't get detached from their parent
                      if (child.style.position !== "relative") {
                        child.style.position = "relative";
                        child.style.left = "";
                        child.style.top = "";
                      }

                      processedNodes.add(child.id);
                    }
                  }
                });
              }
            });
          }

          if (isVariant) {
            changedProps.forEach((prop) => {
              node.independentStyles![prop] = true;
            });
          }

          if (node.parentId) {
            const parentNode = draft.nodes.find((n) => n.id === node.parentId);
            if (!parentNode) return;

            if (
              (parentNode.isDynamic || parentNode.isVariant) &&
              node.sharedId
            ) {
              if (parentNode.isVariant) {
                changedProps.forEach((prop) => {
                  node.independentStyles![prop] = true;
                });
              }

              const relatedParents = draft.nodes.filter((n) => {
                if (n.id === parentNode.id) return false;

                if (parentNode.isDynamic) {
                  return n.isDynamic && n.sharedId === parentNode.sharedId;
                }

                if (parentNode.isVariant && parentNode.variantInfo?.id) {
                  return (
                    n.isVariant &&
                    n.variantInfo?.id === parentNode.variantInfo.id
                  );
                }

                return false;
              });

              relatedParents.forEach((relatedParent) => {
                const relatedChild = draft.nodes.find(
                  (n) =>
                    n.parentId === relatedParent.id &&
                    n.sharedId === node.sharedId
                );

                if (relatedChild && !processedNodes.has(relatedChild.id)) {
                  processedNodes.add(relatedChild.id);

                  const childViewportId =
                    findParentViewport(relatedChild.parentId, draft.nodes) ||
                    relatedChild.dynamicViewportId;

                  if (
                    nodeViewportId !== "viewport-1440" &&
                    childViewportId !== nodeViewportId
                  ) {
                    return;
                  }

                  const dimensionsShouldSync =
                    !(relatedParent.isVariant && parentNode.isDynamic) &&
                    !(relatedParent.isDynamic && parentNode.isVariant);

                  const safeChildProps = dimensionsShouldSync
                    ? changedProps
                    : changedProps.filter(
                        (p) => !["width", "height"].includes(p)
                      );

                  safeChildProps.forEach((prop) => {
                    if (
                      relatedChild.independentStyles &&
                      relatedChild.independentStyles[prop]
                    ) {
                      return;
                    }

                    if (prop in style && style[prop] !== undefined) {
                      relatedChild.style[prop] = style[prop];

                      // Mark as independent ONLY if in a viewport we're directly updating
                      if (
                        childViewportId &&
                        childViewportId !== "viewport-1440" &&
                        updatedViewportIds.has(childViewportId)
                      ) {
                        if (!relatedChild.independentStyles) {
                          relatedChild.independentStyles = {};
                        }
                        relatedChild.independentStyles[prop] = true;
                      }
                    }
                  });

                  // CRITICAL FIX: Ensure children of variants maintain relative positioning
                  // This prevents them from becoming detached from their parent
                  if (
                    relatedParent.isVariant &&
                    relatedChild.style.position !== "relative"
                  ) {
                    relatedChild.style.position = "relative";
                    relatedChild.style.left = "";
                    relatedChild.style.top = "";
                  }
                }
              });
            }
          }
        });

        function findSameWidthViewports(
          viewportId: string | number,
          allNodes: Node[]
        ): (string | number)[] {
          const viewport = allNodes.find((n) => n.id === viewportId);
          if (!viewport || !viewport.viewportWidth) return [];

          return allNodes
            .filter(
              (n) =>
                n.isViewport &&
                n.viewportWidth === viewport.viewportWidth &&
                n.id !== viewportId
            )
            .map((n) => n.id);
        }

        function isParentVariant(
          parentId: string | number,
          allNodes: Node[]
        ): boolean {
          const parent = allNodes.find((n) => n.id === parentId);
          return parent ? parent.isVariant : false;
        }

        function isParentDynamic(
          parentId: string | number,
          allNodes: Node[]
        ): boolean {
          const parent = allNodes.find((n) => n.id === parentId);
          return parent ? parent.isDynamic : false;
        }

        function findParentViewport(
          nodeId: string | number | null | undefined,
          allNodes: Node[]
        ): string | number | null {
          if (!nodeId) return null;
          const node = allNodes.find((n) => n.id === nodeId);
          if (!node) return null;
          if (node.isViewport) return node.id;
          return node.parentId
            ? findParentViewport(node.parentId, allNodes)
            : null;
        }

        // CRITICAL FIX: Final pass to fix any detached children
        draft.nodes.forEach((node) => {
          // Only process nodes that are children of variants
          const parent = node.parentId
            ? draft.nodes.find((n) => n.id === node.parentId)
            : null;
          if (parent && parent.isVariant) {
            // If this is a child of a variant but has absolute positioning
            if (node.style.position === "absolute" && node.sharedId) {
              // Reset it to relative positioning
              node.style.position = "relative";
              node.style.left = "";
              node.style.top = "";

              // Mark these properties as independent
              if (!node.independentStyles) {
                node.independentStyles = {};
              }
              node.independentStyles.position = true;
              node.independentStyles.left = true;
              node.independentStyles.top = true;
            }
          }
        });
      })
    );
  }

  syncVariants(nodeId) {
    console.log("----------- SYNC VARIANTS START -----------");
    console.log(`syncVariants called with nodeId: ${nodeId}`);

    // First, get the current state to analyze what needs to be done
    let currentState = this.getNodeState();

    // Find the node and its parent
    const node = currentState.nodes.find((n) => n.id === nodeId);
    if (!node) {
      console.log("❌ Node not found:", nodeId);
      return;
    }
    console.log(`🔍 Found node ${nodeId}:`, {
      type: node.type,
      sharedId: node.sharedId,
      parentId: node.parentId,
      isDynamic: node.isDynamic,
      isVariant: node.isVariant,
    });

    const parentNode = currentState.nodes.find((n) => n.id === node.parentId);
    if (!parentNode) {
      console.log("❌ Parent node not found for:", node.id);
      return;
    }
    console.log(`🔍 Found parent node ${parentNode.id}:`, {
      type: parentNode.type,
      sharedId: parentNode.sharedId,
      parentId: parentNode.parentId,
      isDynamic: parentNode.isDynamic,
      isVariant: parentNode.isVariant,
    });

    // Find the dynamic root - the topmost dynamic parent in the hierarchy
    let dynamicRoot = parentNode;
    let ancestorChain = [];

    // Traverse up to find the root dynamic node
    console.log("🔍 Traversing up to find dynamic root...");
    while (dynamicRoot && !dynamicRoot.isDynamic) {
      console.log(
        `  Checking node ${dynamicRoot.id} (isDynamic: ${dynamicRoot.isDynamic})`
      );
      if (dynamicRoot.parentId) {
        ancestorChain.push(dynamicRoot);
        const parent = currentState.nodes.find(
          (n) => n.id === dynamicRoot.parentId
        );
        if (!parent) {
          console.log("  ❌ No parent found, breaking chain");
          break;
        }
        console.log(`  Moving up to parent ${parent.id}`);
        dynamicRoot = parent;
      } else {
        console.log("  ❌ No parentId, breaking chain");
        break;
      }
    }

    // If we didn't find a dynamic root, use the immediate parent
    if (!dynamicRoot.isDynamic) {
      console.log(
        `⚠️ No dynamic root found, using immediate parent ${parentNode.id}`
      );
      dynamicRoot = parentNode;
      ancestorChain = [];
    } else {
      console.log(`✅ Found dynamic root: ${dynamicRoot.id}`);
    }

    // Get the dynamicFamilyId from the root
    const familyId = dynamicRoot.dynamicFamilyId;
    if (!familyId) {
      console.log("❌ No dynamicFamilyId found, cannot sync");
      return;
    }

    console.log(
      `📊 Dynamic root: ${dynamicRoot.id} with familyId: ${familyId}`
    );
    console.log(`📊 Ancestor chain length: ${ancestorChain.length}`);
    if (ancestorChain.length > 0) {
      console.log(
        "📊 Ancestor chain:",
        ancestorChain.map((a) => ({
          id: a.id,
          sharedId: a.sharedId,
          type: a.type,
        }))
      );
    }

    // Now do the actual state update with precise targeting
    this.setState((prev) =>
      produce(prev, (draft) => {
        console.log("🔄 Starting state update...");

        // Ensure node has a sharedId
        const draftNode = draft.nodes.find((n) => n.id === nodeId);
        if (!draftNode) {
          console.log("❌ Node not found in draft state");
          return;
        }

        if (!draftNode.sharedId) {
          draftNode.sharedId = nanoid();
          console.log(`✅ Generated new sharedId: ${draftNode.sharedId}`);
        }

        // Helper function to find the parent viewport of a node
        const findParentViewport = (nodeId, nodes) => {
          // Start with the node itself
          let current = nodes.find((n) => n.id === nodeId);
          if (!current) return null;

          // For variants, use their explicit dynamicViewportId if available
          if (current.dynamicViewportId) {
            return current.dynamicViewportId;
          }

          // Walk up the parent chain
          while (current) {
            if (current.parentId) {
              const parent = nodes.find((n) => n.id === current.parentId);
              if (!parent) break;

              if (parent.isViewport) {
                return parent.id;
              }

              current = parent;
            } else {
              break;
            }
          }

          return null;
        };

        // Find all base dynamic and variant nodes in the family
        const allDynamicRoots = draft.nodes.filter(
          (n) => n.dynamicFamilyId === familyId && n.isDynamic
        );
        console.log(
          `📊 Found ${allDynamicRoots.length} dynamic roots in family`
        );
        allDynamicRoots.forEach((root, i) => {
          console.log(
            `  Dynamic root ${i + 1}: ${root.id} (viewport: ${
              root.dynamicViewportId || "none"
            })`
          );
        });

        const allVariants = draft.nodes.filter(
          (n) =>
            n.dynamicFamilyId === familyId && n.isVariant && n.parentId === null
        );
        console.log(`📊 Found ${allVariants.length} variants in family`);
        allVariants.forEach((variant, i) => {
          console.log(
            `  Variant ${i + 1}: ${variant.id} (variantInfo: ${
              variant.variantInfo?.id || "none"
            })`
          );
        });

        // CRITICAL FIX: Find and remove any incorrect duplicates before syncing again
        // This ensures no incorrect nodes remain from previous syncs
        const removeIncorrectDuplicates = () => {
          // Find all nodes with the same sharedId
          const nodesWithSameSharedId = draft.nodes.filter(
            (n) => n.sharedId === draftNode.sharedId && n.id !== draftNode.id // Skip the original node
          );

          console.log(
            `🔍 Found ${nodesWithSameSharedId.length} existing nodes with same sharedId`
          );

          // For each target (dynamic root or variant), there should be at most one node with this sharedId
          [...allDynamicRoots, ...allVariants].forEach((target) => {
            // Find all nodes with this sharedId that claim to be under this target's hierarchy
            const nodesUnderTarget = nodesWithSameSharedId.filter(
              (n) =>
                n.dynamicParentId === target.id ||
                n.variantParentId === target.id ||
                // Or are children of any node under this target
                (n.parentId &&
                  draft.nodes.some(
                    (parent) =>
                      parent.id === n.parentId &&
                      (parent.dynamicParentId === target.id ||
                        parent.variantParentId === target.id)
                  ))
            );

            if (nodesUnderTarget.length > 1) {
              console.log(
                `⚠️ Found ${nodesUnderTarget.length} duplicate nodes for target ${target.id}`
              );

              // Sort nodes by parentId, keeping nodes that are direct children of the target
              const sortedNodes = [...nodesUnderTarget].sort((a, b) => {
                // Direct children of target come first
                if (a.parentId === target.id && b.parentId !== target.id)
                  return -1;
                if (a.parentId !== target.id && b.parentId === target.id)
                  return 1;
                // Otherwise sort by id for stable results
                return a.id.localeCompare(b.id);
              });

              // Keep the first node (either a direct child of target or the first in the list)
              const nodeToKeep = sortedNodes[0];
              console.log(
                `  ✅ Keeping node ${nodeToKeep.id} (parentId: ${nodeToKeep.parentId})`
              );

              // Remove all others
              for (let i = 1; i < sortedNodes.length; i++) {
                const nodeToRemove = sortedNodes[i];
                console.log(
                  `  ⚠️ Removing duplicate node ${nodeToRemove.id} (parentId: ${nodeToRemove.parentId})`
                );
                const index = draft.nodes.findIndex(
                  (n) => n.id === nodeToRemove.id
                );
                if (index !== -1) {
                  draft.nodes.splice(index, 1);
                }
              }
            }
          });
        };

        // First clean up any existing incorrect duplicates
        removeIncorrectDuplicates();

        // If we added to the root dynamic node directly, sync among all roots/variants
        if (draftNode.parentId === dynamicRoot.id) {
          console.log(`🔄 CASE: Direct child of dynamic root`);

          // Find all target roots/variants except the original
          const allTargets = [...allDynamicRoots, ...allVariants].filter(
            (target) => target.id !== dynamicRoot.id
          );
          console.log(`  📊 Found ${allTargets.length} targets to sync to`);

          allTargets.forEach((target, idx) => {
            console.log(
              `  🔄 Processing target ${idx + 1}: ${target.id} (${
                target.isDynamic ? "dynamic" : "variant"
              })`
            );

            // CRITICAL FIX: Make sure we're never targeting a node that's not a top-level root/variant
            if (!target.isDynamic && !target.isVariant) {
              console.log(
                `    ⚠️ Target is neither dynamic nor variant, skipping`
              );
              return;
            }

            // Check for existing child with same sharedId
            const existingChild = draft.nodes.find(
              (n) =>
                n.parentId === target.id && n.sharedId === draftNode.sharedId
            );

            if (existingChild) {
              console.log(
                `    ⚠️ Child already exists: ${existingChild.id}, updating properties`
              );

              // Update existing child
              Object.entries(draftNode).forEach(([key, value]) => {
                if (
                  key !== "id" &&
                  key !== "parentId" &&
                  key !== "style" &&
                  key !== "independentStyles" &&
                  key !== "isVariant" &&
                  key !== "variantParentId" &&
                  key !== "variantInfo" &&
                  key !== "dynamicParentId" &&
                  key !== "dynamicViewportId"
                ) {
                  existingChild[key] = value;
                }
              });

              // Update non-independent style properties
              Object.entries(draftNode.style).forEach(
                ([styleKey, styleValue]) => {
                  if (
                    !existingChild.independentStyles ||
                    !existingChild.independentStyles[styleKey]
                  ) {
                    existingChild.style[styleKey] = styleValue;
                  }
                }
              );
            } else {
              console.log(
                `    ✅ Creating new child with parent: ${target.id}`
              );

              // Create new child
              const newChild = {
                ...draftNode,
                id: nanoid(),
                parentId: target.id, // CRITICAL FIX: Always set parentId to the top-level target
                style: { ...draftNode.style },
                independentStyles: {},
              };

              // Set the viewport ID
              const targetViewportId = findParentViewport(
                target.id,
                draft.nodes
              );
              if (targetViewportId) {
                newChild.dynamicViewportId = targetViewportId;
                console.log(`    ✅ Set viewport ID: ${targetViewportId}`);
              }

              // Set variant properties if target is a variant
              if (target.isVariant) {
                newChild.isVariant = true;
                newChild.variantParentId = target.variantParentId || target.id;
                newChild.dynamicParentId = target.dynamicParentId;
                newChild.variantInfo = target.variantInfo;
                console.log(`    ✅ Set variant properties from target`);
              }

              console.log(`    ✅ Created new child with ID: ${newChild.id}`);
              draft.nodes.push(newChild);
            }
          });
        }
        // If we added to a child of the dynamic node, we need to find corresponding parents
        else if (ancestorChain.length > 0) {
          console.log(
            `🔄 CASE: Child of a child (${ancestorChain.length} levels deep)`
          );

          // For each root/variant, follow the ancestor chain to find the corresponding parent
          const allTargetRoots = [...allDynamicRoots, ...allVariants].filter(
            (target) => target.id !== dynamicRoot.id
          );

          console.log(
            `  📊 Found ${allTargetRoots.length} target roots/variants to process`
          );

          allTargetRoots.forEach((targetRoot, rootIdx) => {
            console.log(
              `  🔄 Processing target root ${rootIdx + 1}: ${targetRoot.id} (${
                targetRoot.isDynamic ? "dynamic" : "variant"
              })`
            );

            // For debugging - check what's in the target root's hierarchy
            const targetChildren = draft.nodes.filter(
              (n) => n.parentId === targetRoot.id
            );
            console.log(
              `    📊 Target root has ${targetChildren.length} direct children`
            );

            // Start from the target root
            let targetParent = targetRoot;
            let isCorrectPath = true;

            // Follow the ancestor chain to find the corresponding parent
            for (let i = ancestorChain.length - 1; i >= 0; i--) {
              const ancestor = ancestorChain[i];

              // Find child with matching sharedId
              const childWithSharedId = draft.nodes.find(
                (n) =>
                  n.parentId === targetParent.id &&
                  n.sharedId === ancestor.sharedId
              );

              if (!childWithSharedId) {
                console.log(
                  `    ❌ Could not find matching child for ancestor: ${ancestor.id}`
                );
                isCorrectPath = false;
                break;
              }

              console.log(`    ✅ Found next parent: ${childWithSharedId.id}`);
              targetParent = childWithSharedId;
            }

            if (!isCorrectPath) {
              console.log(
                `    ❌ Could not build complete path for target: ${targetRoot.id}`
              );
              return;
            }

            console.log(`    ✅ Found final target parent: ${targetParent.id}`);

            // CRITICAL FIX: Check for existing duplicates with this shared ID
            // We need to find ALL instances under this target root, not just direct children
            const existingChildren = draft.nodes.filter(
              (n) =>
                n.sharedId === draftNode.sharedId &&
                (n.dynamicParentId === targetRoot.id ||
                  n.variantParentId === targetRoot.id)
            );

            console.log(
              `    📊 Found ${existingChildren.length} existing children with this sharedId`
            );

            if (existingChildren.length > 0) {
              // Keep only the one with the correct parent if it exists
              const correctChild = existingChildren.find(
                (n) => n.parentId === targetParent.id
              );

              if (correctChild) {
                console.log(`    ✅ Found correct child: ${correctChild.id}`);

                // Remove all others
                existingChildren.forEach((child) => {
                  if (child.id !== correctChild.id) {
                    console.log(`    ⚠️ Removing incorrect child: ${child.id}`);
                    const index = draft.nodes.findIndex(
                      (n) => n.id === child.id
                    );
                    if (index !== -1) {
                      draft.nodes.splice(index, 1);
                    }
                  }
                });

                // Update the correct child
                console.log(
                  `    🔄 Updating correct child: ${correctChild.id}`
                );
                Object.entries(draftNode).forEach(([key, value]) => {
                  if (
                    key !== "id" &&
                    key !== "parentId" &&
                    key !== "style" &&
                    key !== "independentStyles" &&
                    key !== "isVariant" &&
                    key !== "variantParentId" &&
                    key !== "variantInfo" &&
                    key !== "dynamicParentId" &&
                    key !== "dynamicViewportId"
                  ) {
                    correctChild[key] = value;
                  }
                });

                // Update non-independent style properties
                Object.entries(draftNode.style).forEach(
                  ([styleKey, styleValue]) => {
                    if (
                      !correctChild.independentStyles ||
                      !correctChild.independentStyles[styleKey]
                    ) {
                      correctChild.style[styleKey] = styleValue;
                    }
                  }
                );
              } else {
                // No child with correct parent, remove all existing and create new
                console.log(
                  `    ⚠️ No child with correct parent found, removing all and creating new`
                );
                existingChildren.forEach((child) => {
                  const index = draft.nodes.findIndex((n) => n.id === child.id);
                  if (index !== -1) {
                    draft.nodes.splice(index, 1);
                  }
                });

                // Create new below
              }
            }

            // If no correct child exists or we removed all, create a new one
            if (
              existingChildren.length === 0 ||
              !existingChildren.some((n) => n.parentId === targetParent.id)
            ) {
              console.log(
                `    ✅ Creating new child with parent: ${targetParent.id}`
              );

              // Create new child
              const newChild = {
                ...draftNode,
                id: nanoid(),
                parentId: targetParent.id,
                style: { ...draftNode.style },
                independentStyles: {},
              };

              // Set viewport ID
              const targetViewportId = findParentViewport(
                targetRoot.id,
                draft.nodes
              );
              if (targetViewportId) {
                newChild.dynamicViewportId = targetViewportId;
                console.log(`      ✅ Set viewport ID: ${targetViewportId}`);
              }

              // Inherit variant properties if appropriate
              if (targetRoot.isVariant || targetParent.isVariant) {
                newChild.isVariant = true;

                // If the target root is a variant, use its properties
                if (targetRoot.isVariant) {
                  newChild.variantParentId = targetRoot.id;
                  newChild.dynamicParentId = targetRoot.dynamicParentId;
                  newChild.variantInfo = targetRoot.variantInfo;
                }
                // If just the parent is a variant, use its properties
                else if (targetParent.isVariant) {
                  newChild.variantParentId = targetParent.variantParentId;
                  newChild.dynamicParentId = targetParent.dynamicParentId;
                  newChild.variantInfo = targetParent.variantInfo;
                }

                console.log(`      ✅ Set variant properties`);
              }

              console.log(`      ✅ Created new child with ID: ${newChild.id}`);
              draft.nodes.push(newChild);
            }
          });
        }

        console.log("----------- SYNC VARIANTS END -----------");
      })
    );
  }

  // Helper function to get all nodes in a subtree
  getSubtree2(nodes: Node[], rootId: string | number): Node[] {
    const result: Node[] = [];

    // Add the root node
    const rootNode = nodes.find((n) => n.id === rootId);
    if (rootNode) {
      result.push(rootNode);
    }

    // Breadth-first traversal to find all descendants
    const queue = [rootId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = nodes.filter((n) => n.parentId === currentId);

      for (const child of children) {
        result.push(child);
        queue.push(child.id);
      }
    }

    return result;
  }
  /**
   * Synchronizes a node to all variants across all viewports without duplication.
   * This implementation properly handles the entire hierarchical tree while preventing duplicate elements.
   */
  syncDynamicChildren(nodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the node we're trying to sync
        const node = draft.nodes.find((n) => n.id === nodeId);
        if (!node) {
          console.warn("Node not found:", nodeId);
          return;
        }

        // Find the parent node
        const parentId = node.parentId;
        if (!parentId) {
          console.warn("Node has no parent:", nodeId);
          return;
        }

        const parentNode = draft.nodes.find((n) => n.id === parentId);
        if (!parentNode) {
          console.warn("Parent node not found:", parentId);
          return;
        }

        console.log("Syncing node:", node.id, "in parent:", parentNode.id);

        // Ensure the node has a sharedId
        if (!node.sharedId) {
          node.sharedId = nanoid();
          console.log("Assigned new sharedId:", node.sharedId);
        }

        // STEP 1: Find the root dynamic node of the entire tree
        const rootDynamicId = findRootDynamicNode(parentNode, draft.nodes);
        if (!rootDynamicId) {
          console.warn("Not part of a dynamic system:", parentNode.id);
          return;
        }

        const rootDynamicNode = draft.nodes.find((n) => n.id === rootDynamicId);
        if (!rootDynamicNode) {
          console.warn("Root dynamic node not found:", rootDynamicId);
          return;
        }

        console.log("Found root dynamic node:", rootDynamicId);

        // STEP 2: Find all related dynamic nodes across viewports
        const allDynamicNodes = draft.nodes.filter(
          (n) => n.isDynamic && n.sharedId === rootDynamicNode.sharedId
        );

        console.log(
          "Found related dynamic nodes across viewports:",
          allDynamicNodes.map((n) => n.id)
        );

        // STEP 3: Find all variants of all these dynamic nodes
        const allVariants = draft.nodes.filter(
          (n) =>
            n.isVariant &&
            allDynamicNodes.some(
              (d) => n.dynamicParentId === d.id || n.variantParentId === d.id
            )
        );

        console.log(
          "Found variants across viewports:",
          allVariants.map((n) => n.id)
        );

        // STEP 4: Find the corresponding parent in each target tree
        const allTargets = [...allDynamicNodes, ...allVariants].filter(
          (n) => n.id !== parentId
        );

        // Determine the relative path from root to our parent
        const pathFromRoot = getPathFromRoot(
          parentNode,
          rootDynamicId,
          draft.nodes
        );
        console.log(
          "Path from root:",
          pathFromRoot.map((p) => p.id)
        );

        // For each target, find the corresponding parent using the path
        allTargets.forEach((targetRoot) => {
          // Find the corresponding parent in this target
          let correspondingParent: Node | undefined;

          if (pathFromRoot.length === 0) {
            // Direct child of dynamic node
            correspondingParent = targetRoot;
          } else {
            // Follow the path to find the corresponding parent
            correspondingParent = followPath(
              pathFromRoot,
              targetRoot,
              draft.nodes
            );
          }

          if (!correspondingParent) {
            console.log(`No corresponding parent found in ${targetRoot.id}`);
            return;
          }

          console.log(
            `Found corresponding parent ${correspondingParent.id} in ${targetRoot.id}`
          );

          // CRITICAL: Check if this parent already has a child with this sharedId
          // If it does, just update it - don't create a new one
          const existingChild = draft.nodes.find(
            (n) =>
              n.parentId === correspondingParent!.id &&
              n.sharedId === node.sharedId
          );

          if (existingChild) {
            console.log(
              `Updating existing child ${existingChild.id} with shared ID ${node.sharedId}`
            );

            // Update properties while respecting independent styles
            Object.entries(node.style).forEach(([key, value]) => {
              if (
                !existingChild.independentStyles ||
                !existingChild.independentStyles[key]
              ) {
                existingChild.style[key] = value;
              }
            });

            // Copy other properties if not marked as independent
            if (
              node.customName &&
              (!existingChild.independentStyles ||
                !existingChild.independentStyles["customName"])
            ) {
              existingChild.customName = node.customName;
            }

            if (
              node.src &&
              (!existingChild.independentStyles ||
                !existingChild.independentStyles["src"])
            ) {
              existingChild.src = node.src;
            }

            if (
              node.text &&
              (!existingChild.independentStyles ||
                !existingChild.independentStyles["text"])
            ) {
              existingChild.text = node.text;
            }

            if (
              node.dynamicState &&
              (!existingChild.independentStyles ||
                !existingChild.independentStyles["dynamicState"])
            ) {
              existingChild.dynamicState = JSON.parse(
                JSON.stringify(node.dynamicState)
              );
            }

            // Sync children if this is a frame
            if (node.type === "frame") {
              // Get all children of this node
              const children = draft.nodes.filter(
                (n) => n.parentId === node.id
              );
              if (children.length > 0) {
                console.log(
                  `Syncing ${children.length} children of frame ${node.id}`
                );
                children.forEach((child) => {
                  syncNodeWithTarget(child, existingChild, draft.nodes);
                });
              }
            }
          } else {
            console.log(
              `Creating new child in ${correspondingParent.id} with shared ID ${node.sharedId}`
            );

            // Create a new child with the same properties
            const newChild: Node = {
              id: nanoid(),
              type: node.type,
              style: { ...node.style },
              parentId: correspondingParent.id,
              sharedId: node.sharedId,
              independentStyles: {},
              inViewport: correspondingParent.inViewport,
            };

            // Copy other properties
            if (node.customName) newChild.customName = node.customName;
            if (node.src) newChild.src = node.src;
            if (node.text) newChild.text = node.text;
            if (node.dynamicState) {
              newChild.dynamicState = JSON.parse(
                JSON.stringify(node.dynamicState)
              );
            }
            if (node.dynamicPosition) {
              newChild.dynamicPosition = { ...node.dynamicPosition };
            }

            // Set dynamic properties
            newChild.dynamicParentId =
              correspondingParent.dynamicParentId ||
              (correspondingParent.isDynamic
                ? correspondingParent.id
                : undefined);
            newChild.dynamicViewportId =
              correspondingParent.dynamicViewportId ||
              findParentViewport(correspondingParent.parentId, draft.nodes);
            newChild.isVariant = correspondingParent.isVariant;
            newChild.variantParentId = correspondingParent.variantParentId;

            // Add to nodes array
            draft.nodes.push(newChild);

            // Sync children if this is a frame
            if (node.type === "frame") {
              // Get all children of this node
              const children = draft.nodes.filter(
                (n) => n.parentId === node.id
              );
              if (children.length > 0) {
                console.log(
                  `Syncing ${children.length} children of frame ${node.id}`
                );
                children.forEach((child) => {
                  syncNodeWithTarget(child, newChild, draft.nodes);
                });
              }
            }
          }
        });

        console.log("Finished syncing node:", nodeId);
      })
    );

    /**
     * Find the root dynamic node of a tree
     */
    function findRootDynamicNode(
      node: Node,
      nodes: Node[]
    ): string | number | null {
      // If the node is already a dynamic node, it's the root
      if (node.isDynamic) {
        return node.id;
      }

      // If node has a dynamicParentId, that's the root
      if (node.dynamicParentId) {
        return node.dynamicParentId;
      }

      // Otherwise traverse up until we find a dynamic node
      if (node.parentId) {
        const parent = nodes.find((n) => n.id === node.parentId);
        if (parent) {
          return findRootDynamicNode(parent, nodes);
        }
      }

      return null;
    }

    /**
     * Get the path from a node to the root dynamic node
     * Returns array of nodes in the path (excluding the root)
     */
    function getPathFromRoot(
      node: Node,
      rootId: string | number,
      nodes: Node[]
    ): Node[] {
      const path: Node[] = [];
      let current: Node | undefined = node;

      // Start with the current node
      if (current && current.id !== rootId) {
        path.unshift(current);
      }

      // Traverse up until we reach the root
      while (current && current.id !== rootId) {
        if (current.parentId) {
          current = nodes.find((n) => n.id === current!.parentId);
          if (current && current.id !== rootId) {
            path.unshift(current);
          }
        } else {
          break;
        }
      }

      return path;
    }

    /**
     * Follow a path of nodes from a root node to find the corresponding node
     */
    function followPath(
      path: Node[],
      rootNode: Node,
      nodes: Node[]
    ): Node | undefined {
      if (path.length === 0) {
        return rootNode;
      }

      let current: Node = rootNode;

      // Skip the first node in the path if it's the root
      const startIndex = path[0].id === rootNode.id ? 1 : 0;

      // Start from the first node after root in the path
      for (let i = startIndex; i < path.length; i++) {
        const pathNode = path[i];

        // Find a child with the same sharedId
        const children = nodes.filter((n) => n.parentId === current.id);
        const match = children.find((n) => n.sharedId === pathNode.sharedId);

        if (!match) {
          console.log(
            `Path broken at index ${i}, no child with sharedId ${pathNode.sharedId} found in ${current.id}`
          );
          return undefined;
        }

        current = match;
      }

      return current;
    }

    /**
     * Sync a node with a target parent WITHOUT DUPLICATION
     * Used for recursive syncing of children
     */
    function syncNodeWithTarget(
      sourceNode: Node,
      targetParent: Node,
      nodes: Node[]
    ) {
      // Ensure source node has a sharedId
      if (!sourceNode.sharedId) {
        sourceNode.sharedId = nanoid();
      }

      // CRITICAL: Check if target parent already has this child with this sharedId
      const existingNode = nodes.find(
        (n) =>
          n.parentId === targetParent.id && n.sharedId === sourceNode.sharedId
      );

      if (existingNode) {
        // Update existing node properties without creating duplicates
        console.log(
          `Updating existing child ${existingNode.id} with shared ID ${sourceNode.sharedId}`
        );

        Object.entries(sourceNode.style).forEach(([key, value]) => {
          if (
            !existingNode.independentStyles ||
            !existingNode.independentStyles[key]
          ) {
            existingNode.style[key] = value;
          }
        });

        // Copy other properties
        if (
          !existingNode.independentStyles ||
          !existingNode.independentStyles["customName"]
        ) {
          existingNode.customName = sourceNode.customName;
        }

        if (
          !existingNode.independentStyles ||
          !existingNode.independentStyles["src"]
        ) {
          existingNode.src = sourceNode.src;
        }

        if (
          !existingNode.independentStyles ||
          !existingNode.independentStyles["text"]
        ) {
          existingNode.text = sourceNode.text;
        }

        // Recursive sync for children without duplication
        if (sourceNode.type === "frame") {
          const children = nodes.filter((n) => n.parentId === sourceNode.id);
          if (children.length > 0) {
            children.forEach((child) => {
              syncNodeWithTarget(child, existingNode, nodes);
            });
          }
        }
      } else {
        // Create new node - not a duplicate because we checked first
        console.log(
          `Creating new child in ${targetParent.id} with shared ID ${sourceNode.sharedId}`
        );

        const newNode: Node = {
          id: nanoid(),
          type: sourceNode.type,
          style: { ...sourceNode.style },
          parentId: targetParent.id,
          sharedId: sourceNode.sharedId,
          independentStyles: {},
          inViewport: targetParent.inViewport,
        };

        // Copy other properties
        if (sourceNode.customName) newNode.customName = sourceNode.customName;
        if (sourceNode.src) newNode.src = sourceNode.src;
        if (sourceNode.text) newNode.text = sourceNode.text;
        if (sourceNode.dynamicState) {
          newNode.dynamicState = JSON.parse(
            JSON.stringify(sourceNode.dynamicState)
          );
        }
        if (sourceNode.dynamicPosition) {
          newNode.dynamicPosition = { ...sourceNode.dynamicPosition };
        }

        // Set dynamic properties
        newNode.dynamicParentId =
          targetParent.dynamicParentId ||
          (targetParent.isDynamic ? targetParent.id : undefined);
        newNode.dynamicViewportId =
          targetParent.dynamicViewportId ||
          findParentViewport(targetParent.parentId, nodes);
        newNode.isVariant = targetParent.isVariant;
        newNode.variantParentId = targetParent.variantParentId;

        // Add to nodes array
        nodes.push(newNode);

        // Recursive sync for children
        if (sourceNode.type === "frame") {
          const children = nodes.filter((n) => n.parentId === sourceNode.id);
          if (children.length > 0) {
            children.forEach((child) => {
              syncNodeWithTarget(child, newNode, nodes);
            });
          }
        }
      }
    }
  }

  /**
   * Helper function to sync a child from a source parent to a target parent.
   * Used for recursively handling grandchildren.
   */
  syncChildToParent(sourceChild: Node, targetParent: Node, nodes: Node[]) {
    // Ensure source child has a sharedId
    if (!sourceChild.sharedId) {
      sourceChild.sharedId = nanoid();
    }

    // Check if target parent already has this child
    const existingChild = nodes.find(
      (n) =>
        n.parentId === targetParent.id && n.sharedId === sourceChild.sharedId
    );

    if (existingChild) {
      // Update existing child properties (respecting independent styles)
      Object.entries(sourceChild.style).forEach(([key, value]) => {
        if (
          !existingChild.independentStyles ||
          !existingChild.independentStyles[key]
        ) {
          existingChild.style[key] = value;
        }
      });

      // Copy other properties
      if (
        !existingChild.independentStyles ||
        !existingChild.independentStyles["customName"]
      ) {
        existingChild.customName = sourceChild.customName;
      }
      if (
        !existingChild.independentStyles ||
        !existingChild.independentStyles["src"]
      ) {
        existingChild.src = sourceChild.src;
      }
      if (
        !existingChild.independentStyles ||
        !existingChild.independentStyles["text"]
      ) {
        existingChild.text = sourceChild.text;
      }

      // Recursive sync for frame children
      if (sourceChild.type === "frame") {
        const grandchildren = nodes.filter(
          (n) => n.parentId === sourceChild.id
        );
        grandchildren.forEach((grandchild) => {
          this.syncChildToParent(grandchild, existingChild, nodes);
        });
      }
    } else {
      // Create new child
      const newChild = {
        id: nanoid(),
        type: sourceChild.type,
        style: { ...sourceChild.style },
        parentId: targetParent.id,
        sharedId: sourceChild.sharedId,
        independentStyles: {},
        inViewport: targetParent.inViewport,
      };

      // Copy other properties
      if (sourceChild.customName) newChild.customName = sourceChild.customName;
      if (sourceChild.src) newChild.src = sourceChild.src;
      if (sourceChild.text) newChild.text = sourceChild.text;
      if (sourceChild.dynamicState) {
        newChild.dynamicState = JSON.parse(
          JSON.stringify(sourceChild.dynamicState)
        );
      }
      if (sourceChild.dynamicPosition) {
        newChild.dynamicPosition = { ...sourceChild.dynamicPosition };
      }

      // Inherit dynamic properties
      newChild.dynamicParentId = targetParent.dynamicParentId;
      newChild.dynamicViewportId = targetParent.dynamicViewportId;
      newChild.isVariant = targetParent.isVariant;
      newChild.variantParentId = targetParent.variantParentId;

      // Add to nodes array
      nodes.push(newChild);

      // Recursive sync for frame children
      if (sourceChild.type === "frame") {
        const grandchildren = nodes.filter(
          (n) => n.parentId === sourceChild.id
        );
        grandchildren.forEach((grandchild) => {
          this.syncChildToParent(grandchild, newChild, nodes);
        });
      }
    }
  }

  /**
   * Utility to remove duplicated children in dynamic variants.
   * This fixes cases where the same sharedId appears multiple times in the same parent.
   */
  fixDuplicatedDynamicElements() {
    console.log("Starting fix for duplicated dynamic elements...");

    this.setState((prev) =>
      produce(prev, (draft) => {
        // Get all dynamic nodes
        const dynamicNodes = draft.nodes.filter((n) => n.isDynamic);
        console.log(`Found ${dynamicNodes.length} dynamic nodes to check`);

        // Get all variants
        const allVariants = draft.nodes.filter((n) => n.isVariant);
        console.log(`Found ${allVariants.length} variants to check`);

        // For each variant, check for duplicate children with the same sharedId
        allVariants.forEach((variant) => {
          // Get all direct children
          const directChildren = draft.nodes.filter(
            (n) => n.parentId === variant.id
          );

          // Group by sharedId
          const childrenBySharedId = new Map<string, Node[]>();

          directChildren.forEach((child) => {
            if (child.sharedId) {
              if (!childrenBySharedId.has(child.sharedId)) {
                childrenBySharedId.set(child.sharedId, []);
              }
              childrenBySharedId.get(child.sharedId)!.push(child);
            }
          });

          // Check each group for duplicates
          childrenBySharedId.forEach((children, sharedId) => {
            if (children.length > 1) {
              console.log(
                `Found ${children.length} duplicate children with sharedId ${sharedId} in variant ${variant.id}`
              );

              // Keep the most recently added one (usually the last in the array)
              // Sort by ID to ensure deterministic behavior
              const sortedChildren = [...children].sort((a, b) =>
                a.id.localeCompare(b.id as string)
              );
              const keepChild = sortedChildren[sortedChildren.length - 1];

              // Remove all but the one we want to keep
              sortedChildren.slice(0, -1).forEach((childToRemove) => {
                console.log(`Removing duplicate child ${childToRemove.id}`);

                // Get all descendants of this child to also remove
                const descendantsToRemove = getAllDescendants(
                  childToRemove.id,
                  draft.nodes
                );
                console.log(
                  `Also removing ${descendantsToRemove.length} descendants`
                );

                // Remove the child and all its descendants
                const allToRemove = [
                  childToRemove.id,
                  ...descendantsToRemove.map((d) => d.id),
                ];
                draft.nodes = draft.nodes.filter(
                  (n) => !allToRemove.includes(n.id)
                );
              });

              console.log(`Kept child ${keepChild.id}`);
            }
          });

          // Now do the same for all non-direct descendants recursively
          const processNestedDuplicates = (parentId: string | number) => {
            const children = draft.nodes.filter((n) => n.parentId === parentId);

            children.forEach((child) => {
              // Get all direct children of this node
              const grandchildren = draft.nodes.filter(
                (n) => n.parentId === child.id
              );

              // Group by sharedId
              const grandchildrenBySharedId = new Map<string, Node[]>();

              grandchildren.forEach((grandchild) => {
                if (grandchild.sharedId) {
                  if (!grandchildrenBySharedId.has(grandchild.sharedId)) {
                    grandchildrenBySharedId.set(grandchild.sharedId, []);
                  }
                  grandchildrenBySharedId
                    .get(grandchild.sharedId)!
                    .push(grandchild);
                }
              });

              // Check each group for duplicates
              grandchildrenBySharedId.forEach((items, sharedId) => {
                if (items.length > 1) {
                  console.log(
                    `Found ${items.length} duplicate grandchildren with sharedId ${sharedId} in node ${child.id}`
                  );

                  // Keep the most recently added one (usually the last in the array)
                  const sortedItems = [...items].sort((a, b) =>
                    a.id.localeCompare(b.id as string)
                  );
                  const keepItem = sortedItems[sortedItems.length - 1];

                  // Remove all but the one we want to keep
                  sortedItems.slice(0, -1).forEach((itemToRemove) => {
                    console.log(
                      `Removing duplicate grandchild ${itemToRemove.id}`
                    );

                    // Get all descendants of this item to also remove
                    const descendantsToRemove = getAllDescendants(
                      itemToRemove.id,
                      draft.nodes
                    );

                    // Remove the item and all its descendants
                    const allToRemove = [
                      itemToRemove.id,
                      ...descendantsToRemove.map((d) => d.id),
                    ];
                    draft.nodes = draft.nodes.filter(
                      (n) => !allToRemove.includes(n.id)
                    );
                  });

                  console.log(`Kept grandchild ${keepItem.id}`);
                }
              });

              // Continue recursively for this child
              processNestedDuplicates(child.id);
            });
          };

          // Process all nested duplicates
          processNestedDuplicates(variant.id);
        });
      })
    );

    console.log("Completed fix for duplicated dynamic elements");
  }

  /**
   * Helper to get all descendants of a node recursively
   */
  getAllDescendants(nodeId: string | number, nodes: Node[]): Node[] {
    const result: Node[] = [];
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = nodes.filter((n) => n.parentId === currentId);

      children.forEach((child) => {
        result.push(child);
        queue.push(child.id);
      });
    }

    return result;
  }

  /**
   * Utility method to synchronize ALL children of ALL dynamic nodes at once.
   * This can be used to fix existing unsynchronized content.
   */
  syncAllDynamicChildren() {
    this.setState((prev) => {
      // First find all dynamic nodes
      const dynamicNodes = prev.nodes.filter((n) => n.isDynamic);
      console.log(`Found ${dynamicNodes.length} dynamic nodes to sync`);

      // Return state unchanged - we'll make changes in the next steps
      return prev;
    });

    // Process each dynamic node one by one to avoid state conflicts
    let processedCount = 0;

    const processNextNode = (index: number) => {
      if (
        index >= this.getNodeState().nodes.filter((n) => n.isDynamic).length
      ) {
        console.log("Finished syncing all dynamic nodes");
        return;
      }

      const dynamicNodes = this.getNodeState().nodes.filter((n) => n.isDynamic);
      const dynamicNode = dynamicNodes[index];
      console.log(
        `Processing dynamic node ${index + 1}/${dynamicNodes.length}: ${
          dynamicNode.id
        }`
      );

      // Find all direct children of this dynamic node
      const children = this.getNodeState().nodes.filter(
        (n) => n.parentId === dynamicNode.id
      );
      console.log(
        `Found ${children.length} children for node ${dynamicNode.id}`
      );

      // Process each child with a delay
      let childIndex = 0;

      const processNextChild = () => {
        if (childIndex >= children.length) {
          // Move to next dynamic node
          processedCount += children.length;
          console.log(`Processed ${processedCount} total children so far`);
          setTimeout(() => processNextNode(index + 1), 100);
          return;
        }

        const child = children[childIndex];
        console.log(
          `Syncing child ${childIndex + 1}/${children.length} of node ${
            index + 1
          }/${dynamicNodes.length}`
        );

        // Sync this child
        this.syncDynamicChildren(child.id);

        // Process next child after a delay
        childIndex++;
        setTimeout(processNextChild, 100);
      };

      // Start processing children
      if (children.length > 0) {
        processNextChild();
      } else {
        // No children, move to next dynamic node
        setTimeout(() => processNextNode(index + 1), 100);
      }
    };

    // Start processing nodes
    processNextNode(0);
  }

  /**
   * Helper function to synchronize a subtree of children.
   * This should only be called from within a produce() block.
   */
  syncChildSubtree(
    sourceParentId: string | number,
    targetParentId: string | number,
    nodes: Node[]
  ) {
    // Get all immediate children of the source parent
    const sourceChildren = nodes.filter((n) => n.parentId === sourceParentId);

    // Create a map from original ID to new ID for child-to-parent mapping
    const idMap = new Map<string | number, string | number>();
    idMap.set(sourceParentId, targetParentId);

    // Process each level, starting with direct children
    sourceChildren.forEach((sourceChild) => {
      // Ensure every child has a sharedId
      if (!sourceChild.sharedId) {
        sourceChild.sharedId = nanoid();
      }

      // Check if a corresponding child already exists in the target
      const targetChild = nodes.find(
        (n) =>
          n.parentId === targetParentId && n.sharedId === sourceChild.sharedId
      );

      if (targetChild) {
        // Update existing child, preserving independent styles
        Object.entries(sourceChild.style).forEach(([key, value]) => {
          if (
            !targetChild.independentStyles ||
            !targetChild.independentStyles[key]
          ) {
            targetChild.style[key] = value;
          }
        });

        // Copy other properties
        if (
          !targetChild.independentStyles ||
          !targetChild.independentStyles["customName"]
        ) {
          targetChild.customName = sourceChild.customName;
        }
        if (
          !targetChild.independentStyles ||
          !targetChild.independentStyles["src"]
        ) {
          targetChild.src = sourceChild.src;
        }
        if (
          !targetChild.independentStyles ||
          !targetChild.independentStyles["text"]
        ) {
          targetChild.text = sourceChild.text;
        }
        if (
          !targetChild.independentStyles ||
          !targetChild.independentStyles["dynamicState"]
        ) {
          targetChild.dynamicState = sourceChild.dynamicState
            ? JSON.parse(JSON.stringify(sourceChild.dynamicState))
            : undefined;
        }

        // Remember the ID mapping
        idMap.set(sourceChild.id, targetChild.id);

        // Recursively sync grandchildren (if this is a frame)
        if (sourceChild.type === "frame") {
          this.syncChildSubtree(sourceChild.id, targetChild.id, nodes);
        }
      } else {
        // Create a new child
        const newChild: Node = {
          id: nanoid(),
          type: sourceChild.type,
          style: { ...sourceChild.style },
          parentId: targetParentId,
          sharedId: sourceChild.sharedId,
          independentStyles: {},
        };

        // Copy other properties
        if (sourceChild.customName)
          newChild.customName = sourceChild.customName;
        if (sourceChild.src) newChild.src = sourceChild.src;
        if (sourceChild.text) newChild.text = sourceChild.text;
        if (sourceChild.dynamicState) {
          newChild.dynamicState = JSON.parse(
            JSON.stringify(sourceChild.dynamicState)
          );
        }
        if (sourceChild.position)
          newChild.position = { ...sourceChild.position };
        if (sourceChild.dynamicPosition) {
          newChild.dynamicPosition = { ...sourceChild.dynamicPosition };
        }

        // Inherit dynamic properties from parent
        const targetParent = nodes.find((n) => n.id === targetParentId);
        if (targetParent) {
          newChild.dynamicParentId = targetParent.dynamicParentId;
          newChild.dynamicViewportId = targetParent.dynamicViewportId;
          newChild.isVariant = targetParent.isVariant;
          newChild.variantParentId = targetParent.variantParentId;
          newChild.inViewport = targetParent.inViewport;
        }

        // Add to the nodes array
        nodes.push(newChild);

        // Remember the ID mapping
        idMap.set(sourceChild.id, newChild.id);

        // Recursively sync grandchildren (if this is a frame)
        if (sourceChild.type === "frame") {
          this.syncChildSubtree(sourceChild.id, newChild.id, nodes);
        }
      }
    });
  }
  /**
   * Utility method to synchronize all children of a dynamic node to all its variants.
   * This is useful for fixing existing unsynchronized children.
   * @param dynamicNodeId ID of the dynamic node whose children need synchronizing
   */
  syncAllDynamicNodeChildren(dynamicNodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the dynamic node
        const dynamicNode = draft.nodes.find(
          (n) => n.id === dynamicNodeId && n.isDynamic
        );
        if (!dynamicNode) return;

        console.log("Syncing all children for dynamic node:", dynamicNodeId);

        // Find all direct children of the dynamic node
        const directChildren = draft.nodes.filter(
          (n) => n.parentId === dynamicNodeId
        );

        // Sync each child
        directChildren.forEach((child) => {
          // Make sure all children have shared IDs
          if (!child.sharedId) {
            child.sharedId = nanoid();
          }

          console.log("Processing child:", child.id);
        });

        // Get all variants of this dynamic node
        const allDynamicNodes = draft.nodes.filter(
          (n) => n.isDynamic && n.sharedId === dynamicNode.sharedId
        );

        const allVariants = draft.nodes.filter(
          (n) =>
            n.isVariant &&
            allDynamicNodes.some(
              (d) => d.id === n.dynamicParentId || d.id === n.variantParentId
            )
        );

        console.log(
          "Found variants:",
          allVariants.map((v) => v.id)
        );

        // For each direct child, ensure it exists in all variants
        directChildren.forEach((child) => {
          allVariants.forEach((variant) => {
            // Check if child already exists in this variant
            const existingChild = draft.nodes.find(
              (n) => n.parentId === variant.id && n.sharedId === child.sharedId
            );

            if (!existingChild) {
              console.log(
                `Creating missing child for variant ${variant.id} with shared ID ${child.sharedId}`
              );

              // Create a new copy of the child for this variant
              const newChildId = nanoid();
              const newChild: Node = {
                id: newChildId,
                type: child.type,
                style: { ...child.style },
                parentId: variant.id,
                sharedId: child.sharedId,
                dynamicParentId: variant.dynamicParentId,
                dynamicViewportId: variant.dynamicViewportId,
                isVariant: variant.isVariant,
                variantParentId: variant.variantParentId,
                inViewport: variant.inViewport,
                independentStyles: {},
              };

              // Copy other properties
              if (child.customName) newChild.customName = child.customName;
              if (child.src) newChild.src = child.src;
              if (child.text) newChild.text = child.text;
              if (child.dynamicState)
                newChild.dynamicState = JSON.parse(
                  JSON.stringify(child.dynamicState)
                );
              if (child.position) newChild.position = { ...child.position };
              if (child.dynamicPosition)
                newChild.dynamicPosition = { ...child.dynamicPosition };

              // Add to nodes array
              draft.nodes.push(newChild);

              // If this is a frame, recursively copy its children
              if (child.type === "frame") {
                syncChildrenRecursively(child.id, newChildId);
              }
            }
          });
        });

        // Helper function to recursively sync children
        function syncChildrenRecursively(
          srcParentId: string | number,
          destParentId: string | number
        ) {
          // Get all children of the source parent
          const srcChildren = draft.nodes.filter(
            (n) => n.parentId === srcParentId
          );

          // For each child, create a copy for the destination parent
          srcChildren.forEach((srcChild) => {
            // Ensure child has a sharedId
            if (!srcChild.sharedId) {
              srcChild.sharedId = nanoid();
            }

            // Check if child already exists for destination parent
            const existingChild = draft.nodes.find(
              (n) =>
                n.parentId === destParentId && n.sharedId === srcChild.sharedId
            );

            if (!existingChild) {
              // Create new child
              const newChildId = nanoid();
              const newChild: Node = {
                id: newChildId,
                type: srcChild.type,
                style: { ...srcChild.style },
                parentId: destParentId,
                sharedId: srcChild.sharedId,
                independentStyles: {},
              };

              // Copy other properties
              if (srcChild.customName)
                newChild.customName = srcChild.customName;
              if (srcChild.src) newChild.src = srcChild.src;
              if (srcChild.text) newChild.text = srcChild.text;
              if (srcChild.dynamicState)
                newChild.dynamicState = JSON.parse(
                  JSON.stringify(srcChild.dynamicState)
                );
              if (srcChild.position)
                newChild.position = { ...srcChild.position };
              if (srcChild.dynamicPosition)
                newChild.dynamicPosition = { ...srcChild.dynamicPosition };

              // Add to nodes array
              draft.nodes.push(newChild);

              // Continue recursion if this is a frame
              if (srcChild.type === "frame") {
                syncChildrenRecursively(srcChild.id, newChildId);
              }
            }
          });
        }
      })
    );
  }

  updateNodeparent(nodeId: string | number, parentId: string | number | null) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const targetNode = draft.nodes.find((n) => n.id === nodeId);
        if (targetNode) {
          targetNode.parentId = parentId;
        }
      })
    );
  }

  /**
   * Update the absolute position (x,y) of a node. Just set node.position.
   */
  updateNodePosition(id: string | number, position: Position) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const targetNode = draft.nodes.find((n) => n.id === id);
        if (targetNode) {
          targetNode.position = position;
        }
      })
    );
  }

  reorderNode(
    nodeId: string | number,
    targetParentId: string | number,
    targetIndex: number
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the node
        const idx = draft.nodes.findIndex((n) => n.id === nodeId);
        if (idx === -1) return;
        const node = draft.nodes[idx];

        // Remove from old position
        draft.nodes.splice(idx, 1);

        // Find siblings in target parent
        const siblings = draft.nodes
          .map((n, idx) => ({ node: n, index: idx }))
          .filter((obj) => obj.node.parentId === targetParentId);

        // Calculate insert position
        let insertIndex;
        if (siblings.length === 0) {
          insertIndex = draft.nodes.length;
        } else if (targetIndex >= siblings.length) {
          insertIndex = siblings[siblings.length - 1].index + 1;
        } else {
          insertIndex = siblings[targetIndex].index;
        }

        // Update node properties
        node.parentId = targetParentId;
        node.inViewport = true;
        node.style.position = "relative";

        if (!node.sharedId) {
          node.sharedId = nanoid();
        }

        // Insert at new position
        draft.nodes.splice(insertIndex, 0, node);
      })
    );
  }

  /**
   * Move a node in or out of the viewport, or "before"/"after"/"inside" a target.
   * Now with child synchronization for dynamic nodes and variants.
   */
  moveNode(
    nodeId: string | number,
    inViewport: boolean,
    options?: {
      targetId?: string | number | null;
      position?: "before" | "after" | "inside" | null;
      index?: number;
      newPosition?: Position;
    },
    targetIsDynamic?: boolean
  ) {
    // Track if we need to sync after state update
    let needsSync = false;

    console.log("TARGET IS DYNAMIC IN MOVE NODE", targetIsDynamic);

    this.setState((prev) =>
      produce(prev, (draft) => {
        const idx = draft.nodes.findIndex((n) => n.id === nodeId);
        if (idx === -1) return;
        const node = draft.nodes[idx];

        if (!inViewport) {
          node.inViewport = false;
          node.style.position = "absolute";
          node.parentId = null;
          if (options?.newPosition) {
            node.position = options.newPosition;
          }
          return;
        }

        node.inViewport = true;
        node.style.position = "relative";

        if (!node.sharedId) {
          node.sharedId = nanoid();
        }

        if (options?.targetId != null && options.position) {
          draft.nodes.splice(idx, 1);

          const targetId = options.targetId;
          const position = options.position;
          const targetIndex = draft.nodes.findIndex((n) => n.id === targetId);

          if (targetIndex === -1) {
            node.parentId = null;
            draft.nodes.push(node);
            return;
          }

          const targetNode = draft.nodes[targetIndex];

          console.log("targetIsDynamic", targetIsDynamic);

          // If target is dynamic and position is "inside", mark for sync after update
          if (position === "inside" && targetIsDynamic) {
            needsSync = true;
          }

          if (position === "inside") {
            node.parentId = targetNode.id;
            draft.nodes.push(node);
            return;
          }

          node.parentId = targetNode.parentId;

          // If index is provided, use it directly
          if (typeof options.index === "number") {
            const siblings = draft.nodes.filter(
              (n) => n.parentId === targetNode.parentId
            );
            const insertIndex = Math.min(options.index, siblings.length);
            const globalIndices = siblings.map((s) => draft.nodes.indexOf(s));
            const insertGlobalIndex =
              globalIndices[insertIndex] || draft.nodes.length;
            draft.nodes.splice(insertGlobalIndex, 0, node);
            return;
          }

          // Otherwise use before/after position
          const siblingIds = draft.nodes
            .map((n, i) => ({ node: n, index: i }))
            .filter((obj) => obj.node.parentId === targetNode.parentId);

          const siblingIdx = siblingIds.findIndex(
            (obj) => obj.node.id === targetId
          );

          if (siblingIdx === -1) {
            draft.nodes.push(node);
            return;
          }

          const insertGlobalIndex =
            position === "after"
              ? siblingIds[siblingIdx].index + 1
              : siblingIds[siblingIdx].index;

          draft.nodes.splice(insertGlobalIndex, 0, node);
          return;
        }

        draft.nodes.splice(idx, 1);
        draft.nodes.push(node);
      })
    );

    // After the state update, check if we need to sync the moved node
    if (targetIsDynamic) {
      // Use setTimeout to ensure state has been updated
      setTimeout(() => {
        console.log("Synchronizing moved node:", nodeId);
        this.syncVariants(nodeId);
      }, 50);
    }
  }

  /**
   * Replace the entire node array.
   */
  setNodes(nodes: Node[]) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.nodes = nodes;
      })
    );
  }

  /**
   * Remove a node by id from the array.
   */
  removeNode(nodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const idx = draft.nodes.findIndex((n) => n.id === nodeId);
        if (idx !== -1) {
          draft.nodes.splice(idx, 1);
        }
      })
    );
  }

  /**
   * Insert a node at a specific index in the array (root-level).
   */
  insertAtIndex(
    node: Node,
    index: number,
    parentId: string | number | null | undefined
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const newNode = { ...node, parentId };

        const siblings = draft.nodes
          .map((n, idx) => ({ node: n, index: idx }))
          .filter((obj) => obj.node.parentId === parentId);

        if (siblings.length === 0) {
          draft.nodes.push(newNode);
          return;
        }

        if (index >= siblings.length) {
          const lastSiblingGlobalIndex = siblings[siblings.length - 1].index;
          draft.nodes.splice(lastSiblingGlobalIndex + 1, 0, newNode);
        } else {
          const targetGlobalIndex = siblings[index].index;
          draft.nodes.splice(targetGlobalIndex, 0, newNode);
        }
      })
    );
  }

  updateDynamicPosition(id: string | number, position: Position) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const targetNode = draft.nodes.find((n) => n.id === id);
        if (targetNode) {
          targetNode.dynamicPosition = position;
        }
      })
    );
  }

  updateNodeDynamicStatus(nodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const mainNode = draft.nodes.find((n) => n.id === nodeId);
        if (!mainNode) return;

        // Make the node dynamic
        mainNode.isDynamic = true;

        // Ensure it has a sharedId
        if (!mainNode.sharedId) {
          mainNode.sharedId = nanoid();
        }

        // Create a new dynamicFamilyId to connect all related nodes
        const familyId = nanoid();
        mainNode.dynamicFamilyId = familyId;

        // Find all nodes with the same sharedId across all viewports
        const relatedNodes = draft.nodes.filter(
          (n) => n.sharedId === mainNode.sharedId && n.id !== mainNode.id
        );

        // Update all related nodes with the same dynamicFamilyId
        relatedNodes.forEach((node) => {
          node.dynamicFamilyId = familyId;
          node.isDynamic = true; // Make all instances dynamic
        });

        // Update children recursively with the dynamicParentId and dynamicFamilyId
        function updateChildren(parentId: string | number) {
          const children = draft.nodes.filter((n) => n.parentId === parentId);
          children.forEach((child) => {
            child.dynamicParentId = nodeId;
            child.dynamicFamilyId = familyId;
            updateChildren(child.id);
          });
        }

        updateChildren(nodeId);
      })
    );
  }

  storeDynamicNodeState(nodeId: string | number | null) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the selected node
        const node = draft.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Store original state before making it absolute
        if (!node.originalState) {
          node.originalState = {
            parentId: node.parentId,
            inViewport: node.inViewport,
          };
        }

        // Set originalParentId to maintain relationship info
        node.originalParentId = node.parentId;

        // Set dynamicViewportId for the current node if not already set
        if (!node.dynamicViewportId) {
          const viewportId = findParentViewport(
            node.originalParentId,
            draft.nodes
          );
          if (viewportId) {
            node.dynamicViewportId = viewportId;
          }
        }

        // Set up for dynamic mode
        node.parentId = null;
        node.inViewport = false;

        // Initialize dynamicPosition if not set
        if (!node.dynamicPosition) {
          node.dynamicPosition = { x: 0, y: 0 };
        }

        // Find and prepare all responsive counterparts
        if (node.sharedId && node.isDynamic) {
          const responsiveCounterparts = draft.nodes.filter(
            (n) =>
              n.sharedId === node.sharedId && n.id !== node.id && n.isDynamic
          );

          console.log(
            `Found ${responsiveCounterparts.length} responsive counterparts`
          );

          responsiveCounterparts.forEach((counterpart) => {
            // Store original state if not already stored
            if (!counterpart.originalState) {
              counterpart.originalState = {
                parentId: counterpart.parentId,
                inViewport: counterpart.inViewport,
              };
            }

            // Set originalParentId to maintain relationship info
            counterpart.originalParentId = counterpart.parentId;

            // Set dynamicViewportId for this counterpart
            if (!counterpart.dynamicViewportId) {
              const viewportId = findParentViewport(
                counterpart.parentId,
                draft.nodes
              );
              if (viewportId) {
                counterpart.dynamicViewportId = viewportId;
              }
            }

            // Set up for dynamic mode - make ALL responsive counterparts ready
            counterpart.parentId = null;
            counterpart.inViewport = false;

            // Ensure it has dynamicPosition set
            if (!counterpart.dynamicPosition && counterpart.position) {
              counterpart.dynamicPosition = { ...counterpart.position };
            } else if (!counterpart.dynamicPosition) {
              counterpart.dynamicPosition = { x: 0, y: 0 };
            }
          });
        }
      })
    );
  }

  setCustomName(
    nodeId: string | number,
    customName: string,
    isDynamicMode: boolean = false
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // First find the node we're directly naming
        const node = draft.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Set its custom name
        node.customName = customName;

        // If we're in dynamic mode, handle naming differently
        if (isDynamicMode) {
          // CASE 1: Naming a top-level variant (a variant container)
          if (node.isVariant && !node.parentId) {
            console.log(
              "Setting custom name for top-level variant:",
              nodeId,
              customName
            );

            // Get the variant identifier
            const variantId = node.variantInfo?.id;
            if (!variantId) return;

            // Find all responsive variants with the same variantInfo.id
            // ONLY sync to top-level variants (parentId === null), not to children
            draft.nodes.forEach((otherNode) => {
              if (
                otherNode.id !== nodeId &&
                otherNode.variantInfo?.id === variantId &&
                otherNode.isVariant &&
                !otherNode.parentId // Only sync to top-level variants
              ) {
                console.log(
                  "Syncing name to responsive variant:",
                  otherNode.id
                );
                otherNode.customName = customName;
              }
            });
            return;
          }

          // CASE 2: Naming a child element inside a variant
          if (node.isVariant && node.parentId) {
            console.log(
              "Setting custom name for variant child:",
              nodeId,
              customName
            );

            // Get the variant identifier from the parent
            const parentVariant = draft.nodes.find(
              (n) => n.id === node.variantParentId
            );
            if (!parentVariant || !parentVariant.variantInfo?.id) return;

            const variantId = parentVariant.variantInfo.id;

            // Find all variants with the same variantInfo.id
            const relatedVariants = draft.nodes.filter(
              (n) =>
                n.isVariant && !n.parentId && n.variantInfo?.id === variantId
            );

            // For each related variant, find the corresponding child with the same sharedId
            relatedVariants.forEach((relatedVariant) => {
              if (relatedVariant.id === node.variantParentId) return; // Skip the parent we're already handling

              const childNodes = draft.nodes.filter(
                (n) =>
                  n.variantParentId === relatedVariant.id &&
                  n.sharedId === node.sharedId
              );

              // Update all equivalent children in other responsive variants
              childNodes.forEach((childNode) => {
                console.log(
                  `Syncing name to equivalent child ${childNode.id} in variant ${relatedVariant.id}`
                );
                childNode.customName = customName;
              });
            });

            return;
          }

          // CASE 3: Naming a component in a dynamic base node (important new case!)
          if (node.sharedId && !node.isVariant) {
            console.log(
              "Setting name for component in dynamic base node:",
              nodeId,
              customName
            );

            // Find all nodes with the same shared ID, including:
            // 1. Normal responsive instances
            // 2. Equivalent components inside variants
            draft.nodes.forEach((otherNode) => {
              if (
                otherNode.id !== nodeId &&
                otherNode.sharedId === node.sharedId
              ) {
                // For normal responsive instances or variant components
                otherNode.customName = customName;
                console.log(
                  `Syncing name to component ${
                    otherNode.id
                  } (isVariant: ${!!otherNode.isVariant})`
                );
              }
            });

            return;
          }

          // CASE 4: For normal children of dynamic nodes
          if (!node.isVariant && node.dynamicParentId && node.sharedId) {
            console.log(
              "Setting custom name for dynamic child:",
              nodeId,
              customName
            );

            // Update all other instances of this child across viewports and inside variants
            draft.nodes.forEach((otherNode) => {
              if (
                otherNode.id !== nodeId &&
                otherNode.sharedId === node.sharedId
              ) {
                otherNode.customName = customName;
              }
            });
            return;
          }
        }

        // Default case (not in dynamic mode): sync names across all nodes with same sharedId
        if (node.sharedId) {
          draft.nodes.forEach((otherNode) => {
            if (
              otherNode.id !== nodeId &&
              otherNode.sharedId === node.sharedId
            ) {
              otherNode.customName = customName;
            }
          });
        }
      })
    );
  }

  resetDynamicNodePositions() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find all nodes that have originalState or dynamicPosition
        const dynamicNodes = draft.nodes.filter(
          (n) =>
            n.originalState ||
            n.dynamicPosition ||
            n.originalParentId !== undefined
        );

        console.log(
          `Resetting positions for ${dynamicNodes.length} dynamic nodes`
        );

        dynamicNodes.forEach((node) => {
          // Restore the original state
          if (node.originalState) {
            console.log(
              `Restoring node ${node.id} to parent ${node.originalState.parentId}`
            );

            node.parentId = node.originalState.parentId;
            node.inViewport = node.originalState.inViewport;

            // Set position back to relative
            node.style.position = "relative";
            node.style.left = "";
            node.style.top = "";
            node.style.zIndex = "";
            node.style.transform = "";

            // Clear the original state
            delete node.originalState;
          }
          // If no originalState but has originalParentId, restore that
          else if (node.originalParentId !== undefined) {
            node.parentId = node.originalParentId;

            // Set position back to relative
            node.style.position = "relative";
            node.style.left = "";
            node.style.top = "";
          }

          // Clear dynamic properties
          delete node.dynamicPosition;
          delete node.originalParentId;
        });
      })
    );
  }

  duplicateDynamicElement(
    nodeId: string | number,
    elementWidth?: number,
    direction: string = "right"
  ) {
    let duplicateId = "";

    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the original node
        const originalNode = draft.nodes.find((n) => n.id === nodeId);
        if (!originalNode) return;

        // Generate variant info
        const variantName = "Variant " + Math.floor(Math.random() * 1000);
        const variantSlug = "variant-" + Math.floor(Math.random() * 1000);

        // Ensure the original node has a sharedId for synchronization
        if (!originalNode.sharedId) {
          originalNode.sharedId = nanoid();
        }

        // Get dynamicFamilyId from the original node or create one if it doesn't exist
        if (!originalNode.dynamicFamilyId) {
          originalNode.dynamicFamilyId = nanoid();
        }
        const familyId = originalNode.dynamicFamilyId;

        // Determine if we're duplicating from a variant or base node
        const duplicatingFromVariant = originalNode.isVariant === true;

        console.log("Duplicating from variant:", duplicatingFromVariant);

        // Define our source instances to duplicate from
        const dynamicInstances = duplicatingFromVariant
          ? [originalNode]
          : draft.nodes.filter(
              (n) => n.sharedId === originalNode.sharedId && n.isDynamic
            );

        console.log(
          "Found",
          dynamicInstances.length,
          "source instances to duplicate"
        );

        // Track the desktop/main variant positions for reference
        const mainVariantPositions = new Map();
        let firstVariantPosition = null;

        // Create variants for each source instance first
        dynamicInstances.forEach((sourceInstance) => {
          const instanceDuplicateId = nanoid();

          // Use the first created duplicate as our return value
          if (!duplicateId) {
            duplicateId = instanceDuplicateId;
          }

          // Get viewport ID if instance is in a viewport
          let viewportId = null;
          if (sourceInstance.parentId) {
            const parent = draft.nodes.find(
              (n) => n.id === sourceInstance.parentId
            );
            if (parent && parent.isViewport) {
              viewportId = parent.id;
            }
          } else if (sourceInstance.dynamicViewportId) {
            viewportId = sourceInstance.dynamicViewportId;
          }

          // Calculate position based on direction parameter
          let posX = sourceInstance.position?.x || 0;
          let posY = sourceInstance.position?.y || 0;

          console.log(
            `Using source position (${posX}, ${posY}) with direction ${direction}`
          );

          // Use element width or default gap
          const width = elementWidth || 300;
          const height = parseFloat(sourceInstance.style.height || "100");
          const gap = 200; // Gap between original and variant

          // Position the new element based on direction
          switch (direction) {
            case "right":
              posX += width + gap;
              break;
            case "left":
              posX -= width + gap;
              break;
            case "bottom":
              posY += height + gap;
              break;
            case "top":
              posY -= height + gap;
              break;
            default:
              // Default to right if direction is invalid
              posX += width + gap;
          }

          // Store this position for the main variant
          if (!viewportId || viewportId === "viewport-1440") {
            firstVariantPosition = { x: posX, y: posY };
            mainVariantPositions.set(variantSlug, { x: posX, y: posY });
          }

          // Create the duplicate with proper properties
          const duplicate: Node = {
            id: instanceDuplicateId,
            type: sourceInstance.type,
            style: {
              ...sourceInstance.style,
              position: "absolute", // Ensure absolute positioning for variants
              left: `${posX}px`,
              top: `${posY}px`,
            },
            // Never make the duplicate a main dynamic node
            isDynamic: false,
            // Set up the variant relationships
            inViewport: false,
            parentId: null,
            // Use the same sharedId as the original for synchronization
            sharedId: sourceInstance.sharedId,
            // Mark as variant
            isVariant: true,
            // Add variant info
            variantInfo: {
              name: variantName,
              id: variantSlug,
            },
            // Set the dynamicFamilyId to connect to the family
            dynamicFamilyId: familyId,
            // Use empty independentStyles to track overrides
            independentStyles: {
              // CRITICAL FIX: Always mark position properties as independent
              left: true,
              top: true,
              position: true,
            },
            // Explicitly set position
            position: {
              x: posX,
              y: posY,
            },
          };

          // If duplicating from a variant, copy over all independent styles
          if (duplicatingFromVariant && sourceInstance.independentStyles) {
            // Preserve all existing independent styles
            Object.keys(sourceInstance.independentStyles).forEach(
              (styleProp) => {
                duplicate.independentStyles[styleProp] =
                  sourceInstance.independentStyles[styleProp];
              }
            );
          }

          // Set proper parent relationships
          if (duplicatingFromVariant) {
            // CRITICAL FIX: When duplicating from a variant, use the SAME parent relationships
            // This ensures we maintain the proper hierarchy
            duplicate.dynamicParentId = sourceInstance.dynamicParentId;
            duplicate.variantParentId = sourceInstance.variantParentId;
          } else {
            // Set parent relationships to the base node we're duplicating from
            duplicate.dynamicParentId = sourceInstance.id;
            duplicate.variantParentId = sourceInstance.id;
          }

          // Set viewport ID if available
          if (viewportId) {
            duplicate.dynamicViewportId = viewportId;
          } else if (sourceInstance.dynamicViewportId) {
            duplicate.dynamicViewportId = sourceInstance.dynamicViewportId;
          }

          // Copy over other important properties
          if (sourceInstance.customName)
            duplicate.customName = sourceInstance.customName;
          if (sourceInstance.src) duplicate.src = sourceInstance.src;
          if (sourceInstance.text) duplicate.text = sourceInstance.text;
          if (sourceInstance.dynamicState)
            duplicate.dynamicState = JSON.parse(
              JSON.stringify(sourceInstance.dynamicState)
            );

          // Add to nodes array
          draft.nodes.push(duplicate);

          console.log(
            `Created variant ${instanceDuplicateId} for instance ${
              sourceInstance.id
            } in viewport ${
              viewportId || sourceInstance.dynamicViewportId || "none"
            } at position (${posX}, ${posY})`
          );

          // If this is a frame, duplicate all its children
          if (sourceInstance.type === "frame") {
            const children = getSubtree(draft.nodes, sourceInstance.id, false);
            const idMap = new Map<string | number, string | number>();
            idMap.set(sourceInstance.id, instanceDuplicateId);

            console.log(`Found ${children.length} children to duplicate`);

            children.forEach((child) => {
              const childDuplicateId = nanoid();

              // Ensure the original child has a sharedId
              if (!child.sharedId) {
                child.sharedId = nanoid();
              }

              // Create duplicate child with same properties
              const childDuplicate: Node = {
                id: childDuplicateId,
                type: child.type,
                style: { ...child.style },
                inViewport: false,
                // Use the same sharedId as the original child for synchronization
                sharedId: child.sharedId,
                // Add variant properties if parent is a variant
                isVariant: true,
                // Connect to the dynamic family
                dynamicFamilyId: familyId,
                // Use empty independentStyles to track overrides
                independentStyles: {},
              };

              // CRITICAL FIX: Copy over all independent styles from source child
              if (child.independentStyles) {
                childDuplicate.independentStyles = {
                  ...child.independentStyles,
                };
              }

              // CRITICAL FIX: When duplicating from variant, maintain EXACT same parent hierarchy
              if (duplicatingFromVariant) {
                childDuplicate.dynamicParentId = child.dynamicParentId;
                childDuplicate.variantParentId = child.variantParentId;
              } else {
                childDuplicate.dynamicParentId = sourceInstance.id;
                childDuplicate.variantParentId = sourceInstance.id;
              }

              // Set viewport ID if available
              if (viewportId) {
                childDuplicate.dynamicViewportId = viewportId;
              } else if (sourceInstance.dynamicViewportId) {
                childDuplicate.dynamicViewportId =
                  sourceInstance.dynamicViewportId;
              }

              // Copy other needed properties
              if (child.customName)
                childDuplicate.customName = child.customName;
              if (child.src) childDuplicate.src = child.src;
              if (child.text) childDuplicate.text = child.text;
              if (child.dynamicState)
                childDuplicate.dynamicState = JSON.parse(
                  JSON.stringify(child.dynamicState)
                );

              // CRITICAL FIX: Set correct parentId for child elements
              // If direct child of the instance, set to the duplicate
              if (child.parentId === sourceInstance.id) {
                childDuplicate.parentId = instanceDuplicateId;
                console.log(
                  `Setting direct child ${childDuplicateId} parentId to ${instanceDuplicateId}`
                );
              } else {
                // Otherwise look up parent mapping
                const originalParentId = child.parentId;
                if (originalParentId) {
                  const newParentId = idMap.get(originalParentId);
                  if (newParentId) {
                    childDuplicate.parentId = newParentId;
                    console.log(
                      `Mapping child ${childDuplicateId} parentId from ${originalParentId} to ${newParentId}`
                    );
                  } else {
                    console.log(
                      `Warning: Could not find parent mapping for child ${child.id}`
                    );
                  }
                }
              }

              // Store ID mapping for children
              idMap.set(child.id, childDuplicateId);
              draft.nodes.push(childDuplicate);
            });

            console.log(
              `Finished duplicating children for instance ${sourceInstance.id}`
            );
          }
        });

        // Cross-viewport duplication for variant sources
        if (duplicatingFromVariant) {
          console.log(
            "Duplicating from variant - checking for other viewports"
          );

          // CRITICAL FIX: Get the true base node
          // When duplicating from a variant, we need to find the original base dynamic node
          const baseNodeId =
            originalNode.dynamicParentId || originalNode.variantParentId;
          if (!baseNodeId) {
            console.log(
              "Cannot find base node ID for cross-viewport duplication"
            );
            return;
          }

          const baseNode = draft.nodes.find((n) => n.id === baseNodeId);
          if (!baseNode || !baseNode.sharedId) {
            console.log("Cannot find base node or it has no sharedId");
            return;
          }

          console.log(
            "Found base node:",
            baseNode.id,
            "with sharedId:",
            baseNode.sharedId
          );

          // Find existing variants with the same ID to get relative positions
          const existingVariants = draft.nodes.filter(
            (n) =>
              n.isVariant &&
              n.variantInfo?.id &&
              n.dynamicParentId === baseNode.id
          );

          console.log(
            "Found",
            existingVariants.length,
            "existing variants for relative positioning"
          );

          // Group by variant ID
          const variantsByType = new Map();
          existingVariants.forEach((v) => {
            if (v.variantInfo?.id) {
              if (!variantsByType.has(v.variantInfo.id)) {
                variantsByType.set(v.variantInfo.id, []);
              }
              variantsByType.get(v.variantInfo.id).push(v);
            }
          });

          // Find all other instances of this base node across viewports
          const otherBaseInstances = draft.nodes.filter(
            (n) =>
              n.id !== baseNodeId &&
              n.sharedId === baseNode.sharedId &&
              n.isDynamic
          );

          console.log(
            "Found",
            otherBaseInstances.length,
            "other base instances across viewports"
          );

          // For each base instance in other viewports, create variants with proper spacing
          otherBaseInstances.forEach((otherBaseInstance) => {
            // Get viewport ID
            let viewportId = null;
            if (otherBaseInstance.parentId) {
              const parent = draft.nodes.find(
                (n) => n.id === otherBaseInstance.parentId
              );
              if (parent && parent.isViewport) {
                viewportId = parent.id;
              }
            } else if (otherBaseInstance.dynamicViewportId) {
              viewportId = otherBaseInstance.dynamicViewportId;
            }

            if (!viewportId) {
              return;
            }

            console.log(`Processing viewport ${viewportId}`);

            // Check if this variant already exists
            const variantExists = draft.nodes.some(
              (n) =>
                n.variantInfo?.id === variantSlug &&
                n.dynamicViewportId === viewportId
            );

            if (variantExists) {
              console.log(`Variant already exists in viewport ${viewportId}`);
              return;
            }

            // Find existing variants in this viewport to determine positioning
            const viewportVariants = draft.nodes.filter(
              (n) =>
                n.isVariant &&
                n.dynamicViewportId === viewportId &&
                n.dynamicParentId === otherBaseInstance.id
            );

            // Calculate position based on existing variants
            let posX = otherBaseInstance.position?.x || 0;
            let posY = otherBaseInstance.position?.y || 0;
            const width = elementWidth || 300;
            const height = parseFloat(otherBaseInstance.style.height || "100");
            const gap = 60;

            if (viewportVariants.length > 0 && firstVariantPosition) {
              // Find the last existing variant and its position
              const sortedVariants = [...viewportVariants].sort((a, b) => {
                const aX = a.position?.x || 0;
                const bX = b.position?.x || 0;
                return aX - bX;
              });

              // Get the last variant's position
              const lastVariant = sortedVariants[sortedVariants.length - 1];

              // If we have a main variant with the same ID, use its relative position
              const correspondingMainVariant = variantsByType.get(
                lastVariant.variantInfo?.id
              )?.[0];
              const mainPosition = mainVariantPositions.get(variantSlug);

              if (
                correspondingMainVariant &&
                correspondingMainVariant.position &&
                mainPosition
              ) {
                // Calculate relative offset from the last variant in desktop/main viewport
                const mainRelativeX =
                  mainPosition.x - correspondingMainVariant.position.x;
                const mainRelativeY =
                  mainPosition.y - correspondingMainVariant.position.y;

                // Apply same offset in this viewport
                posX = lastVariant.position.x + mainRelativeX;
                posY = lastVariant.position.y + mainRelativeY;

                console.log(
                  `Using relative positioning: x=${posX}, y=${posY} based on desktop variant`
                );
              } else {
                // Otherwise just place it after the last variant
                switch (direction) {
                  case "right":
                    posX = lastVariant.position.x + width + gap;
                    posY = lastVariant.position.y;
                    break;
                  case "left":
                    posX = lastVariant.position.x - width - gap;
                    posY = lastVariant.position.y;
                    break;
                  case "bottom":
                    posX = lastVariant.position.x;
                    posY = lastVariant.position.y + height + gap;
                    break;
                  case "top":
                    posX = lastVariant.position.x;
                    posY = lastVariant.position.y - height - gap;
                    break;
                  default:
                    posX = lastVariant.position.x + width + gap;
                    posY = lastVariant.position.y;
                }

                console.log(
                  `Using simple positioning after last variant: x=${posX}, y=${posY}`
                );
              }
            } else {
              // No existing variants, position relative to the base instance
              // Use the same direction as the desktop variant
              switch (direction) {
                case "right":
                  posX += width + gap;
                  break;
                case "left":
                  posX -= width + gap;
                  break;
                case "bottom":
                  posY += height + gap;
                  break;
                case "top":
                  posY -= height + gap;
                  break;
                default:
                  // Default to right if direction is invalid
                  posX += width + gap;
              }

              console.log(
                `Using position relative to base: x=${posX}, y=${posY}`
              );
            }

            // Create the new variant
            const newVariantId = nanoid();

            const newVariant: Node = {
              id: newVariantId,
              type: otherBaseInstance.type,
              style: {
                ...otherBaseInstance.style,
                position: "absolute",
                left: `${posX}px`,
                top: `${posY}px`,
              },
              isDynamic: false,
              dynamicParentId: otherBaseInstance.id,
              inViewport: false,
              parentId: null,
              sharedId: otherBaseInstance.sharedId,
              isVariant: true,
              variantParentId: otherBaseInstance.id,
              variantInfo: {
                name: variantName,
                id: variantSlug,
              },
              dynamicFamilyId: familyId,
              independentStyles: {
                // CRITICAL FIX: Always mark position properties as independent
                left: true,
                top: true,
                position: true,
              },
              dynamicViewportId: viewportId,
              position: {
                x: posX,
                y: posY,
              },
            };

            // CRITICAL FIX: If duplicating from a variant with independent styles
            if (duplicatingFromVariant && originalNode.independentStyles) {
              // Copy ALL independent styles from the original variant
              Object.keys(originalNode.independentStyles).forEach(
                (styleProp) => {
                  if (
                    styleProp !== "left" &&
                    styleProp !== "top" &&
                    styleProp !== "position"
                  ) {
                    newVariant.independentStyles[styleProp] =
                      originalNode.independentStyles[styleProp];
                  }
                }
              );
            }

            // Copy over other properties
            if (otherBaseInstance.customName)
              newVariant.customName = otherBaseInstance.customName;
            if (otherBaseInstance.src) newVariant.src = otherBaseInstance.src;
            if (otherBaseInstance.text)
              newVariant.text = otherBaseInstance.text;
            if (otherBaseInstance.dynamicState) {
              newVariant.dynamicState = JSON.parse(
                JSON.stringify(otherBaseInstance.dynamicState)
              );
            }

            draft.nodes.push(newVariant);

            console.log(
              `Created cross-viewport variant in ${viewportId} at (${posX}, ${posY})`
            );

            // Duplicate children if needed
            if (otherBaseInstance.type === "frame") {
              const children = getSubtree(
                draft.nodes,
                otherBaseInstance.id,
                false
              );
              const idMap = new Map<string | number, string | number>();
              idMap.set(otherBaseInstance.id, newVariantId);

              children.forEach((child) => {
                const childId = nanoid();

                if (!child.sharedId) {
                  child.sharedId = nanoid();
                }

                const childDuplicate: Node = {
                  id: childId,
                  type: child.type,
                  style: { ...child.style },
                  dynamicParentId: otherBaseInstance.id,
                  inViewport: false,
                  sharedId: child.sharedId,
                  isVariant: true,
                  variantParentId: otherBaseInstance.id,
                  dynamicViewportId: viewportId,
                  dynamicFamilyId: familyId,
                  independentStyles: {},
                };

                // CRITICAL FIX: Copy all independent styles from original source variant's children
                if (duplicatingFromVariant) {
                  // Find the corresponding child in the original variant
                  const originalVariantChild = draft.nodes.find(
                    (n) =>
                      n.parentId === originalNode.id &&
                      n.sharedId === child.sharedId
                  );

                  // If found and it has independent styles, copy them
                  if (
                    originalVariantChild &&
                    originalVariantChild.independentStyles
                  ) {
                    childDuplicate.independentStyles = {
                      ...originalVariantChild.independentStyles,
                    };
                  }
                }

                if (child.customName)
                  childDuplicate.customName = child.customName;
                if (child.src) childDuplicate.src = child.src;
                if (child.text) childDuplicate.text = child.text;
                if (child.dynamicState) {
                  childDuplicate.dynamicState = JSON.parse(
                    JSON.stringify(child.dynamicState)
                  );
                }

                if (child.parentId === otherBaseInstance.id) {
                  childDuplicate.parentId = newVariantId;
                } else {
                  const originalParentId = child.parentId;
                  if (originalParentId) {
                    const newParentId = idMap.get(originalParentId);
                    if (newParentId) {
                      childDuplicate.parentId = newParentId;
                    }
                  }
                }

                idMap.set(child.id, childId);
                draft.nodes.push(childDuplicate);
              });
            }
          });
        }

        console.log(
          "Dynamic element duplication complete, returning ID:",
          duplicateId
        );
      })
    );

    return duplicateId;
  }

  /**
   * Add a single dynamic connection, allowing one connection per type per source node.
   * A node can have one click, one hover, and one mouseLeave connection, but not multiple of the same type.
   * @param sourceId Source node ID
   * @param targetId Target node ID
   * @param connectionType Connection type
   * @param dynamicModeNodeId ID of the main dynamic node
   */
  addUniqueDynamicConnection(
    sourceId: string | number,
    targetId: string | number,
    connectionType: "click" | "hover" | "mouseLeave",
    dynamicModeNodeId: string | number
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the source node
        const sourceNode = draft.nodes.find((n) => n.id === sourceId);
        if (!sourceNode) return;

        // Initialize dynamicConnections array if it doesn't exist
        if (!sourceNode.dynamicConnections) {
          sourceNode.dynamicConnections = [];
        }

        // Remove any existing connections of the same type from this source node
        sourceNode.dynamicConnections = sourceNode.dynamicConnections.filter(
          (conn) => conn.type !== connectionType
        );

        // Add the new connection
        sourceNode.dynamicConnections.push({
          sourceId,
          targetId,
          type: connectionType,
        });
      })
    );
  }

  /**
   * Clean up all dynamic connections in the system to ensure one connection per type per target.
   * This allows multiple connections to the same target as long as they have different types.
   * @param dynamicModeNodeId ID of the main dynamic node
   */
  cleanupDynamicConnections(dynamicModeNodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Get all nodes in the dynamic system
        const dynamicNodes = draft.nodes.filter(
          (n) =>
            n.dynamicParentId === dynamicModeNodeId ||
            n.id === dynamicModeNodeId
        );

        // Create a map to track connections by target ID and type
        // The key is a composite of targetId and connection type
        const targetTypeConnectionMap = new Map<
          string, // "targetId-type" as key
          {
            sourceId: string | number;
            targetId: string | number;
            type: "click" | "hover" | "mouseLeave";
          }
        >();

        // First, find all unique connections per target-type combination
        dynamicNodes.forEach((node) => {
          if (!node.dynamicConnections) return;

          node.dynamicConnections.forEach((conn) => {
            const compositeKey = `${conn.targetId}-${conn.type}`;
            targetTypeConnectionMap.set(compositeKey, {
              sourceId: conn.sourceId,
              targetId: conn.targetId,
              type: conn.type || "click", // Default to click if type is missing
            });
          });
        });

        // Clear all connections from all nodes
        dynamicNodes.forEach((node) => {
          if (node.dynamicConnections && node.dynamicConnections.length > 0) {
            node.dynamicConnections = [];
          }
        });

        // Add back unique connections based on target-type combinations
        targetTypeConnectionMap.forEach((conn) => {
          const sourceNode = draft.nodes.find((n) => n.id === conn.sourceId);
          if (sourceNode) {
            if (!sourceNode.dynamicConnections) {
              sourceNode.dynamicConnections = [];
            }
            sourceNode.dynamicConnections.push(conn);
          }
        });
      })
    );
  }

  editViewport(viewportId: string | number, width: number, name: string) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const viewport = draft.nodes.find(
          (n) => n.id === viewportId && n.isViewport
        );
        if (!viewport) return;

        // Update viewport properties
        viewport.viewportWidth = width;
        viewport.viewportName = name;

        // Update style width to match
        this.updateNodeStyle([viewportId], { width: `${width}px` });
      })
    );
  }

  alignViewports() {
    // First get all viewports and their info
    const viewportsInfo: { id: string | number; width: number }[] = [];

    this.setState((prev) => {
      // Get all viewports sorted by width (largest to smallest)
      const viewports = prev.nodes
        .filter((node) => node.isViewport)
        .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0));

      // Store the viewport info we need for the next steps
      viewports.forEach((viewport) => {
        const width =
          viewport.viewportWidth ||
          parseFloat(viewport.style.width as string) ||
          0;

        viewportsInfo.push({
          id: viewport.id,
          width,
        });
      });

      // Return unmodified state - we'll apply updates using the provided methods
      return prev;
    });

    // If we have less than 2 viewports, no need to align
    if (viewportsInfo.length <= 1) return;

    // Calculate and apply positions for each viewport
    let currentLeft = 0;

    viewportsInfo.forEach((viewport) => {
      // Update style using the existing method
      this.updateNodeStyle([viewport.id], {
        left: `${currentLeft}px`,
        top: "0px",
      });

      // Update position data separately
      this.updateNodePosition(viewport.id, { x: currentLeft, y: 100 });

      // Calculate position for next viewport
      currentLeft += viewport.width + 160; // 160px gap between viewports
    });
  }

  syncViewports() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const viewports = draft.nodes.filter((n) => n.isViewport);
        const desktop = viewports.find((v) => v.viewportWidth === 1440);
        if (!desktop) return;

        const desktopSubtree = getSubtree(draft.nodes, desktop.id);

        console.log("doing something");

        viewports.forEach((viewport) => {
          if (viewport.id === desktop.id) return;

          const oldSubtree = getSubtree(draft.nodes, viewport.id);
          const oldNodesBySharedId = new Map<string, Node>();

          // Track dynamic nodes to preserve them
          const dynamicNodesToPreserve = new Set<string | number>();

          // Identify dynamic nodes that should be preserved
          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport) continue;

            // Preserve isDynamic nodes and their children
            if (oldNode.isDynamic || oldNode.dynamicParentId) {
              dynamicNodesToPreserve.add(oldNode.id);
            }

            if (oldNode.sharedId) {
              oldNodesBySharedId.set(oldNode.sharedId, oldNode);
            }
          }

          // Only remove non-dynamic nodes
          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport) continue;
            if (!dynamicNodesToPreserve.has(oldNode.id)) {
              const removeIdx = draft.nodes.findIndex(
                (n) => n.id === oldNode.id
              );
              if (removeIdx !== -1) {
                draft.nodes.splice(removeIdx, 1);
              }
            }
          }

          const idMap = new Map<string | number, string | number>();

          // Only clone nodes that are not dynamic
          for (const desktopNode of desktopSubtree) {
            // Skip dynamic nodes - don't recreate them
            if (desktopNode.isDynamic || desktopNode.dynamicParentId) continue;

            const oldNode = oldNodesBySharedId.get(desktopNode.sharedId || "");
            const cloned: Node = {
              ...desktopNode,
              id: oldNode?.id || nanoid(),
              style: { ...desktopNode.style },
            };

            if (oldNode?.independentStyles) {
              Object.keys(oldNode.style).forEach((prop) => {
                if (oldNode.independentStyles![prop]) {
                  cloned.style[prop] = oldNode.style[prop];
                  cloned.independentStyles = cloned.independentStyles || {};
                  cloned.independentStyles[prop] = true;
                }
              });
            }

            idMap.set(desktopNode.id, cloned.id);
            draft.nodes.push(cloned);
          }

          // Update parent references for new nodes
          for (const dNode of desktopSubtree) {
            // Skip dynamic nodes
            if (dNode.isDynamic || dNode.dynamicParentId) continue;

            const newId = idMap.get(dNode.id);
            if (!newId) continue;

            const clonedNode = draft.nodes.find((n) => n.id === newId);
            if (!clonedNode) continue;

            if (dNode.parentId === desktop.id) {
              clonedNode.parentId = viewport.id;
            } else {
              const newParent = idMap.get(dNode.parentId || "");
              clonedNode.parentId = newParent ?? null;
            }
          }
        });
      })
    );
  }

  updateNode(nodeId: string | number, props: Partial<Node>) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const node = draft.nodes.find((n) => n.id === nodeId);
        if (node) {
          Object.assign(node, props);
        }
      })
    );
  }

  replaceNode(nodeId: string | number, newNode: Node) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const index = draft.nodes.findIndex((n) => n.id === nodeId);
        if (index !== -1) {
          draft.nodes[index] = {
            ...newNode,
            id: nodeId,
          };
        }
      })
    );
  }

  toggleNodeLock(nodeIds: (string | number)[]) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find all nodes that match the nodeIds
        const nodesToToggle = draft.nodes.filter((n) => nodeIds.includes(n.id));

        if (nodesToToggle.length === 0) return;

        // Check the first node's isLocked state to determine the new state
        // If any node is unlocked, we'll lock all nodes
        const anyUnlocked = nodesToToggle.some((node) => !node.isLocked);
        const newLockState = anyUnlocked;

        // Update each node
        nodesToToggle.forEach((node) => {
          node.isLocked = newLockState;
        });
      })
    );
  }

  /**
   * Creates a variant of a dynamic node with shared identity for syncing across variants
   */
  createVariant(dynamicNodeId: string | number, variantName: string) {
    let variantId = "";

    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the main dynamic node
        const mainNode = draft.nodes.find((n) => n.id === dynamicNodeId);
        if (!mainNode || !mainNode.isDynamic) return;

        // Create unique ID for the variant
        variantId = nanoid();
        const variantSlug = variantName.toLowerCase().replace(/\s+/g, "-");

        // Ensure the main node has a sharedId to represent the base variant
        if (!mainNode.sharedId) {
          mainNode.sharedId = nanoid();
        }

        // Find the dynamicFamilyId or create one if it doesn't exist
        if (!mainNode.dynamicFamilyId) {
          mainNode.dynamicFamilyId = nanoid();
        }
        const familyId = mainNode.dynamicFamilyId;

        // Create a variant node with shared identity with the main node
        const variantNode: Node = {
          id: variantId,
          type: mainNode.type,
          style: { ...mainNode.style },
          isDynamic: false,
          isVariant: true,
          variantParentId: mainNode.id,
          dynamicParentId: mainNode.id,
          // Use the same sharedId as the main node for synchronization
          sharedId: mainNode.sharedId,
          // Set empty independentStyles to track overrides
          independentStyles: {},
          // Critical: These must be explicitly set to match dropped elements
          inViewport: false,
          parentId: null,
          position: {
            x: (mainNode.position?.x || 0) + 500,
            y: (mainNode.position?.y || 0) + 200,
          },
          variantInfo: {
            name: variantName,
            id: variantSlug,
          },
          // Make sure to copy the dynamicFamilyId
          dynamicFamilyId: familyId,
        };

        // Determine the correct dynamicViewportId for this variant
        // If main node is in a viewport, find it
        let mainNodeViewportId = null;
        if (mainNode.parentId) {
          const possibleViewport = draft.nodes.find(
            (n) => n.id === mainNode.parentId
          );
          if (possibleViewport && possibleViewport.isViewport) {
            mainNodeViewportId = possibleViewport.id;
          }
        }

        // If found, assign it to the variant
        if (mainNodeViewportId) {
          variantNode.dynamicViewportId = mainNodeViewportId;
        }

        // Copy needed properties
        if (mainNode.customName) variantNode.customName = mainNode.customName;
        if (mainNode.src) variantNode.src = mainNode.src;
        if (mainNode.text) variantNode.text = mainNode.text;
        if (mainNode.dynamicState)
          variantNode.dynamicState = { ...mainNode.dynamicState };

        // Add the variant node to the array
        draft.nodes.push(variantNode);

        // Now clone all children of the main node for the variant
        const mainChildren = getSubtree(draft.nodes, mainNode.id, false);

        // Track the mapping from original IDs to new variant IDs
        const idMap = new Map<string | number, string | number>();
        idMap.set(mainNode.id, variantId);

        console.log("Creating variant with ID:", variantId);
        console.log("Main node ID:", mainNode.id);
        console.log("Family ID:", familyId);
        console.log("Found", mainChildren.length, "children to clone");

        // Clone each child node with shared identity
        mainChildren.forEach((childNode) => {
          const childVariantId = nanoid();

          // Ensure the original child has a sharedId
          if (!childNode.sharedId) {
            childNode.sharedId = nanoid();
          }

          // Create the cloned child with shared identity
          const childVariant: Node = {
            id: childVariantId,
            type: childNode.type,
            style: { ...childNode.style },
            // Use the same sharedId as the original child for synchronization
            sharedId: childNode.sharedId,
            // Set empty independentStyles to track overrides
            independentStyles: {},
            // Critical properties for variants
            dynamicParentId: mainNode.id,
            inViewport: false,
            isVariant: true,
            variantParentId: mainNode.id,
            // Make sure to copy the dynamicFamilyId
            dynamicFamilyId: familyId,
          };

          // Copy needed properties
          if (childNode.customName)
            childVariant.customName = childNode.customName;
          if (childNode.src) childVariant.src = childNode.src;
          if (childNode.text) childVariant.text = childNode.text;
          if (childNode.dynamicState)
            childVariant.dynamicState = { ...childNode.dynamicState };

          // Copy the viewport ID if it exists
          if (mainNodeViewportId) {
            childVariant.dynamicViewportId = mainNodeViewportId;
          }

          // CRITICAL FIX: Always set parentId for direct children of the dynamic node
          if (childNode.parentId === mainNode.id) {
            childVariant.parentId = variantId;
            console.log(
              "Assigning direct child to variant:",
              childVariantId,
              "->",
              variantId
            );
          } else {
            // For nested children, map the parent relationship to the new variant tree
            const originalParentId = childNode.parentId;
            if (originalParentId) {
              const newParentId = idMap.get(originalParentId);
              if (newParentId) {
                childVariant.parentId = newParentId;
                console.log(
                  "Mapped child parent:",
                  childVariantId,
                  "->",
                  newParentId
                );
              } else {
                console.log(
                  "Warning: Could not find parent mapping for:",
                  childNode.id,
                  "parent:",
                  originalParentId
                );
              }
            }
          }

          // Store the ID mapping for this node
          idMap.set(childNode.id, childVariantId);

          // Add to the nodes array
          draft.nodes.push(childVariant);
        });

        console.log(
          "Variant creation complete, created",
          mainChildren.length + 1,
          "nodes"
        );
      })
    );

    return variantId;
  }

  syncFromViewport(sourceViewportId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const sourceSubtree = getSubtree(draft.nodes, sourceViewportId);

        const otherViewports = draft.nodes.filter(
          (v) => v.isViewport && v.id !== sourceViewportId
        );

        for (const viewport of otherViewports) {
          const oldSubtree = getSubtree(draft.nodes, viewport.id);
          const oldMap = new Map<string, Node>();
          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport) continue;
            if (oldNode.sharedId) {
              oldMap.set(oldNode.sharedId, oldNode);
            }
          }

          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport) continue;
            const idx = draft.nodes.findIndex((x) => x.id === oldNode.id);
            if (idx !== -1) {
              draft.nodes.splice(idx, 1);
            }
          }

          const idMap = new Map<string | number, string | number>();
          for (const srcNode of sourceSubtree) {
            const cloned: Node = {
              ...srcNode,
              id: nanoid(),
              style: { ...srcNode.style },
            };

            const oldVnode = oldMap.get(srcNode.sharedId as string);
            if (oldVnode?.independentStyles) {
              for (const prop of Object.keys(oldVnode.style)) {
                if (oldVnode.independentStyles[prop]) {
                  cloned.style[prop] = oldVnode.style[prop];
                  cloned.independentStyles = cloned.independentStyles || {};
                  cloned.independentStyles[prop] = true;
                }
              }
            }

            idMap.set(srcNode.id, cloned.id);
            draft.nodes.push(cloned);
          }

          for (const srcNode of sourceSubtree) {
            const newId = idMap.get(srcNode.id);
            if (!newId) continue;

            const clonedNode = draft.nodes.find((n) => n.id === newId);
            if (!clonedNode) continue;

            if (srcNode.parentId === sourceViewportId) {
              clonedNode.parentId = viewport.id;
            } else {
              const newParent = idMap.get(srcNode.parentId || "");
              clonedNode.parentId = newParent ?? null;
            }
          }
        }
      })
    );
  }
}

function getSubtree(
  nodes: Node[],
  rootId: string | number,
  includeRoot = false
): Node[] {
  const result: Node[] = [];

  if (includeRoot) {
    const rootNode = nodes.find(
      (n) => n.id === rootId && n.type !== "placeholder"
    );
    if (rootNode) {
      result.push(rootNode);
    }
  }

  const queue = [rootId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = nodes.filter(
      (n) => n.parentId === currentId && n.type !== "placeholder"
    );
    for (const child of children) {
      result.push(child);
      queue.push(child.id);
    }
  }
  return result;
}
