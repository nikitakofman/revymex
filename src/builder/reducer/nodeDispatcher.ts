import { original, produce } from "immer";
import { nanoid } from "nanoid";
import { CSSProperties } from "react";
import { findIndexWithinParent, findParentViewport } from "../context/utils";

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
    isAbsoluteInFrame?: string;
  };
  isLocked?: boolean;
  sharedId?: string;
  independentStyles?: {
    [styleProperty: string]: boolean;
  };
  src?: string;
  text?: string;
  parentId?: string | null;
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
  isFixedInFrame?: boolean;
  isVariant?: boolean;
  variantParentId?: string | number;
  variantInfo?: VariantInfo;
  variantResponsiveId?: string;
  dynamicFamilyId?: string;
  originalParentId?: string;
  unsyncFromParentViewport?: boolean;
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

  /**
   * Add a node to the builder, with proper variant synchronization
   */
  addNode(
    node: Node,
    targetId: string | number | null,
    position: "before" | "after" | "inside" | null,
    shouldBeInViewport: boolean
  ) {
    let needsSync = false;
    let targetIsDynamic = false;
    let exactIndex = -1;

    this.setState((prev) =>
      produce(prev, (draft) => {
        const newNode = {
          ...node,
          inViewport: shouldBeInViewport,
          sharedId: shouldBeInViewport
            ? node.sharedId || nanoid()
            : node.sharedId,
          unsyncFromParentViewport: {},
          independentStyles: {},
          lowerSyncProps: {},
        };

        if (!targetId) {
          newNode.parentId = null;
          draft.nodes.push(newNode);
          return;
        }

        if (newNode.type === "image") {
          if (newNode.style.text) delete newNode.style.text;
          if (newNode.text) delete newNode.text;
        } else if (newNode.type === "text") {
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

        // Check if target is a dynamic element or variant
        targetIsDynamic =
          targetNode.isDynamic ||
          targetNode.isVariant ||
          targetNode.dynamicFamilyId ||
          (targetNode.isVariant && targetNode.dynamicParentId);

        // CRITICAL FIX: Only apply dynamic properties for "inside" position,
        // not for "before" or "after"
        if (targetIsDynamic && position === "inside") {
          // Adding to a variant
          if (targetNode.isVariant) {
            // Set all required variant properties
            newNode.isVariant = true;
            newNode.variantInfo = { ...targetNode.variantInfo };
            newNode.variantParentId = targetNode.id;

            // Set dynamic-related properties
            newNode.dynamicFamilyId = targetNode.dynamicFamilyId;
            newNode.dynamicParentId = targetNode.id;

            // Set viewport ID if available
            if (targetNode.dynamicViewportId) {
              newNode.dynamicViewportId = targetNode.dynamicViewportId;
            }

            // Flag for sync
            needsSync = true;
          }
          // Adding to a dynamic base node
          else if (targetNode.isDynamic || targetNode.dynamicFamilyId) {
            // Set dynamic properties
            newNode.dynamicParentId = targetNode.id;
            newNode.dynamicFamilyId = targetNode.dynamicFamilyId;

            // Set viewport ID if available
            if (targetNode.dynamicViewportId) {
              newNode.dynamicViewportId = targetNode.dynamicViewportId;
            }

            // Flag for sync
            needsSync = true;
          }
        } else if (position !== "inside") {
          // CRITICAL FIX: For "before" or "after" positions, ONLY inherit dynamic properties
          // from parent if parent itself is dynamic AND not a viewport
          const parentNode = targetNode.parentId
            ? draft.nodes.find((n) => n.id === targetNode.parentId)
            : null;

          // Explicitly clear all dynamic properties for sibling elements
          delete newNode.dynamicParentId;
          delete newNode.dynamicFamilyId;
          delete newNode.dynamicViewportId;
          delete newNode.variantParentId;
          delete newNode.isVariant;
          delete newNode.variantInfo;

          // Only re-apply if parent is dynamic and not a viewport
          if (
            parentNode &&
            !parentNode.isViewport &&
            (parentNode.isDynamic || parentNode.dynamicFamilyId)
          ) {
            newNode.dynamicParentId = parentNode.id;
            newNode.dynamicFamilyId = parentNode.dynamicFamilyId;

            if (parentNode.dynamicViewportId) {
              newNode.dynamicViewportId = parentNode.dynamicViewportId;
            }

            needsSync = true;
          }
        }

        if (position === "inside") {
          newNode.parentId = targetNode.id;
          const existingChildren = draft.nodes.filter(
            (n) => n.parentId === targetNode.id
          );
          exactIndex = existingChildren.length;
          draft.nodes.push(newNode);
        } else {
          newNode.parentId = targetNode.parentId;
          const siblings = draft.nodes.filter(
            (n) => n.parentId === targetNode.parentId
          );
          const siblingIndex = siblings.findIndex(
            (n) => n.id === targetNode.id
          );
          if (siblingIndex !== -1) {
            exactIndex = position === "after" ? siblingIndex + 1 : siblingIndex;
            const siblingInfo = draft.nodes
              .map((n, idx) => ({ node: n, index: idx }))
              .filter((obj) => obj.node.parentId === targetNode.parentId);
            const targetSiblingInfo = siblingInfo.find(
              (info) => info.node.id === targetId
            );
            if (targetSiblingInfo) {
              const insertGlobalIndex =
                position === "after"
                  ? targetSiblingInfo.index + 1
                  : targetSiblingInfo.index;
              draft.nodes.splice(insertGlobalIndex, 0, newNode);
              return;
            }
          }
          draft.nodes.push(newNode);
        }

        // Store the ordering info for later synchronization
        draft._lastAddedNodeInfo = {
          nodeId: newNode.id,
          sharedId: newNode.sharedId,
          parentId: newNode.parentId,
          position,
          targetId,
          exactIndex,
          viewportInfo: {
            sourceViewport: findParentViewport(targetNode.id, draft.nodes),
          },
        };
      })
    );

    // Call syncVariants if we're adding to a dynamic element or variant
    // Similar to how it's done in moveNode
    if (needsSync || targetIsDynamic) {
      setTimeout(() => {
        this.syncVariants(node.id);
      }, 0);
    }
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

  updateNodeStyle(
    nodeIds: (string | number)[],
    style: Partial<CSSProperties>,
    dynamicModeNodeId?: string | null,
    preventUnsync = false,
    preventCascade = false
  ) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // ──────────────────────────────────────────────
        // 1. Compute dynamic viewport ordering.
        // Get all nodes flagged as viewports, sort by viewportWidth (largest first)
        const viewportNodes = draft.nodes.filter((n) => n.isViewport);
        viewportNodes.sort((a, b) => b.viewportWidth - a.viewportWidth);
        const viewportOrder = viewportNodes.map((v) => v.id);
        // viewportOrder is now a dynamic array (e.g. [ "vp-large", "vp-medium", "vp-small", ... ])

        // Helper: Given a node, return its viewport id and its index in the dynamic ordering.
        const getNodeViewport = (
          node: any
        ): { vpId: string; index: number } => {
          const vpId =
            findParentViewport(node.parentId, draft.nodes) ||
            node.dynamicViewportId;
          const index = viewportOrder.indexOf(vpId);
          return { vpId, index };
        };

        // ──────────────────────────────────────────────
        // 2. Helper: Initialize node flags if not already defined.
        const initializeNodeFlags = (node: any) => {
          node.independentStyles = node.independentStyles || {};
          node.unsyncFromParentViewport = node.unsyncFromParentViewport || {};
          node.variantIndependentSync = node.variantIndependentSync || {};
          // Use a general flag to mark lower sync properties (replacing "tabletSyncProps")
          node.lowerSyncProps = node.lowerSyncProps || {};
        };

        // ──────────────────────────────────────────────
        // 3. Helper: Apply lower sync properties to a target node.
        // This flag indicates that a given property should be preserved
        // (i.e. not overwritten by a higher‑resolution sync).
        const applyLowerSyncProps = (target: any, changedProps: string[]) => {
          if (!target.lowerSyncProps) target.lowerSyncProps = {};
          changedProps.forEach((prop) => {
            if (!target.unsyncFromParentViewport?.[prop]) {
              target.lowerSyncProps[prop] = true;
            }
          });
        };

        // ──────────────────────────────────────────────
        // 4. Helper: Cascade sync flags from a higher‑resolution node to lower ones.
        // For nodes sharing the same sharedId, if the source node is at a higher resolution
        // (i.e. lower index) then mark the lower ones with a flag so that their property will not be overwritten.
        const maintainHigherToLowerSync = (
          sourceNode: any,
          changedProps: string[]
        ) => {
          if (!sourceNode || changedProps.length === 0) return;
          const { index: sourceIndex } = getNodeViewport(sourceNode);
          // For all nodes sharing the same sharedId and in a lower resolution (higher index):
          draft.nodes.forEach((n) => {
            if (n.sharedId !== sourceNode.sharedId) return;
            const { index } = getNodeViewport(n);
            if (index > sourceIndex) {
              applyLowerSyncProps(n, changedProps);
            }
          });
          // Also, for dynamic nodes, cascade to direct children.
          if (sourceNode.isDynamic) {
            const children = draft.nodes.filter(
              (n) => n.parentId === sourceNode.id
            );
            children.forEach((child) => {
              if (!child.sharedId) return;
              // For children with matching sharedId, mark lower ones
              draft.nodes
                .filter((n) => n.sharedId === child.sharedId)
                .forEach((n) => {
                  const { index } = getNodeViewport(n);
                  if (index > getNodeViewport(child).index) {
                    applyLowerSyncProps(n, changedProps);
                  }
                });
            });
          }
          // For dynamic nodes with variants, cascade to variant nodes and their children.
          if (sourceNode.isDynamic && sourceNode.dynamicFamilyId) {
            const variantNodes = draft.nodes.filter(
              (n) =>
                n.isVariant && n.dynamicFamilyId === sourceNode.dynamicFamilyId
            );
            variantNodes.forEach((variant) => {
              const { index: variantIndex } = getNodeViewport(variant);
              if (variantIndex > sourceIndex) {
                applyLowerSyncProps(variant, changedProps);
                const variantChildren = draft.nodes.filter(
                  (n) => n.parentId === variant.id
                );
                variantChildren.forEach((child) => {
                  if (!child.sharedId) return;
                  const { index: childIndex } = getNodeViewport(child);
                  if (childIndex > variantIndex) {
                    applyLowerSyncProps(child, changedProps);
                  }
                });
              }
            });
          }
        };

        // ──────────────────────────────────────────────
        // 5. Helper: Decide if a property should sync from a higher-resolution node to a lower one.
        const shouldSync = (
          sourceIndex: number,
          target: any,
          prop: string
        ): boolean => {
          // ALWAYS check unsyncFromParentViewport for ALL viewport indices, not just index 0
          if (target.unsyncFromParentViewport?.[prop]) {
            return false;
          }

          // For the highest resolution (index 0), also check lower-sync flags
          if (sourceIndex === 0) {
            if (target.isVariant && target.lowerSyncProps?.[prop]) {
              return false;
            }
            if (target.lowerSyncProps?.[prop]) {
              return false;
            }
          }
          return true;
        };

        // ──────────────────────────────────────────────
        // 6. Group style properties by type.
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
        const changedPropsArr = [
          ...Object.keys(positioningStyles),
          ...Object.keys(dimensionStyles),
          ...Object.keys(otherStyles),
        ];

        // ──────────────────────────────────────────────
        // 7. Prepare nodes to update and track processed ones.
        const processedNodes = new Set<string | number>();
        const nodesToUpdate = draft.nodes.filter((n) => nodeIds.includes(n.id));
        if (nodesToUpdate.length === 0) return;

        if (!dynamicModeNodeId) {
          nodesToUpdate.forEach((node) => {
            if (processedNodes.has(node.id)) return;
            processedNodes.add(node.id);

            // Apply the style changes directly to this node
            Object.assign(node.style, style);

            // Skip nodes without sharedId (no responsive counterparts)
            if (!node.sharedId && !node.isViewport) return;

            const { vpId: nodeViewportId, index: currentViewportIndex } =
              node.isViewport
                ? { vpId: node.id, index: viewportOrder.indexOf(node.id) }
                : getNodeViewport(node);

            // Initialize flags if they don't exist
            node.unsyncFromParentViewport = node.unsyncFromParentViewport || {};
            node.lowerSyncProps = node.lowerSyncProps || {};
            node.independentStyles = node.independentStyles || {};

            console.log(
              "updateNodeStyle called with preventUnsync:",
              preventUnsync
            );

            // If not in the highest resolution viewport AND not preventing unsync,
            // mark changed properties with protection flags
            if (currentViewportIndex > 0 && !preventUnsync) {
              Object.keys(style).forEach((prop) => {
                node.unsyncFromParentViewport[prop] = true;
                node.independentStyles[prop] = true;
              });
            }

            // Define positioning properties to skip for viewports
            const positioningProps = [
              "left",
              "top",
              "right",
              "bottom",
              "position",
              "x",
              "y",
            ];

            // ──────────────────────────────────────────────
            // CRITICAL: Handle Cascade Chain Logic
            // ──────────────────────────────────────────────

            // Modified cascade check that will only block cascading if a property has both
            // independentStyles AND unsyncFromParentViewport flags set
            const cascadeIsBlocked = (targetVpIndex, prop) => {
              // Skip integrity check if editing from desktop
              if (currentViewportIndex === 0) return false;

              // Find all nodes in all viewports between current and target
              const blockingNodes = [];

              for (let i = currentViewportIndex + 1; i < targetVpIndex; i++) {
                const vpId = viewportOrder[i];

                // Find all nodes in this intervening viewport with the same sharedId
                const vpNodes = node.isViewport
                  ? [viewportNodes.find((vp) => vp.id === vpId)].filter(Boolean)
                  : draft.nodes.filter(
                      (n) =>
                        n.id !== node.id &&
                        n.sharedId === node.sharedId &&
                        (n.dynamicViewportId === vpId ||
                          findParentViewport(n.parentId, draft.nodes) === vpId)
                    );

                blockingNodes.push(...vpNodes);
              }

              // CRITICAL: Only block cascading if a node has EXPLICITLY customized the property
              // by having BOTH independentStyles AND unsyncFromParentViewport set
              return blockingNodes.some(
                (n) =>
                  n.independentStyles &&
                  n.independentStyles[prop] &&
                  n.unsyncFromParentViewport &&
                  n.unsyncFromParentViewport[prop]
              );
            };

            // ──────────────────────────────────────────────
            // Handle Nodes in Same Viewport
            // ──────────────────────────────────────────────

            // First handle nodes in the same viewport
            const sameViewportNodes = node.isViewport
              ? []
              : draft.nodes.filter(
                  (n) =>
                    n.id !== node.id &&
                    n.sharedId === node.sharedId &&
                    (n.dynamicViewportId === nodeViewportId ||
                      findParentViewport(n.parentId, draft.nodes) ===
                        nodeViewportId)
                );

            sameViewportNodes.forEach((relatedNode) => {
              if (processedNodes.has(relatedNode.id)) return;

              // Initialize flags
              relatedNode.unsyncFromParentViewport =
                relatedNode.unsyncFromParentViewport || {};
              relatedNode.lowerSyncProps = relatedNode.lowerSyncProps || {};
              relatedNode.independentStyles =
                relatedNode.independentStyles || {};

              // Apply all styles to nodes in the same viewport
              Object.entries(style).forEach(([prop, value]) => {
                // Skip positioning properties for viewports
                if (relatedNode.isViewport && positioningProps.includes(prop))
                  return;
                relatedNode.style[prop] = value;

                // If in a non-highest viewport, mark as protected
                if (currentViewportIndex > 0) {
                  relatedNode.unsyncFromParentViewport[prop] = true;
                  relatedNode.independentStyles[prop] = true;
                }
              });

              processedNodes.add(relatedNode.id);
            });

            // ──────────────────────────────────────────────
            // Process Nodes in Lower Viewports
            // ──────────────────────────────────────────────

            // Get all viewport indices in ascending order
            if (!preventCascade) {
              // Get all viewport indices in ascending order
              const sortedViewportIndices = viewportOrder
                .map((_, i) => i)
                .sort((a, b) => a - b);

              // Process only viewports with indices higher than current
              const lowerViewportIndices = sortedViewportIndices.filter(
                (idx) => idx > currentViewportIndex
              );

              // Process each lower viewport
              lowerViewportIndices.forEach((vpIndex) => {
                const vpId = viewportOrder[vpIndex];

                // Find all nodes in this viewport with the same sharedId
                const vpNodes = node.isViewport
                  ? [viewportNodes.find((vp) => vp.id === vpId)].filter(Boolean)
                  : draft.nodes.filter(
                      (n) =>
                        n.id !== node.id &&
                        n.sharedId === node.sharedId &&
                        (n.dynamicViewportId === vpId ||
                          findParentViewport(n.parentId, draft.nodes) === vpId)
                    );

                vpNodes.forEach((targetNode) => {
                  if (processedNodes.has(targetNode.id)) return;

                  // Initialize flags
                  targetNode.unsyncFromParentViewport =
                    targetNode.unsyncFromParentViewport || {};
                  targetNode.lowerSyncProps = targetNode.lowerSyncProps || {};
                  targetNode.independentStyles =
                    targetNode.independentStyles || {};

                  // Process each property
                  Object.entries(style).forEach(([prop, value]) => {
                    // Skip positioning properties for viewports
                    if (
                      targetNode.isViewport &&
                      positioningProps.includes(prop)
                    ) {
                      return;
                    }

                    // DESKTOP VIEWPORT CHANGES: Respect all protection flags
                    if (currentViewportIndex === 0) {
                      // Skip if property has ANY protection
                      if (
                        targetNode.unsyncFromParentViewport[prop] ||
                        targetNode.lowerSyncProps[prop] ||
                        targetNode.independentStyles[prop]
                      ) {
                        return;
                      }

                      // Apply property from desktop
                      targetNode.style[prop] = value;
                    }
                    // MIDDLE VIEWPORT CHANGES: Check cascade blockage and respect independentStyles
                    else {
                      // Skip if this property is explicitly marked as independent in the target node
                      if (
                        targetNode.independentStyles &&
                        targetNode.independentStyles[prop]
                      ) {
                        return;
                      }

                      // CRITICAL: Check if cascade is blocked by explicit customizations in between
                      if (cascadeIsBlocked(vpIndex, prop)) {
                        return;
                      }

                      // Apply the style property - cascade is allowed
                      targetNode.style[prop] = value;

                      // Mark as unsync from higher viewports but NOT as independent
                      // This allows the cascade chain to continue while protecting from direct desktop changes
                      targetNode.unsyncFromParentViewport[prop] = true;
                    }
                  });

                  processedNodes.add(targetNode.id);
                });
              });
            }
          });
        } else {
          // Determine update flags.
          const isUpdatingBaseNodeChild = nodesToUpdate.some((nodeId) => {
            const node = draft.nodes.find((n) => n.id === nodeId);
            return (
              node &&
              node.parentId &&
              (this.isParentDynamic(node.parentId, draft.nodes) ||
                this.isAncestorDynamic(node.parentId, draft.nodes))
            );
          });
          const isUpdatingBaseNode = nodesToUpdate.some((nodeId) => {
            const node = draft.nodes.find((n) => n.id === nodeId);
            return node ? node.isDynamic : false;
          });
          const isUpdatingVariantOrChild = nodesToUpdate.some((nodeId) => {
            const node = draft.nodes.find((n) => n.id === nodeId);
            return (
              node &&
              (node.isVariant ||
                (node.parentId &&
                  (this.isParentVariant(node.parentId, draft.nodes) ||
                    this.isAncestorVariant(node.parentId, draft.nodes))))
            );
          });

          // Track updated viewports.
          const updatedViewportIds = new Set();
          nodesToUpdate.forEach((node) => {
            const vp =
              findParentViewport(node.parentId, draft.nodes) ||
              node.dynamicViewportId;
            if (vp) updatedViewportIds.add(vp);
          });

          // ──────────────────────────────────────────────
          // 8. Process each node.
          nodesToUpdate.forEach((node) => {
            if (processedNodes.has(node.id)) return;
            processedNodes.add(node.id);

            const { vpId: nodeViewportId, index: currentViewportIndex } =
              getNodeViewport(node);

            initializeNodeFlags(node);

            const isBaseNodeFlag = node.isDynamic;
            const isVariant = node.isVariant && !!node.variantInfo?.id;
            const isChildOfVariant = this.isParentVariant(
              node.parentId,
              draft.nodes
            );
            const isDescendantOfVariant = this.isAncestorVariant(
              node.parentId,
              draft.nodes
            );
            const isChildOfBase = this.isParentDynamic(
              node.parentId,
              draft.nodes
            );
            const isDescendantOfBase = this.isAncestorDynamic(
              node.parentId,
              draft.nodes
            );

            // For nodes not in the highest-resolution viewport (i.e. index !== 0):
            if (currentViewportIndex !== 0) {
              // CRITICAL FIX: Only mark actually changed properties as unsyncFromParentViewport
              Object.keys(style).forEach((prop) => {
                node.unsyncFromParentViewport[prop] = true;
              });

              // Cascade sync flags to lower-resolution nodes.
              maintainHigherToLowerSync(node, changedPropsArr);

              if (isBaseNodeFlag && node.sharedId) {
                const variantFamily = draft.nodes.filter((n) => {
                  if (!n.isVariant) return false;
                  if (n.dynamicFamilyId !== node.dynamicFamilyId) return false;
                  // Sync variant nodes that share the same viewport as this node.
                  const { vpId: nVp } = getNodeViewport(n);
                  return nVp === nodeViewportId;
                });
                variantFamily.forEach((variant) => {
                  // Only mark properties that are being changed
                  Object.keys(style).forEach((prop) => {
                    variant.unsyncFromParentViewport =
                      variant.unsyncFromParentViewport || {};
                    variant.unsyncFromParentViewport[prop] = true;
                  });
                });
              }
              if (!isBaseNodeFlag && node.sharedId) {
                const childFamily = draft.nodes.filter((n) => {
                  if (n.isDynamic) return false;
                  const { vpId: nVp } = getNodeViewport(n);
                  return n.sharedId === node.sharedId && nVp === nodeViewportId;
                });
                childFamily.forEach((child) => {
                  // Only mark properties that are being changed
                  Object.keys(style).forEach((prop) => {
                    child.unsyncFromParentViewport =
                      child.unsyncFromParentViewport || {};
                    child.unsyncFromParentViewport[prop] = true;
                  });
                });
              }
            }

            if (
              (isVariant || isChildOfVariant || isDescendantOfVariant) &&
              !isUpdatingBaseNodeChild
            ) {
              changedPropsArr.forEach((prop) => {
                node.independentStyles[prop] = true;
                node.variantIndependentSync[prop] = true;
              });
            }

            // Apply the style changes directly.
            Object.assign(
              node.style,
              positioningStyles,
              dimensionStyles,
              otherStyles
            );

            // ─────────────────────────────
            // TOP‑LEVEL BASE NODE SYNC:
            if (isBaseNodeFlag && node.sharedId) {
              const baseNodeCounterparts = draft.nodes.filter(
                (n) =>
                  n.sharedId === node.sharedId &&
                  n.isDynamic &&
                  n.id !== node.id
              );
              const relevantBaseNodes = baseNodeCounterparts.filter((n) => {
                const nVp =
                  n.dynamicViewportId ||
                  findParentViewport(n.parentId, draft.nodes);
                const nVpIndex = viewportOrder.indexOf(nVp);
                if (currentViewportIndex !== -1 && nVpIndex !== -1) {
                  const isDownward = nVpIndex > currentViewportIndex;
                  // CRITICAL FIX: Only check unsync for the specific properties being changed
                  const cannotSync = Object.keys(style).some(
                    (prop) => n.unsyncFromParentViewport?.[prop]
                  );
                  return isDownward && !cannotSync;
                }
                return false;
              });

              if (currentViewportIndex === 0) {
                // When in the highest-resolution viewport, protect nodes in any lower viewport
                // that have lowerSyncProps for properties we're changing
                draft.nodes.forEach((n) => {
                  const { vpId, index } = getNodeViewport(n);
                  // Check if the node is in a lower viewport and has lowerSyncProps for any property we're changing
                  if (index > 0 && n.lowerSyncProps) {
                    const hasProtectedProps = Object.keys(style).some(
                      (prop) => n.lowerSyncProps[prop]
                    );
                    if (hasProtectedProps) {
                      processedNodes.add(n.id);
                    }
                  }
                });
              }

              if (currentViewportIndex === 0) {
                // When in the highest-resolution viewport, protect nodes in the lowest-resolution viewport.
                const lowestViewportId =
                  viewportOrder[viewportOrder.length - 1];
                const nodesToProtect = draft.nodes.filter((n) => {
                  const { vpId } = getNodeViewport(n);
                  return (
                    vpId === lowestViewportId &&
                    n.lowerSyncProps &&
                    Object.keys(n.lowerSyncProps).length > 0
                  );
                });
                nodesToProtect.forEach((n) => processedNodes.add(n.id));
              }

              relevantBaseNodes.forEach((baseNode) => {
                if (processedNodes.has(baseNode.id)) return;
                processedNodes.add(baseNode.id);
                changedPropsArr.forEach((prop) => {
                  if (baseNode.unsyncFromParentViewport?.[prop]) return;
                  if (style[prop] !== undefined) {
                    baseNode.style[prop] = style[prop];
                  }
                });
              });
            }

            // ─────────────────────────────
            // SPECIAL HANDLING FOR BASE NODE CHILD/RESPONSIVE SYNCING:
            if (
              (isChildOfBase || isDescendantOfBase) &&
              node.variantResponsiveId &&
              currentViewportIndex < viewportOrder.length - 1
            ) {
              const childCounterparts = draft.nodes.filter(
                (n) =>
                  n.id !== node.id &&
                  n.variantResponsiveId === node.variantResponsiveId
              );
              childCounterparts.forEach((counterpart) => {
                if (processedNodes.has(counterpart.id)) return;
                const { vpId: counterpartVp, index: counterpartVpIndex } =
                  getNodeViewport(counterpart);
                // CRITICAL FIX: Only sync to lower viewports if they don't have unsyncFromParentViewport
                // Check for ANY property we're trying to change
                if (counterpartVpIndex <= currentViewportIndex) return;

                // ADD THIS CRITICAL CHECK RIGHT HERE:
                const hasPropertyProtection = Object.keys(style).some(
                  (prop) =>
                    counterpart.unsyncFromParentViewport &&
                    counterpart.unsyncFromParentViewport[prop]
                );

                if (hasPropertyProtection) {
                  processedNodes.add(counterpart.id);
                  return;
                }

                processedNodes.add(counterpart.id);
                changedPropsArr.forEach((prop) => {
                  if (!shouldSync(currentViewportIndex, counterpart, prop))
                    return;
                  if (style[prop] !== undefined) {
                    counterpart.style[prop] = style[prop];
                  }
                });

                // Sync responsive variants of this counterpart.
                const counterpartParent = draft.nodes.find(
                  (n) => n.id === counterpart.parentId
                );
                if (counterpartParent && counterpartParent.isDynamic) {
                  const variantsInViewport = draft.nodes.filter(
                    (n) =>
                      n.isVariant &&
                      n.dynamicFamilyId === counterpartParent.dynamicFamilyId &&
                      (n.dynamicViewportId === counterpartVp ||
                        findParentViewport(n.parentId, draft.nodes) ===
                          counterpartVp)
                  );
                  variantsInViewport.forEach((variant) => {
                    processedNodes.add(variant.id);
                    const variantChild = draft.nodes.find(
                      (n) =>
                        n.parentId === variant.id &&
                        n.sharedId === counterpart.sharedId
                    );
                    if (variantChild && !processedNodes.has(variantChild.id)) {
                      processedNodes.add(variantChild.id);
                      changedPropsArr.forEach((prop) => {
                        if (
                          !shouldSync(currentViewportIndex, variantChild, prop)
                        )
                          return;
                        if (style[prop] !== undefined) {
                          variantChild.style[prop] = style[prop];
                        }
                      });
                    }
                  });
                }
              });

              // NEW PASS: Sync variant counterparts by sharedId (ignoring variantResponsiveId).
              const variantCounterparts = draft.nodes.filter(
                (n) =>
                  n.isVariant &&
                  n.sharedId === node.sharedId &&
                  viewportOrder.indexOf(
                    n.dynamicViewportId ||
                      findParentViewport(n.parentId, draft.nodes)
                  ) > currentViewportIndex
              );
              variantCounterparts.forEach((variantNode) => {
                if (processedNodes.has(variantNode.id)) return;
                processedNodes.add(variantNode.id);
                changedPropsArr.forEach((prop) => {
                  if (!shouldSync(currentViewportIndex, variantNode, prop))
                    return;
                  if (style[prop] !== undefined) {
                    variantNode.style[prop] = style[prop];
                  }
                });
              });
            }

            // ─────────────────────────────
            // FEATURE: For variants and their children, sync with responsive counterparts.
            if (
              (isVariant || isChildOfVariant || isDescendantOfVariant) &&
              node.variantResponsiveId
            ) {
              const variantCounterparts = draft.nodes.filter(
                (n) =>
                  n.id !== node.id &&
                  n.variantResponsiveId === node.variantResponsiveId
              );

              if (currentViewportIndex === 0) {
                const lowestViewportId =
                  viewportOrder[viewportOrder.length - 1];
                const nodesToProtect = variantCounterparts.filter((n) => {
                  const { vpId } = getNodeViewport(n);
                  return (
                    vpId === lowestViewportId &&
                    n.lowerSyncProps &&
                    Object.keys(n.lowerSyncProps).length > 0
                  );
                });
                nodesToProtect.forEach((n) => {
                  processedNodes.add(n.id);
                });
              }

              const relevantCounterparts = variantCounterparts.filter((n) => {
                const { index: nVpIndex } = getNodeViewport(n);
                return nVpIndex >= currentViewportIndex;
              });

              relevantCounterparts.forEach((counterpart) => {
                if (processedNodes.has(counterpart.id)) return;
                processedNodes.add(counterpart.id);
                changedPropsArr.forEach((prop) => {
                  if (
                    currentViewportIndex === 0 &&
                    counterpart.lowerSyncProps?.[prop]
                  ) {
                    return;
                  }
                  if (style[prop] !== undefined) {
                    if (counterpart.unsyncFromParentViewport?.[prop]) return;
                    counterpart.style[prop] = style[prop];
                    counterpart.independentStyles =
                      counterpart.independentStyles || {};
                    counterpart.independentStyles[prop] = true;
                    counterpart.variantIndependentSync =
                      counterpart.variantIndependentSync || {};
                    counterpart.variantIndependentSync[prop] = true;
                  }
                });
              });
            }

            // ─────────────────────────────
            // STRICT DOWNWARD FLOW: Sync all nodes (by sharedId) in the same or lower viewports.
            if (node.sharedId) {
              const allRelevantNodes = draft.nodes.filter((n) => {
                if (n.id === node.id || n.sharedId !== node.sharedId)
                  return false;
                if (isBaseNodeFlag && !n.isDynamic) return false;
                if (isVariant) {
                  if (!n.isVariant) return false;
                  return n.variantInfo?.id === node.variantInfo?.id;
                }
                return true;
              });
              const relevantNodes = allRelevantNodes.filter((n) => {
                const nVp =
                  findParentViewport(n.parentId, draft.nodes) ||
                  n.dynamicViewportId;
                const nVpIndex = viewportOrder.indexOf(nVp);
                if (nodeViewportId === viewportOrder[0]) {
                  const hasIndependent = changedPropsArr.some(
                    (prop) =>
                      n.independentStyles?.[prop] ||
                      n.unsyncFromParentViewport?.[prop]
                  );
                  return !hasIndependent;
                } else if (currentViewportIndex !== -1) {
                  if (nVpIndex === -1) return false;
                  const isDownwardOrSame = nVpIndex >= currentViewportIndex;
                  if (nVpIndex === currentViewportIndex) {
                    const isFullyIndependent = changedPropsArr.some(
                      (prop) => n.independentStyles?.[prop]
                    );
                    return isDownwardOrSame && !isFullyIndependent;
                  } else {
                    const cannotSync = changedPropsArr.some(
                      (prop) =>
                        n.independentStyles?.[prop] ||
                        n.unsyncFromParentViewport?.[prop]
                    );
                    return isDownwardOrSame && !cannotSync;
                  }
                }
                return false;
              });
              relevantNodes.forEach((relatedNode) => {
                if (processedNodes.has(relatedNode.id)) return;
                processedNodes.add(relatedNode.id);
                const { vpId: relatedVp, index: relatedVpIndex } =
                  getNodeViewport(relatedNode);
                const shouldSkip = isVariant && relatedVp === viewportOrder[0];
                const propsToSync = shouldSkip
                  ? changedPropsArr.filter(
                      (p) =>
                        ![
                          "left",
                          "top",
                          "right",
                          "bottom",
                          "position",
                        ].includes(p)
                    )
                  : changedPropsArr;
                propsToSync.forEach((prop) => {
                  if (
                    currentViewportIndex === 0 &&
                    !shouldSync(currentViewportIndex, relatedNode, prop)
                  )
                    return;
                  if (relatedNode.independentStyles?.[prop]) return;
                  if (
                    relatedVpIndex !== currentViewportIndex &&
                    relatedNode.unsyncFromParentViewport?.[prop]
                  )
                    return;
                  if (style[prop] !== undefined) {
                    relatedNode.style[prop] = style[prop];
                    if (
                      !isUpdatingBaseNodeChild &&
                      !isUpdatingBaseNode &&
                      relatedVp !== viewportOrder[0] &&
                      relatedVpIndex > 0 &&
                      !relatedNode.independentStyles?.[prop]
                    ) {
                      relatedNode.unsyncFromParentViewport =
                        relatedNode.unsyncFromParentViewport || {};
                      relatedNode.unsyncFromParentViewport[prop] = true;
                    }
                  }
                });
              });
            }

            // ─────────────────────────────
            // For base nodes, sync with their variants.
            if (isBaseNodeFlag) {
              const allVariants = draft.nodes.filter(
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
              const relatedVariants = allVariants.filter((variant) => {
                const variantVp =
                  findParentViewport(variant.parentId, draft.nodes) ||
                  variant.dynamicViewportId;
                const variantVpIndex = viewportOrder.indexOf(variantVp);
                return currentViewportIndex > 0
                  ? variantVpIndex >= currentViewportIndex
                  : true;
              });

              if (nodeViewportId === viewportOrder[0]) {
                // Protect lower-resolution variants.
                const lowestViewportId =
                  viewportOrder[viewportOrder.length - 1];
                const lowerVariantsToProtect = draft.nodes.filter((n) => {
                  const { vpId } = getNodeViewport(n);
                  return (
                    vpId === lowestViewportId &&
                    n.isVariant &&
                    n.lowerSyncProps &&
                    Object.keys(n.lowerSyncProps).length > 0
                  );
                });
                lowerVariantsToProtect.forEach((n) => {
                  processedNodes.add(n.id);
                  const variantChildren = draft.nodes.filter(
                    (child) => child.parentId === n.id
                  );
                  variantChildren.forEach((child) => {
                    if (
                      child.lowerSyncProps &&
                      Object.keys(child.lowerSyncProps).length > 0
                    ) {
                      processedNodes.add(child.id);
                    }
                  });
                });
              }

              relatedVariants.forEach((variant) => {
                if (processedNodes.has(variant.id)) return;
                const isIndep = changedPropsArr.some(
                  (prop) => variant.variantIndependentSync?.[prop]
                );
                if (isIndep) return;
                processedNodes.add(variant.id);
                const variantVp =
                  findParentViewport(variant.parentId, draft.nodes) ||
                  variant.dynamicViewportId;
                const propsToSync =
                  !variantVp || variantVp === viewportOrder[0]
                    ? changedPropsArr.filter(
                        (p) =>
                          ![
                            "left",
                            "top",
                            "right",
                            "bottom",
                            "position",
                          ].includes(p)
                      )
                    : changedPropsArr;

                if (nodeViewportId === viewportOrder[0] && isVariant) {
                  const lowerCounterparts = draft.nodes.filter(
                    (n) =>
                      n.isVariant &&
                      n.variantInfo?.id === variant.variantInfo?.id &&
                      (n.dynamicViewportId ===
                        viewportOrder[viewportOrder.length - 1] ||
                        findParentViewport(n.parentId, draft.nodes) ===
                          viewportOrder[viewportOrder.length - 1]) &&
                      n.lowerSyncProps &&
                      Object.keys(n.lowerSyncProps).length > 0
                  );
                  lowerCounterparts.forEach((n) => {
                    processedNodes.add(n.id);
                    const lowerChildren = draft.nodes.filter(
                      (child) => child.parentId === n.id
                    );
                    lowerChildren.forEach((child) => {
                      if (
                        child.lowerSyncProps &&
                        Object.keys(child.lowerSyncProps).length > 0
                      ) {
                        processedNodes.add(child.id);
                      }
                    });
                  });
                }

                propsToSync.forEach((prop) => {
                  if (
                    nodeViewportId === viewportOrder[0] &&
                    variant.dynamicViewportId ===
                      viewportOrder[viewportOrder.length - 1] &&
                    variant.lowerSyncProps?.[prop]
                  ) {
                    return;
                  }
                });

                propsToSync.forEach((prop) => {
                  if (variant.independentStyles?.[prop]) return;
                  if (variant.variantIndependentSync?.[prop]) return;
                  const variantVpIndex = viewportOrder.indexOf(variantVp);
                  if (
                    variantVpIndex !== currentViewportIndex &&
                    variant.unsyncFromParentViewport?.[prop]
                  )
                    return;
                  if (style[prop] !== undefined) {
                    variant.style[prop] = style[prop];
                  }
                });

                if (Object.keys(dimensionStyles).length > 0) {
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
                      const cannotSyncWidth =
                        child.independentStyles?.width ||
                        child.variantIndependentSync?.width ||
                        (child.unsyncFromParentViewport?.width &&
                          variant.dynamicViewportId !== nodeViewportId);
                      const cannotSyncHeight =
                        child.independentStyles?.height ||
                        child.variantIndependentSync?.height ||
                        (child.unsyncFromParentViewport?.height &&
                          variant.dynamicViewportId !== nodeViewportId);
                      if (!cannotSyncWidth && !cannotSyncHeight) {
                        if (child.style.width !== baseChild.style.width) {
                          child.style.width = baseChild.style.width;
                        }
                        if (child.style.height !== baseChild.style.height) {
                          child.style.height = baseChild.style.height;
                        }
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

            // Replace your final sync code section with this more precise version
            // It correctly handles variant syncing by checking variantResponsiveId

            if (currentViewportIndex === 0 && Object.keys(style).length > 0) {
              // Keep track of which properties were synced to which nodes
              const syncedNodesMap = new Map();

              // For each viewport from highest to lowest
              for (let i = 1; i < viewportOrder.length; i++) {
                const targetVpId = viewportOrder[i];

                // Find all nodes with the same sharedId in this viewport
                const vpCounterparts = draft.nodes.filter(
                  (n) =>
                    n.sharedId === node.sharedId &&
                    (n.dynamicViewportId === targetVpId ||
                      findParentViewport(n.parentId, draft.nodes) ===
                        targetVpId)
                );

                // For each counterpart, check if it needs property updates
                vpCounterparts.forEach((counterpart) => {
                  // Skip if node is a variant and we're not updating a variant
                  if (isVariant && !counterpart.isVariant) {
                    return;
                  }

                  // Skip if node is not a variant and we're updating a variant
                  if (!isVariant && counterpart.isVariant) {
                    return;
                  }

                  // If we're dealing with variants, make sure they're the same variant type
                  if (isVariant && counterpart.isVariant) {
                    // CRITICAL FIX: Only sync between variants with the same variantResponsiveId
                    if (
                      node.variantResponsiveId !==
                      counterpart.variantResponsiveId
                    ) {
                      return;
                    }
                  }

                  // Check each property being changed
                  Object.entries(style).forEach(([prop, value]) => {
                    // Skip if property has explicit protection
                    if (
                      counterpart.lowerSyncProps?.[prop] ||
                      counterpart.unsyncFromParentViewport?.[prop]
                    ) {
                      return;
                    }

                    // Skip if property is already correctly set
                    if (counterpart.style[prop] === value) {
                      return;
                    }

                    // Property should be synced and isn't protected - FORCE SYNC IT
                    counterpart.style[prop] = value;

                    // Record this sync for debugging
                    if (!syncedNodesMap.has(counterpart.id)) {
                      syncedNodesMap.set(counterpart.id, new Set());
                    }
                    syncedNodesMap.get(counterpart.id).add(prop);
                  });
                });

                // Do the same for variants if this is a base node
                if (isBaseNodeFlag && node.dynamicFamilyId) {
                  const vpVariants = draft.nodes.filter(
                    (n) =>
                      n.isVariant &&
                      n.dynamicFamilyId === node.dynamicFamilyId &&
                      (n.dynamicViewportId === targetVpId ||
                        findParentViewport(n.parentId, draft.nodes) ===
                          targetVpId)
                  );

                  vpVariants.forEach((variant) => {
                    // Check each property being changed
                    Object.entries(style).forEach(([prop, value]) => {
                      // Skip positioning properties
                      if (
                        ["left", "top", "right", "bottom", "position"].includes(
                          prop
                        ) &&
                        targetVpId === viewportOrder[0]
                      ) {
                        return;
                      }

                      // Skip if property has explicit protection
                      if (
                        variant.lowerSyncProps?.[prop] ||
                        variant.unsyncFromParentViewport?.[prop] ||
                        variant.independentStyles?.[prop] ||
                        variant.variantIndependentSync?.[prop]
                      ) {
                        return;
                      }

                      // Skip if property is already correctly set
                      if (variant.style[prop] === value) {
                        return;
                      }

                      // Property should be synced and isn't protected - FORCE SYNC IT
                      variant.style[prop] = value;

                      // Record this sync for debugging
                      if (!syncedNodesMap.has(variant.id)) {
                        syncedNodesMap.set(variant.id, new Set());
                      }
                      syncedNodesMap.get(variant.id).add(prop);
                    });
                  });
                }

                // ADDITIONAL FIX: Handle syncing from a variant to its responsive variants
                if (isVariant && node.variantResponsiveId) {
                  const variantCounterparts = draft.nodes.filter(
                    (n) =>
                      n.isVariant &&
                      n.variantResponsiveId === node.variantResponsiveId &&
                      n.id !== node.id &&
                      (n.dynamicViewportId === targetVpId ||
                        findParentViewport(n.parentId, draft.nodes) ===
                          targetVpId)
                  );

                  variantCounterparts.forEach((counterpart) => {
                    // Check each property being changed
                    Object.entries(style).forEach(([prop, value]) => {
                      // Skip if property has explicit protection
                      if (
                        counterpart.lowerSyncProps?.[prop] ||
                        counterpart.unsyncFromParentViewport?.[prop] ||
                        counterpart.independentStyles?.[prop] ||
                        counterpart.variantIndependentSync?.[prop]
                      ) {
                        return;
                      }

                      // Skip if property is already correctly set
                      if (counterpart.style[prop] === value) {
                        return;
                      }

                      // Property should be synced and isn't protected
                      counterpart.style[prop] = value;

                      // Record this sync for debugging
                      if (!syncedNodesMap.has(counterpart.id)) {
                        syncedNodesMap.set(counterpart.id, new Set());
                      }
                      syncedNodesMap.get(counterpart.id).add(prop);
                    });
                  });
                }
              }

              // Log sync summary
              if (syncedNodesMap.size > 0) {
                syncedNodesMap.forEach((props, nodeId) => {});
              } else {
              }
            }
          });
        }

        // ──────────────────────────────────────────────
        // Final pass: Fix any detached children (e.g. variant children with absolute positioning).
        draft.nodes.forEach((node) => {
          const parent = node.parentId
            ? draft.nodes.find((n) => n.id === node.parentId)
            : null;
          if (parent && parent.isVariant) {
            if (node.style.position === "absolute" && node.sharedId) {
              node.style.position = "relative";
              node.style.left = "";
              node.style.top = "";
              node.independentStyles = node.independentStyles || {};
              node.independentStyles.position = true;
              node.independentStyles.left = true;
              node.independentStyles.top = true;
            }
          }
        });
      })
    );
  }

  /**
   * Directly push multiple nodes to the state
   * Used for operations like duplicating dynamic elements
   * that need to preserve exact structure
   */
  pushNodes(nodes: Node[]) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Add all nodes to the end of the array
        draft.nodes.push(...nodes);
      })
    );

    return nodes;
  }

  // Helper functions
  findParentViewport(
    nodeId: string | number | null | undefined,
    allNodes: Node[]
  ): string | number | null {
    if (!nodeId) return null;
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) return null;
    if (node.isViewport) return node.id;
    return node.parentId ? findParentViewport(node.parentId, allNodes) : null;
  }

  isParentVariant(
    parentId: string | number | null | undefined,
    allNodes: Node[]
  ): boolean {
    if (!parentId) return false;
    const parent = allNodes.find((n) => n.id === parentId);
    return parent ? parent.isVariant : false;
  }

  isParentDynamic(
    parentId: string | number | null | undefined,
    allNodes: Node[]
  ): boolean {
    if (!parentId) return false;
    const parent = allNodes.find((n) => n.id === parentId);
    return parent ? parent.isDynamic : false;
  }

  isAncestorVariant(
    parentId: string | number | null | undefined,
    allNodes: Node[]
  ): boolean {
    if (!parentId) return false;

    let current = parentId;
    while (current) {
      const node = allNodes.find((n) => n.id === current);
      if (!node) break;

      if (node.isVariant) return true;
      current = node.parentId;
    }

    return false;
  }

  isAncestorDynamic(
    parentId: string | number | null | undefined,
    allNodes: Node[]
  ): boolean {
    if (!parentId) return false;

    let current = parentId;
    while (current) {
      const node = allNodes.find((n) => n.id === current);
      if (!node) break;

      if (node.isDynamic) return true;
      current = node.parentId;
    }

    return false;
  }

  findRootBaseNodeAncestor(
    nodeId: string | number | null | undefined,
    allNodes: Node[]
  ): Node | null {
    if (!nodeId) return null;

    let current = nodeId;
    let lastDynamic = null;

    while (current) {
      const node = allNodes.find((n) => n.id === current);
      if (!node) break;

      if (node.isDynamic) {
        lastDynamic = node;
      }

      if (!node.parentId) break;
      current = node.parentId;
    }

    return lastDynamic;
  }

  buildPathFromRoot(
    rootId: string | number,
    targetId: string | number,
    allNodes: Node[]
  ): Node[] {
    const path: Node[] = [];
    let current = targetId;

    while (current && current !== rootId) {
      const node = allNodes.find((n) => n.id === current);
      if (!node) break;

      path.unshift(node);
      current = node.parentId;
    }

    // Add the root node
    const rootNode = allNodes.find((n) => n.id === rootId);
    if (rootNode) {
      path.unshift(rootNode);
    }

    return path;
  }

  followPathInViewport(
    rootId: string | number,
    path: Node[],
    allNodes: Node[]
  ): Node | null {
    if (path.length <= 1) return null;

    let currentId = rootId;

    // Skip the first node (root)
    for (let i = 1; i < path.length; i++) {
      const pathNode = path[i];

      // Find child with matching sharedId
      const matchingChild = allNodes.find(
        (n) => n.parentId === currentId && n.sharedId === pathNode.sharedId
      );

      if (!matchingChild) return null;

      currentId = matchingChild.id;

      // If this is the last node, return it
      if (i === path.length - 1) {
        return matchingChild;
      }
    }

    return null;
  }

  syncVariants(nodeId) {
    // Get current state
    let currentState = this.getNodeState();

    // Find the node and its parent
    const node = currentState.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    console.log("syncving....");

    // Ensure node has a sharedId
    if (!node.sharedId) {
      this.setState((prev) =>
        produce(prev, (draft) => {
          const draftNode = draft.nodes.find((n) => n.id === nodeId);
          if (draftNode) {
            draftNode.sharedId = nanoid();
          }
        })
      );

      // Get updated state
      currentState = this.getNodeState();
      const updatedNode = currentState.nodes.find((n) => n.id === nodeId);
      if (updatedNode) {
        node.sharedId = updatedNode.sharedId;
      }
    }

    const parentNode = currentState.nodes.find((n) => n.id === node.parentId);
    if (!parentNode) {
      return;
    }

    // Determine if parent is a base node, a variant, or a child of either
    const isBaseNodeHierarchy = this.isInBaseNodeHierarchy(node.id);
    const isVariantHierarchy = this.isInVariantHierarchy(node.id);

    // Define viewport order for downward flow
    const viewportOrder = ["viewport-1440", "viewport-768", "viewport-375"];

    // Get the current viewport ID
    const currentViewportId = this.getNodeViewportId(
      parentNode,
      this.getNodeState
    );

    this.setState((prev) =>
      produce(prev, (draft) => {
        // Get the node and parent in draft state
        const draftNode = draft.nodes.find((n) => n.id === nodeId);
        if (!draftNode) {
          return;
        }

        const draftParent = draft.nodes.find(
          (n) => n.id === draftNode.parentId
        );
        if (!draftParent) {
          return;
        }

        // CRITICAL: Ensure parent has a variantResponsiveId
        if (!draftParent.variantResponsiveId) {
          // Find all nodes with the same sharedId that might be responsive counterparts
          const potentialCounterparts = draft.nodes.filter(
            (n) =>
              n.sharedId === draftParent.sharedId && n.id !== draftParent.id
          );

          // Generate a new responsiveId for this parent and its counterparts
          const parentResponsiveId = nanoid();
          draftParent.variantResponsiveId = parentResponsiveId;

          // Assign the same responsiveId to all counterparts
          potentialCounterparts.forEach((counterpart) => {
            counterpart.variantResponsiveId = parentResponsiveId;
          });
        }

        // Generate a unique variantResponsiveId for this child
        const childResponsiveId = nanoid();

        // Set it on the original node
        draftNode.variantResponsiveId = childResponsiveId;

        // CASE 1: In a base node hierarchy
        if (isBaseNodeHierarchy) {
          // First, find all responsive counterparts of the parent
          const allParentCounterparts = draft.nodes.filter(
            (n) =>
              n.variantResponsiveId === draftParent.variantResponsiveId &&
              n.id !== draftParent.id
          );

          // Apply downward flow filtering
          const currentViewportIndex = viewportOrder.indexOf(currentViewportId);

          const parentCounterparts =
            currentViewportIndex !== -1
              ? allParentCounterparts.filter((n) => {
                  const counterpartViewportId = this.getNodeViewportId(
                    n,
                    draft.nodes
                  );
                  const counterpartViewportIndex = viewportOrder.indexOf(
                    counterpartViewportId
                  );
                  // Only include counterparts that are below the current viewport in the order
                  return (
                    counterpartViewportIndex !== -1 &&
                    counterpartViewportIndex > currentViewportIndex
                  );
                })
              : allParentCounterparts;

          // Sync to responsive counterparts
          parentCounterparts.forEach((counterpart, idx) => {
            // Check for existing child with same sharedId
            const existingChild = draft.nodes.find(
              (n) =>
                n.parentId === counterpart.id &&
                n.sharedId === draftNode.sharedId
            );

            if (existingChild) {
              // Link with other responsive counterparts
              existingChild.variantResponsiveId = childResponsiveId;

              // Update properties
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
                  key !== "dynamicViewportId" &&
                  key !== "position"
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
              // Create new child
              const newChild = {
                ...draftNode,
                id: nanoid(),
                // Set parentId to the counterpart - this maintains the proper hierarchy
                parentId: counterpart.id,
                style: { ...draftNode.style },
                independentStyles: {},
                // Link with other responsive counterparts
                variantResponsiveId: childResponsiveId,
              };

              // Copy necessary properties from parent
              if (counterpart.dynamicViewportId) {
                newChild.dynamicViewportId = counterpart.dynamicViewportId;
              }

              // Add to nodes array
              draft.nodes.push(newChild);
            }
          });

          // Now sync to variants - need to find the root of this hierarchy first
          const rootNode = this.findBaseNodeRoot(draftNode.id, draft.nodes);
          if (!rootNode) {
            return;
          }

          // Find the family ID
          const familyId = rootNode.dynamicFamilyId;
          if (!familyId) {
            return;
          }

          // Find the path from the root to our parent
          const pathFromRoot = this.buildPathFromRoot2(
            rootNode.id,
            draftParent.id,
            draft.nodes
          );

          // Find all variants in this family
          const allVariants = draft.nodes.filter(
            (n) => n.dynamicFamilyId === familyId && n.isVariant && !n.parentId
          );

          // Group variants by their type
          const variantsByType = {};
          allVariants.forEach((variant) => {
            const variantTypeId = variant.variantInfo?.id;
            if (!variantTypeId) return;

            if (!variantsByType[variantTypeId]) {
              variantsByType[variantTypeId] = [];
            }

            variantsByType[variantTypeId].push(variant);
          });

          // Process each variant type
          Object.entries(variantsByType).forEach(
            ([variantTypeId, variants]) => {
              // Generate a unique variantResponsiveId for this child across all variants of this type
              const variantTypeChildResponsiveId = nanoid();

              // Filter variants based on downward flow
              const filteredVariants =
                currentViewportIndex !== -1
                  ? variants.filter((v) => {
                      const variantViewportId = this.getNodeViewportId(
                        v,
                        draft.nodes
                      );
                      const variantViewportIndex =
                        viewportOrder.indexOf(variantViewportId);
                      return (
                        variantViewportIndex === -1 ||
                        variantViewportIndex >= currentViewportIndex
                      );
                    })
                  : variants;

              // For each variant, find the corresponding parent path
              filteredVariants.forEach((variant, idx) => {
                // Follow the same path in the variant as in the base node
                const variantParent = this.followPathInVariant(
                  variant.id,
                  pathFromRoot,
                  draft.nodes
                );

                if (!variantParent) {
                  return;
                }

                // Check for existing child with same sharedId
                const existingChild = draft.nodes.find(
                  (n) =>
                    n.parentId === variantParent.id &&
                    n.sharedId === draftNode.sharedId
                );

                if (existingChild) {
                  // Link with other responsive counterparts of this same variant type
                  existingChild.variantResponsiveId =
                    variantTypeChildResponsiveId;

                  // Update properties
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
                      key !== "dynamicViewportId" &&
                      key !== "variantResponsiveId" &&
                      key !== "position"
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
                  // Create new child
                  const newChild = {
                    ...draftNode,
                    id: nanoid(),
                    parentId: variantParent.id,
                    style: { ...draftNode.style },
                    independentStyles: {},
                    // Set variant properties
                    isVariant: true,
                    // Link with other responsive counterparts of this variant type
                    variantResponsiveId: variantTypeChildResponsiveId,
                  };

                  // Get variant properties from closest variant ancestor
                  const variantAncestor = this.findVariantAncestor(
                    variantParent.id,
                    draft.nodes
                  );
                  if (variantAncestor) {
                    newChild.variantParentId = variantAncestor.id;
                    newChild.dynamicParentId = variantAncestor.dynamicParentId;
                    newChild.variantInfo = variantAncestor.variantInfo;
                  }

                  // Set viewport ID
                  const variantViewportId = this.getNodeViewportId(
                    variant,
                    draft.nodes
                  );
                  if (variantViewportId) {
                    newChild.dynamicViewportId = variantViewportId;
                  }

                  // Add to nodes array
                  draft.nodes.push(newChild);
                }
              });
            }
          );
        }
        // CASE 2: In a variant hierarchy
        else if (isVariantHierarchy) {
          // Find all responsive counterparts of the parent using variantResponsiveId
          const allCounterparts = draft.nodes.filter(
            (n) =>
              n.variantResponsiveId === draftParent.variantResponsiveId &&
              n.id !== draftParent.id
          );

          // Filter counterparts based on downward flow
          const currentViewportIndex = viewportOrder.indexOf(currentViewportId);

          const parentCounterparts =
            currentViewportIndex !== -1
              ? allCounterparts.filter((n) => {
                  const counterpartViewportId = this.getNodeViewportId(
                    n,
                    draft.nodes
                  );
                  const counterpartViewportIndex = viewportOrder.indexOf(
                    counterpartViewportId
                  );
                  // Only include counterparts that are below the current viewport in the order
                  return (
                    counterpartViewportIndex !== -1 &&
                    counterpartViewportIndex > currentViewportIndex
                  );
                })
              : allCounterparts;

          // For each responsive counterpart of the parent, add/update the child
          parentCounterparts.forEach((counterpart, idx) => {
            // Check for existing child with same sharedId
            const existingChild = draft.nodes.find(
              (n) =>
                n.parentId === counterpart.id &&
                n.sharedId === draftNode.sharedId
            );

            if (existingChild) {
              // Link with other responsive counterparts
              existingChild.variantResponsiveId = childResponsiveId;

              // Update properties
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
                  key !== "dynamicViewportId" &&
                  key !== "position"
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
              // Create new child
              const newChild = {
                ...draftNode,
                id: nanoid(),
                // Set parentId to the counterpart - this maintains the proper hierarchy
                parentId: counterpart.id,
                style: { ...draftNode.style },
                independentStyles: {},
                // Link with other responsive counterparts
                variantResponsiveId: childResponsiveId,
              };

              // Copy necessary properties from parent
              // Inherit variant info if parent is a variant
              if (counterpart.isVariant) {
                newChild.isVariant = true;
                newChild.variantParentId =
                  counterpart.variantParentId || counterpart.id;
                newChild.variantInfo = counterpart.variantInfo;
              }

              // Handle dynamicParentId and viewportId
              if (counterpart.dynamicParentId) {
                newChild.dynamicParentId = counterpart.dynamicParentId;
              }

              if (counterpart.dynamicViewportId) {
                newChild.dynamicViewportId = counterpart.dynamicViewportId;
              }

              // Add to nodes array
              draft.nodes.push(newChild);
            }
          });
        }
      })
    );
  }

  // Helper method to check if a node is somewhere in a base node hierarchy
  isInBaseNodeHierarchy(nodeId) {
    const currentState = this.getNodeState();
    const node = currentState.nodes.find((n) => n.id === nodeId);
    if (!node || !node.parentId) return false;

    let currentParentId = node.parentId;
    while (currentParentId) {
      const parent = currentState.nodes.find((n) => n.id === currentParentId);
      if (!parent) break;

      // If any ancestor is a base node, we're in a base node hierarchy
      if (parent.isDynamic) return true;

      if (!parent.parentId) break;
      currentParentId = parent.parentId;
    }

    return false;
  }

  // Helper method to check if a node is somewhere in a variant hierarchy
  isInVariantHierarchy(nodeId) {
    const currentState = this.getNodeState();
    const node = currentState.nodes.find((n) => n.id === nodeId);
    if (!node || !node.parentId) return false;

    let currentParentId = node.parentId;
    while (currentParentId) {
      const parent = currentState.nodes.find((n) => n.id === currentParentId);
      if (!parent) break;

      // If any ancestor is a variant, we're in a variant hierarchy
      if (parent.isVariant) return true;

      if (!parent.parentId) break;
      currentParentId = parent.parentId;
    }

    return false;
  }

  // Helper method to get the viewport ID for a node
  getNodeViewportId(node, nodesArray) {
    if (!node) return null;

    // If node has a dynamicViewportId, use it
    if (node.dynamicViewportId) {
      return node.dynamicViewportId;
    }

    // Otherwise traverse up to find a viewport
    let currentId = node.parentId;
    const nodes = nodesArray || this.getNodeState().nodes;

    while (currentId) {
      const parent = nodes.find((n) => n.id === currentId);
      if (!parent) break;

      if (parent.isViewport) {
        return parent.id;
      }

      if (parent.dynamicViewportId) {
        return parent.dynamicViewportId;
      }

      if (!parent.parentId) break;
      currentId = parent.parentId;
    }

    return null;
  }

  // Helper to find the base node root of a hierarchy
  findBaseNodeRoot(nodeId, nodes) {
    let current = nodes.find((n) => n.id === nodeId);
    if (!current || !current.parentId) return null;

    let path = [];

    while (current && current.parentId) {
      path.push(current);
      const parent = nodes.find((n) => n.id === current.parentId);
      if (!parent) break;

      if (parent.isDynamic) {
        return parent;
      }

      current = parent;
    }

    return null;
  }

  // Helper to build a path from root to a node
  buildPathFromRoot2(rootId, nodeId, nodes) {
    // If node is the root, return empty path
    if (rootId === nodeId) {
      return [];
    }

    const path = [];
    let current = nodes.find((n) => n.id === nodeId);

    while (current && current.id !== rootId) {
      path.unshift(current); // Add to start

      if (!current.parentId) break;
      current = nodes.find((n) => n.id === current.parentId);
      if (!current) break;
    }

    return path;
  }

  // Helper to follow a path in a variant
  followPathInVariant(variantRootId, path, nodes) {
    if (path.length === 0) {
      // If no path, the variant root is the target parent
      return nodes.find((n) => n.id === variantRootId);
    }

    let current = nodes.find((n) => n.id === variantRootId);
    if (!current) return null;

    // For each node in the path, find the corresponding child in the variant
    for (let i = 0; i < path.length; i++) {
      const pathNode = path[i];

      // Find child with matching sharedId
      const matchingChild = nodes.find(
        (n) => n.parentId === current.id && n.sharedId === pathNode.sharedId
      );

      if (!matchingChild) {
        // If no direct match, try using variantResponsiveId
        if (pathNode.variantResponsiveId) {
          const matchByResponsiveId = nodes.find(
            (n) =>
              n.parentId === current.id &&
              n.variantResponsiveId === pathNode.variantResponsiveId
          );

          if (matchByResponsiveId) {
            current = matchByResponsiveId;
            continue;
          }
        }

        // If still no match, try a broader search
        const anyMatchingNode = nodes.find(
          (n) =>
            n.sharedId === pathNode.sharedId &&
            this.isDescendantOf(n.id, variantRootId, nodes)
        );

        if (anyMatchingNode) {
          current = anyMatchingNode;
          continue;
        }

        // No match found
        return null;
      }

      current = matchingChild;
    }

    return current;
  }

  // Helper to check if a node is a descendant of another
  isDescendantOf(childId, ancestorId, nodes) {
    let current = nodes.find((n) => n.id === childId);
    if (!current || !current.parentId) return false;

    if (current.parentId === ancestorId) return true;

    return this.isDescendantOf(current.parentId, ancestorId, nodes);
  }

  // Helper to find the nearest variant ancestor
  findVariantAncestor(nodeId, nodes) {
    let current = nodes.find((n) => n.id === nodeId);
    if (!current) return null;

    // If node itself is a variant, return it
    if (current.isVariant) return current;

    // Otherwise traverse up to find a variant ancestor
    let currentId = current.parentId;

    while (currentId) {
      const parent = nodes.find((n) => n.id === currentId);
      if (!parent) break;

      if (parent.isVariant) {
        return parent;
      }

      if (!parent.parentId) break;
      currentId = parent.parentId;
    }

    return null;
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

        // Ensure the node has a sharedId
        if (!node.sharedId) {
          node.sharedId = nanoid();
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

        // STEP 2: Find all related dynamic nodes across viewports
        const allDynamicNodes = draft.nodes.filter(
          (n) => n.isDynamic && n.sharedId === rootDynamicNode.sharedId
        );

        // STEP 3: Find all variants of all these dynamic nodes
        const allVariants = draft.nodes.filter(
          (n) =>
            n.isVariant &&
            allDynamicNodes.some(
              (d) => n.dynamicParentId === d.id || n.variantParentId === d.id
            )
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
            return;
          }

          // CRITICAL: Check if this parent already has a child with this sharedId
          // If it does, just update it - don't create a new one
          const existingChild = draft.nodes.find(
            (n) =>
              n.parentId === correspondingParent!.id &&
              n.sharedId === node.sharedId
          );

          if (existingChild) {
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
                children.forEach((child) => {
                  syncNodeWithTarget(child, existingChild, draft.nodes);
                });
              }
            }
          } else {
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
                children.forEach((child) => {
                  syncNodeWithTarget(child, newChild, draft.nodes);
                });
              }
            }
          }
        });
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
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Get all dynamic nodes
        const dynamicNodes = draft.nodes.filter((n) => n.isDynamic);

        // Get all variants
        const allVariants = draft.nodes.filter((n) => n.isVariant);

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
              // Keep the most recently added one (usually the last in the array)
              // Sort by ID to ensure deterministic behavior
              const sortedChildren = [...children].sort((a, b) =>
                a.id.localeCompare(b.id as string)
              );
              const keepChild = sortedChildren[sortedChildren.length - 1];

              // Remove all but the one we want to keep
              sortedChildren.slice(0, -1).forEach((childToRemove) => {
                // Get all descendants of this child to also remove
                const descendantsToRemove = getAllDescendants(
                  childToRemove.id,
                  draft.nodes
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
                  // Keep the most recently added one (usually the last in the array)
                  const sortedItems = [...items].sort((a, b) =>
                    a.id.localeCompare(b.id as string)
                  );
                  const keepItem = sortedItems[sortedItems.length - 1];

                  // Remove all but the one we want to keep
                  sortedItems.slice(0, -1).forEach((itemToRemove) => {
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

      // Return state unchanged - we'll make changes in the next steps
      return prev;
    });

    // Process each dynamic node one by one to avoid state conflicts
    let processedCount = 0;

    const processNextNode = (index: number) => {
      if (
        index >= this.getNodeState().nodes.filter((n) => n.isDynamic).length
      ) {
        return;
      }

      const dynamicNodes = this.getNodeState().nodes.filter((n) => n.isDynamic);
      const dynamicNode = dynamicNodes[index];

      // Find all direct children of this dynamic node
      const children = this.getNodeState().nodes.filter(
        (n) => n.parentId === dynamicNode.id
      );

      // Process each child with a delay
      let childIndex = 0;

      const processNextChild = () => {
        if (childIndex >= children.length) {
          // Move to next dynamic node
          processedCount += children.length;
          setTimeout(() => processNextNode(index + 1), 100);
          return;
        }

        const child = children[childIndex];

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

        // For each direct child, ensure it exists in all variants
        directChildren.forEach((child) => {
          allVariants.forEach((variant) => {
            // Check if child already exists in this variant
            const existingChild = draft.nodes.find(
              (n) => n.parentId === variant.id && n.sharedId === child.sharedId
            );

            if (!existingChild) {
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
  reorderNode(nodeId, targetParentId, targetIndex) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the index of the node to move.
        const idx = draft.nodes.findIndex((n) => n.id === nodeId);
        if (idx === -1) return;

        // Remove the node from its old position (preserving its reference and properties)
        const node = draft.nodes.splice(idx, 1)[0];

        // Update the node's parent reference.
        node.parentId = targetParentId;

        // If the node is dynamic, update its viewport info.
        if (node.isDynamic) {
          // Recompute dynamicViewportId based on the new parent's chain.
          const newViewportId = findParentViewport(targetParentId, draft.nodes);
          node.dynamicViewportId = newViewportId;
          // Force the node to be visible.
          node.inViewport = true;
        }

        // Find all siblings under the target parent, including their positions in the draft array.
        const siblingsWithIndex = draft.nodes
          .map((n, i) => ({ node: n, index: i }))
          .filter((obj) => obj.node.parentId === targetParentId);

        let insertIndex;
        if (siblingsWithIndex.length === 0) {
          // No siblings found, insert at the end.
          insertIndex = draft.nodes.length;
        } else if (targetIndex >= siblingsWithIndex.length) {
          // Insert after the last sibling. (Get the maximum index among siblings and add one.)
          insertIndex = Math.max(...siblingsWithIndex.map((s) => s.index)) + 1;
        } else {
          // Otherwise, insert at the position of the sibling at the target index.
          siblingsWithIndex.sort((a, b) => a.index - b.index);
          insertIndex = siblingsWithIndex[targetIndex].index;
        }

        // Insert the node at its new position.
        draft.nodes.splice(insertIndex, 0, node);
      })
    );
  }

  // reorderNode(
  //   nodeId: string | number,
  //   targetParentId: string | number,
  //   targetIndex: number
  // ) {
  //   this.setState((prev) =>
  //     produce(prev, (draft) => {
  //       // Find the node
  //       const idx = draft.nodes.findIndex((n) => n.id === nodeId);
  //       if (idx === -1) return;
  //       const node = draft.nodes[idx];

  //       // Store original text content and unsync flags for text nodes
  //       const originalText = node.style?.text;
  //       const hasTextUnsyncFlag = node.unsyncFromParentViewport?.text === true;
  //       const originalUnsyncFlags = { ...node.unsyncFromParentViewport };
  //       const originalIndependentStyles = { ...node.independentStyles };

  //       // Remove from old position
  //       draft.nodes.splice(idx, 1);

  //       // NEW: Clean up text property if this is not a text element
  //       if (node.type !== "text" && node.style && "text" in node.style) {
  //         delete node.style.text;
  //       }

  //       // Find siblings in target parent
  //       const siblings = draft.nodes
  //         .map((n, idx) => ({ node: n, index: idx }))
  //         .filter((obj) => obj.node.parentId === targetParentId);

  //       // Calculate insert position
  //       let insertIndex;
  //       if (siblings.length === 0) {
  //         insertIndex = draft.nodes.length;
  //       } else if (targetIndex >= siblings.length) {
  //         insertIndex = siblings[siblings.length - 1].index + 1;
  //       } else {
  //         insertIndex = siblings[targetIndex].index;
  //       }

  //       // Update node properties
  //       node.parentId = targetParentId;
  //       node.inViewport = true;
  //       node.style.position = "relative";

  //       if (!node.sharedId) {
  //         node.sharedId = nanoid();
  //       }

  //       // Insert at new position
  //       draft.nodes.splice(insertIndex, 0, node);

  //       // Restore original text content if this is a text node with text unsync flag
  //       if (node.type === "text" && hasTextUnsyncFlag && originalText) {
  //         node.style.text = originalText;
  //       }

  //       // Restore the original unsync flags
  //       if (originalUnsyncFlags) {
  //         node.unsyncFromParentViewport = originalUnsyncFlags;
  //       }

  //       // Restore original independent styles flags
  //       if (originalIndependentStyles) {
  //         node.independentStyles = originalIndependentStyles;
  //       }
  //     })
  //   );
  // }

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
    let needsSync = false;

    this.setState((prev) =>
      produce(prev, (draft) => {
        const idx = draft.nodes.findIndex((n) => n.id === nodeId);
        if (idx === -1) return;
        const node = draft.nodes[idx];

        if (node.type !== "text" && node.style && "text" in node.style) {
          delete node.style.text;
        }

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

          if (position === "inside" && targetIsDynamic) {
            needsSync = true;
          }

          if (position === "inside") {
            node.parentId = targetNode.id;
            draft.nodes.push(node);
            return;
          }

          node.parentId = targetNode.parentId;

          // Use provided index if available
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

          // Otherwise, use before/after positioning
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

    if (targetIsDynamic) {
      setTimeout(() => {
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
   * Checks if a node is part of the current dynamic family
   */
  isInDynamicFamily(nodeId, dynamicModeNodeId) {
    const nodes = this.getNodeState().nodes;

    // Get the dynamic family ID from the dynamic mode node
    const dynamicModeNode = nodes.find((n) => n.id === dynamicModeNodeId);
    if (!dynamicModeNode || !dynamicModeNode.dynamicFamilyId) return false;

    const familyId = dynamicModeNode.dynamicFamilyId;

    // Check if the node or any of its ancestors is in this family
    let currentNodeId = nodeId;

    while (currentNodeId) {
      const currentNode = nodes.find((n) => n.id === currentNodeId);
      if (!currentNode) break;

      // If the current node has the same family ID, it's part of the family
      if (currentNode.dynamicFamilyId === familyId) return true;

      // If the node is a dynamic node or variant, check its specific family ID
      if (
        (currentNode.isDynamic || currentNode.isVariant) &&
        currentNode.dynamicFamilyId === familyId
      ) {
        return true;
      }

      // Check parent
      if (!currentNode.parentId) break;
      currentNodeId = currentNode.parentId;
    }

    return false;
  }
  /**
   * Insert a node at a specific index in the array.
   * Automatically syncs variants if in dynamic mode.
   */
  insertAtIndex(
    node: Node,
    index: number,
    parentId: string | number | null | undefined,
    dynamicModeNodeId?: string | number | null
  ) {
    // First insert the node
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
          if (siblings) {
            const targetGlobalIndex = siblings[index].index;
            draft.nodes.splice(targetGlobalIndex, 0, newNode);
          }
        }
      })
    );

    // Store the newly created node's ID in a static collection
    // This helps us track multiple nodes being inserted in a batch operation
    if (!this._pendingVariantSyncs) {
      this._pendingVariantSyncs = new Set();
    }

    if (dynamicModeNodeId) {
      this._pendingVariantSyncs.add({
        nodeId: node.id,
        dynamicModeNodeId: dynamicModeNodeId,
      });
    }

    // Use a debounced function to process all inserted nodes at once
    // This ensures we handle multiple selections efficiently
    clearTimeout(this._syncVariantsTimeout);
    this._syncVariantsTimeout = setTimeout(() => {
      if (!this._pendingVariantSyncs || this._pendingVariantSyncs.size === 0)
        return;

      const currentState = this.getNodeState();
      const processed = new Set();

      // Process all pending nodes
      for (const item of this._pendingVariantSyncs) {
        const { nodeId, dynamicModeNodeId } = item;

        // Skip already processed nodes
        if (processed.has(nodeId)) continue;

        // Check if this node is within a dynamic family
        const shouldSync = this.shouldSyncNodeVariants(
          nodeId,
          dynamicModeNodeId,
          currentState.nodes
        );

        if (shouldSync) {
          this.syncVariants(nodeId);
          processed.add(nodeId);
        }
      }

      // Clear the pending syncs
      this._pendingVariantSyncs.clear();
    }, 10);
  }

  /**
   * Determines if a node should have its variants synced based on its ancestry
   */
  shouldSyncNodeVariants(nodeId, dynamicModeNodeId, nodes) {
    // If there's no dynamic mode active, no need to sync
    if (!dynamicModeNodeId) return false;

    // Get the dynamic family ID from the dynamic mode node
    const dynamicModeNode = nodes.find((n) => n.id === dynamicModeNodeId);
    if (!dynamicModeNode || !dynamicModeNode.dynamicFamilyId) return false;

    const familyId = dynamicModeNode.dynamicFamilyId;

    // Check the entire ancestry chain to handle deep nesting
    let currentNodeId = nodeId;
    const visited = new Set(); // Prevent infinite loops from circular references

    // Check if the node is a root dynamic node itself
    const node = nodes.find((n) => n.id === nodeId);

    // Edge case: if the node itself is a variant or dynamic node with the same family ID
    if (
      node &&
      (node.isDynamic || node.isVariant) &&
      node.dynamicFamilyId === familyId
    ) {
      return true;
    }

    // Traverse up the parent chain
    while (currentNodeId && !visited.has(currentNodeId)) {
      visited.add(currentNodeId);

      // Get the current node
      const currentNode = nodes.find((n) => n.id === currentNodeId);
      if (!currentNode) break;

      // Check if this node or any ancestor is in the dynamic family
      if (currentNode.dynamicFamilyId === familyId) return true;

      // Check specific properties for dynamic/variant nodes
      if (
        (currentNode.isDynamic || currentNode.isVariant) &&
        currentNode.dynamicFamilyId === familyId
      ) {
        return true;
      }

      // Move up to parent
      if (!currentNode.parentId) break;
      currentNodeId = currentNode.parentId;
    }

    return false;
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

        // Find the viewport this node belongs to by traversing up the parent chain
        function findParentViewport(nodes, nodeId) {
          const node = nodes.find((n) => n.id === nodeId);
          if (!node) return null;

          if (node.parentId) {
            const parent = nodes.find((n) => n.id === node.parentId);
            if (parent && parent.isViewport) {
              return parent.id;
            } else if (parent) {
              return findParentViewport(nodes, parent.id);
            }
          }
          return null;
        }

        // Set dynamicViewportId for the main node
        const viewportId = findParentViewport(draft.nodes, mainNode.id);
        if (viewportId) {
          mainNode.dynamicViewportId = viewportId;
        }

        // Add variantResponsiveId if not present
        if (!mainNode.variantResponsiveId) {
          mainNode.variantResponsiveId = nanoid();
        }

        // Find all nodes with the same sharedId across all viewports
        const relatedNodes = draft.nodes.filter(
          (n) => n.sharedId === mainNode.sharedId && n.id !== mainNode.id
        );

        // Update all related nodes with the same dynamicFamilyId and correct viewport
        relatedNodes.forEach((node) => {
          node.dynamicFamilyId = familyId;
          node.isDynamic = true; // Make all instances dynamic

          // Set correct viewport for this instance
          const nodeViewportId = findParentViewport(draft.nodes, node.id);
          if (nodeViewportId) {
            node.dynamicViewportId = nodeViewportId;
          }

          // Add variantResponsiveId if not present
          if (!node.variantResponsiveId) {
            // Use the same variantResponsiveId as the main node for consistency
            node.variantResponsiveId = mainNode.variantResponsiveId;
          }
        });

        // Define updateChildren function inside updateNodeDynamicStatus
        function updateChildren(parentId, parentNode, viewportId, familyId) {
          const children = draft.nodes.filter((n) => n.parentId === parentId);

          children.forEach((child) => {
            // Set basic dynamic properties
            child.dynamicParentId = parentId;
            child.dynamicFamilyId = familyId;
            child.dynamicViewportId = viewportId;

            // Generate a responsive ID if not present
            if (!child.variantResponsiveId) {
              child.variantResponsiveId = nanoid();
            }

            // Add empty variantIndependentSync object
            child.variantIndependentSync = {};

            // Calculate dynamic position - based on the child's position in the parent
            // This calculates relative position from absolute positions or style values
            let childX = 0;
            let childY = 0;

            // Try to get position from style (for flex layouts)
            if (child.style) {
              // Parse position values from style if they exist
              childX =
                child.style.left && !isNaN(parseFloat(child.style.left))
                  ? parseFloat(child.style.left)
                  : 0;

              childY =
                child.style.top && !isNaN(parseFloat(child.style.top))
                  ? parseFloat(child.style.top)
                  : 0;
            }

            // Set dynamic position
            child.dynamicPosition = {
              x: childX,
              y: childY,
            };

            // Add other necessary properties
            if (!child.sharedId) {
              child.sharedId = nanoid();
            }

            if (!child.unsyncFromParentViewport) {
              child.unsyncFromParentViewport = {};
            }

            if (!child.independentStyles) {
              child.independentStyles = {};
            }

            if (!child.lowerSyncProps) {
              child.lowerSyncProps = {};
            }

            // Process child's children recursively
            updateChildren(child.id, child, viewportId, familyId);
          });
        }

        // Update children recursively with all necessary properties
        if (viewportId) {
          updateChildren(nodeId, mainNode, viewportId, familyId);
        }

        // Also update children of related nodes if they exist
        relatedNodes.forEach((node) => {
          const nodeViewportId = node.dynamicViewportId;
          if (nodeViewportId) {
            updateChildren(node.id, node, nodeViewportId, familyId);
          }
        });
      })
    );
  }

  // Helper function to reliably get the viewport ID regardless of nesting level
  getEffectiveViewport(nodeId, nodes) {
    let currentNode = nodes.find((n) => n.id === nodeId);
    while (currentNode && !currentNode.isViewport) {
      if (!currentNode.parentId) return null;
      currentNode = nodes.find((n) => n.id === currentNode.parentId);
    }
    return currentNode ? currentNode.id : null;
  }

  // 1. Store dynamic node state with enhanced context
  // Updated: storeDynamicNodeState()
  // When entering dynamic mode, we record extra info such as the parent’s sharedId.
  storeDynamicNodeState(nodeId: string | number | null) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Find the selected node
        const node = draft.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Store original state with explicit sibling position
        if (!node.originalState) {
          // Find all siblings in the same parent
          const siblings = draft.nodes
            .filter((n) => n.parentId === node.parentId)
            .map((n) => n.id);

          // Find position among siblings
          const siblingPosition = siblings.indexOf(node.id);

          node.originalState = {
            parentId: node.parentId,
            inViewport: node.inViewport,
            siblingPosition: siblingPosition,
          };
        }

        // Set originalParentId for reference
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

          // Ensure base node and all responsive counterparts have matching variantResponsiveId
          if (!node.variantResponsiveId) {
            const baseNodeResponsiveId = nanoid();
            node.variantResponsiveId = baseNodeResponsiveId;

            responsiveCounterparts.forEach((counterpart) => {
              counterpart.variantResponsiveId = baseNodeResponsiveId;
            });
          }

          responsiveCounterparts.forEach((counterpart) => {
            // Store minimal original state with explicit sibling position
            if (!counterpart.originalState) {
              // Find all siblings in the same parent
              const siblings = draft.nodes
                .filter((n) => n.parentId === counterpart.parentId)
                .map((n) => n.id);

              // Find position among siblings
              const siblingPosition = siblings.indexOf(counterpart.id);

              counterpart.originalState = {
                parentId: counterpart.parentId,
                inViewport: counterpart.inViewport,
                siblingPosition: siblingPosition,
              };
            }

            // Set originalParentId for reference
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

            // Set up for dynamic mode
            counterpart.parentId = null;
            counterpart.inViewport = false;

            // Initialize dynamicPosition
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
                otherNode.customName = customName;
              }
            });
            return;
          }

          // CASE 2: Naming a child element inside a variant
          if (node.isVariant && node.parentId) {
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
                childNode.customName = customName;
              });
            });

            return;
          }

          // CASE 3: Naming a component in a dynamic base node (important new case!)
          if (node.sharedId && !node.isVariant) {
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
              }
            });

            return;
          }

          // CASE 4: For normal children of dynamic nodes
          if (!node.isVariant && node.dynamicParentId && node.sharedId) {
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

  // Updated: resetDynamicNodePositions()
  // When exiting dynamic mode, we restore each node’s parentId and force an "inViewport" flag for dynamic nodes.
  // For nested dynamic nodes, if the restored parent is missing, we use the original stored state.
  resetDynamicNodePositions() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        // Identify all dynamic nodes with stored original state.
        const dynamicNodes = draft.nodes.filter(
          (n) => n.originalState || n.originalParentId
        );

        // Create a map to track the original order info for dynamic nodes.
        // The map key is parentId; for each parent, we store an array of objects:
        // {id: <node id>, position: <original sibling position>}.
        const originalNodeOrder = {};

        // Loop through dynamic nodes and restore basic properties.
        dynamicNodes.forEach((node) => {
          const parentId =
            node.originalState?.parentId || node.originalParentId;
          const position = node.originalState?.siblingPosition;

          if (parentId) {
            if (position !== undefined) {
              if (!originalNodeOrder[parentId]) {
                originalNodeOrder[parentId] = [];
              }
              originalNodeOrder[parentId].push({ id: node.id, position });
            }

            // Restore parent's id and inViewport properly.
            node.parentId = parentId;
            node.inViewport = node.originalState?.inViewport ?? true;

            // Reset inline position styling.
            node.style.position = "relative";
            node.style.left = "";
            node.style.top = "";
            node.style.zIndex = "";
            node.style.transform = "";
          }

          // Clear temporary dynamic state.
          delete node.originalState;
          delete node.originalParentId;
          delete node.dynamicPosition;
        });

        // Reorder nodes based on the original sibling positions for each parent.
        Object.keys(originalNodeOrder).forEach((parentId) => {
          // Sort the nodes to be re-ordered in ascending order of their stored positions.
          const nodesToReorder = originalNodeOrder[parentId].sort(
            (a, b) => a.position - b.position
          );

          nodesToReorder.forEach((nodeInfo) => {
            const nodeId = nodeInfo.id;
            const targetPosition = nodeInfo.position;
            // Recompute the current children for this parent from the updated draft.
            const currentChildren = draft.nodes
              .filter((n) => n.parentId === parentId)
              .map((n) => n.id);

            const currentPosition = currentChildren.indexOf(nodeId);
            if (currentPosition === -1 || currentPosition === targetPosition) {
              return;
            }

            // Find the node’s index in the flattened draft.nodes list.
            const nodeIndex = draft.nodes.findIndex((n) => n.id === nodeId);
            if (nodeIndex === -1) return;

            // Remove the node temporarily.
            const nodeToMove = draft.nodes[nodeIndex];
            draft.nodes.splice(nodeIndex, 1);

            let insertIndex;
            // Recompute children of the parent after removal.
            const updatedChildren = draft.nodes
              .filter((n) => n.parentId === parentId)
              .map((n) => n.id);

            if (targetPosition === 0) {
              // Insert at the very beginning.
              const firstChildId = updatedChildren[0];
              if (firstChildId) {
                insertIndex = draft.nodes.findIndex(
                  (n) => n.id === firstChildId
                );
              } else {
                // No children: fall back to inserting just after the parent's node.
                const parentIndex = draft.nodes.findIndex(
                  (n) => n.id === parentId
                );
                insertIndex = parentIndex + 1;
              }
            } else if (targetPosition >= updatedChildren.length) {
              // Insert at the end of the parent's children.
              const lastChildId = updatedChildren[updatedChildren.length - 1];
              if (lastChildId) {
                const lastChildIndex = draft.nodes.findIndex(
                  (n) => n.id === lastChildId
                );
                insertIndex = lastChildIndex + 1;
              } else {
                const parentIndex = draft.nodes.findIndex(
                  (n) => n.id === parentId
                );
                insertIndex = parentIndex + 1;
              }
            } else {
              // Insert before the node currently at the target position.
              const nodeAtTargetId = updatedChildren[targetPosition];
              insertIndex = draft.nodes.findIndex(
                (n) => n.id === nodeAtTargetId
              );
            }

            // Insert the node at its new correct position.
            draft.nodes.splice(insertIndex, 0, nodeToMove);
          });
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

        // Create a shared variantResponsiveId for all variants of this type
        const variantResponsiveId = nanoid();

        // Track variantResponsiveIds for all children for proper synchronization
        const childVariantResponsiveIds = new Map();

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

        // Get all viewports and sort them by width (descending) to establish cascade order
        const viewports = draft.nodes
          .filter((n) => n.isViewport)
          .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0));

        // Get source viewport ID (the one containing our original node)
        const sourceViewportId =
          originalNode.dynamicViewportId ||
          (originalNode.parentId
            ? draft.nodes.find(
                (n) => n.id === originalNode.parentId && n.isViewport
              )?.id
            : null);

        // Define our source instances to duplicate from
        const dynamicInstances = duplicatingFromVariant
          ? [originalNode]
          : draft.nodes.filter(
              (n) => n.sharedId === originalNode.sharedId && n.isDynamic
            );

        // Track the primary variant positions for reference
        const mainVariantPositions = new Map();
        let firstVariantPosition = null;

        // ==========================================
        // STEP 1: Build a complete node hierarchy map for all source nodes
        // ==========================================

        // Store all nodes by their ID for quick lookup
        const nodesById = new Map();
        draft.nodes.forEach((node) => {
          nodesById.set(node.id, node);
        });

        // Map to store complete node hierarchies
        const nodeHierarchyMap = new Map();

        // Map to track style overrides from source children
        const sourceChildrenStyles = new Map();

        // Map to track ID mappings for parent-child relationships
        const idMappings = new Map();

        // Set to track which children were added directly to variants from canvas
        const canvasAddedChildren = new Set();

        // Function to recursively build a node tree
        const buildNodeTree = (nodeId, isSourceVariant = false) => {
          const node = nodesById.get(nodeId);
          if (!node) return null;

          // Ensure node has a sharedId
          if (!node.sharedId) {
            node.sharedId = nanoid();
          }

          // Get all direct children
          const children = draft.nodes
            .filter((n) => n.parentId === nodeId)
            .map((child) => {
              // Ensure child has a sharedId
              if (!child.sharedId) {
                child.sharedId = nanoid();
              }

              // If this is from the source variant, store complete style information
              if (isSourceVariant) {
                sourceChildrenStyles.set(child.sharedId, {
                  style: { ...child.style },
                  independentStyles: { ...(child.independentStyles || {}) },
                  variantIndependentSync: {
                    ...(child.variantIndependentSync || {}),
                  },
                  inViewport: child.inViewport,
                  dynamicParentId: child.dynamicParentId,
                  variantParentId: child.variantParentId,
                });

                // Check if this is a canvas-added child (only in variant, not in base node)
                if (
                  child.isVariant &&
                  (!child.variantResponsiveId ||
                    !draft.nodes.some(
                      (n) => !n.isVariant && n.sharedId === child.sharedId
                    ))
                ) {
                  canvasAddedChildren.add(child.sharedId);
                }
              }

              // Create a variant responsive ID for this child type if it doesn't exist
              if (!childVariantResponsiveIds.has(child.sharedId)) {
                childVariantResponsiveIds.set(child.sharedId, nanoid());
              }

              // Recursively build the child's tree
              return {
                node: child,
                children: buildNodeTree(child.id, isSourceVariant),
              };
            });

          return children.length > 0 ? children : null;
        };

        // Build complete node trees for all source instances
        dynamicInstances.forEach((instance) => {
          const isSourceVariant =
            duplicatingFromVariant && instance.id === originalNode.id;
          nodeHierarchyMap.set(
            instance.id,
            buildNodeTree(instance.id, isSourceVariant)
          );
        });

        // ==========================================
        // STEP 2: Create primary variants in each source viewport
        // ==========================================

        // Create variants for each source instance
        dynamicInstances.forEach((sourceInstance) => {
          const instanceDuplicateId = nanoid();

          // Store ID mapping for parent-child relationships
          idMappings.set(sourceInstance.id, instanceDuplicateId);

          // Use the first created duplicate as our return value
          if (!duplicateId) {
            duplicateId = instanceDuplicateId;
          }

          // Get viewport ID
          let viewportId = null;
          if (sourceInstance.parentId) {
            const parent = nodesById.get(sourceInstance.parentId);
            if (parent && parent.isViewport) {
              viewportId = parent.id;
            }
          } else if (sourceInstance.dynamicViewportId) {
            viewportId = sourceInstance.dynamicViewportId;
          }

          // Calculate position based on direction parameter
          let posX = sourceInstance.position?.x || 0;
          let posY = sourceInstance.position?.y || 0;

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
          const isPrimaryViewport =
            viewportId === viewports[0]?.id || viewportId === sourceViewportId;

          if (isPrimaryViewport) {
            firstVariantPosition = { x: posX, y: posY };
            mainVariantPositions.set(variantSlug, { x: posX, y: posY });
          }

          // Create the duplicate with proper properties
          const duplicate = {
            id: instanceDuplicateId,
            type: sourceInstance.type,
            style: {
              ...sourceInstance.style,
              position: "absolute",
              left: `${posX}px`,
              top: `${posY}px`,
            },
            isDynamic: false,
            inViewport: false,
            parentId: null,
            sharedId: sourceInstance.sharedId,
            isVariant: true,
            variantInfo: {
              name: variantName,
              id: variantSlug,
            },
            variantResponsiveId: variantResponsiveId,
            dynamicFamilyId: familyId,
            independentStyles: {
              // Always mark position properties as independent
              left: true,
              top: true,
              position: true,
            },
            position: {
              x: posX,
              y: posY,
            },
          };

          // If duplicating from a variant, copy over all independent styles
          if (duplicatingFromVariant && sourceInstance.independentStyles) {
            Object.keys(sourceInstance.independentStyles).forEach(
              (styleProp) => {
                duplicate.independentStyles[styleProp] =
                  sourceInstance.independentStyles[styleProp];
              }
            );
          }

          // Set proper parent relationships
          if (duplicatingFromVariant) {
            duplicate.dynamicParentId = sourceInstance.dynamicParentId;
            duplicate.variantParentId = sourceInstance.variantParentId;
          } else {
            duplicate.dynamicParentId = sourceInstance.id;
            duplicate.variantParentId = sourceInstance.id;
          }

          // Set viewport ID
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
          if (sourceInstance.dynamicState) {
            duplicate.dynamicState = JSON.parse(
              JSON.stringify(sourceInstance.dynamicState)
            );
          }

          // Add to nodes array
          draft.nodes.push(duplicate);
        });

        // ==========================================
        // STEP 3: Create a function to duplicate node hierarchies recursively
        // ==========================================

        // This function recursively duplicates an entire node hierarchy
        const duplicateNodeHierarchy = (children, parentId, viewportId) => {
          if (!children || children.length === 0) return;

          children.forEach(({ node: child, children: grandchildren }) => {
            const childDuplicateId = nanoid();

            // Store this ID mapping
            idMappings.set(child.id, childDuplicateId);

            // Get the variantResponsiveId for this child type
            const childResponsiveId = childVariantResponsiveIds.get(
              child.sharedId
            );

            // Create duplicate child
            const childDuplicate = {
              id: childDuplicateId,
              type: child.type,
              style: { ...child.style },
              inViewport: child.inViewport,
              sharedId: child.sharedId,
              isVariant: true,
              dynamicFamilyId: familyId,
              variantResponsiveId: childResponsiveId,
              variantInfo: {
                name: variantName,
                id: variantSlug,
              },
              independentStyles: {
                position: true,
                left: true,
                top: true,
                ...(child.independentStyles || {}),
              },
              variantIndependentSync: {
                ...(child.variantIndependentSync || {}),
              },
              parentId: parentId,
              dynamicViewportId: viewportId,
            };

            // Apply source styles if available
            const sourceChildStyle = sourceChildrenStyles.get(child.sharedId);
            if (sourceChildStyle) {
              // Apply stored inViewport flag
              childDuplicate.inViewport = sourceChildStyle.inViewport;

              // Apply stored styles for independent properties
              Object.keys(sourceChildStyle.independentStyles || {}).forEach(
                (styleProp) => {
                  if (sourceChildStyle.independentStyles[styleProp]) {
                    childDuplicate.style[styleProp] =
                      sourceChildStyle.style[styleProp];
                    childDuplicate.independentStyles[styleProp] = true;
                  }
                }
              );

              // Copy variantIndependentSync settings
              if (sourceChildStyle.variantIndependentSync) {
                childDuplicate.variantIndependentSync = {
                  ...sourceChildStyle.variantIndependentSync,
                };
              }
            }

            // Set parent relationships
            if (duplicatingFromVariant) {
              // When duplicating from a variant, use similar relationships
              if (sourceChildStyle && sourceChildStyle.dynamicParentId) {
                childDuplicate.dynamicParentId =
                  sourceChildStyle.dynamicParentId;
              } else {
                childDuplicate.dynamicParentId = child.dynamicParentId;
              }

              if (sourceChildStyle && sourceChildStyle.variantParentId) {
                childDuplicate.variantParentId =
                  sourceChildStyle.variantParentId;
              } else {
                childDuplicate.variantParentId = child.variantParentId;
              }
            } else {
              // For base node duplication
              const originalParentId = child.parentId;
              const originalParent = nodesById.get(originalParentId);

              if (originalParent && originalParent.isDynamic) {
                childDuplicate.dynamicParentId = originalParentId;
              } else {
                // Parent isn't a dynamic node, use the parent's parent
                childDuplicate.dynamicParentId =
                  originalParent?.dynamicParentId || null;
              }

              childDuplicate.variantParentId = parentId;
            }

            // Copy other properties
            if (child.customName) childDuplicate.customName = child.customName;
            if (child.src) childDuplicate.src = child.src;
            if (child.text) childDuplicate.text = child.text;
            if (child.dynamicState) {
              childDuplicate.dynamicState = JSON.parse(
                JSON.stringify(child.dynamicState)
              );
            }

            // Add to nodes array
            draft.nodes.push(childDuplicate);

            // Recursively duplicate grandchildren
            if (grandchildren && grandchildren.length > 0) {
              duplicateNodeHierarchy(
                grandchildren,
                childDuplicateId,
                viewportId
              );
            }
          });
        };

        // ==========================================
        // STEP 4: Duplicate all children hierarchies for primary variants
        // ==========================================

        // Process each dynamic instance and duplicate its entire hierarchy
        dynamicInstances.forEach((sourceInstance) => {
          const duplicateInstanceId = idMappings.get(sourceInstance.id);
          if (!duplicateInstanceId) return;

          // Get viewport ID
          let viewportId = null;
          if (sourceInstance.dynamicViewportId) {
            viewportId = sourceInstance.dynamicViewportId;
          } else if (sourceInstance.parentId) {
            const parent = nodesById.get(sourceInstance.parentId);
            if (parent && parent.isViewport) {
              viewportId = parent.id;
            }
          }

          // Get the children hierarchy for this instance
          const children = nodeHierarchyMap.get(sourceInstance.id);

          // Duplicate the entire hierarchy
          if (children && children.length > 0) {
            duplicateNodeHierarchy(children, duplicateInstanceId, viewportId);
          }
        });

        // ==========================================
        // STEP 5: Cross-viewport duplication
        // ==========================================

        if (duplicatingFromVariant) {
          // Get the true base node
          const baseNodeId =
            originalNode.dynamicParentId || originalNode.variantParentId;
          if (!baseNodeId) return;

          const baseNode = nodesById.get(baseNodeId);
          if (!baseNode || !baseNode.sharedId) return;

          // Find existing variants to get relative positions
          const existingVariants = draft.nodes.filter(
            (n) =>
              n.isVariant &&
              n.variantInfo?.id &&
              n.dynamicParentId === baseNode.id
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

          // For each base instance in other viewports, create variants
          otherBaseInstances.forEach((otherBaseInstance) => {
            // Get viewport ID
            let viewportId = null;
            if (otherBaseInstance.parentId) {
              const parent = nodesById.get(otherBaseInstance.parentId);
              if (parent && parent.isViewport) {
                viewportId = parent.id;
              }
            } else if (otherBaseInstance.dynamicViewportId) {
              viewportId = otherBaseInstance.dynamicViewportId;
            }

            if (!viewportId) return;

            // Check if this variant already exists
            const variantExists = draft.nodes.some(
              (n) =>
                n.variantInfo?.id === variantSlug &&
                n.dynamicViewportId === viewportId
            );

            if (variantExists) return;

            // Find existing variants in this viewport
            const viewportVariants = draft.nodes.filter(
              (n) =>
                n.isVariant &&
                n.dynamicViewportId === viewportId &&
                n.dynamicParentId === otherBaseInstance.id
            );

            // Calculate position
            let posX = otherBaseInstance.position?.x || 0;
            let posY = otherBaseInstance.position?.y || 0;
            const width = elementWidth || 300;
            const height = parseFloat(otherBaseInstance.style.height || "100");
            const gap = 60;

            if (viewportVariants.length > 0 && firstVariantPosition) {
              // Find the last existing variant
              const sortedVariants = [...viewportVariants].sort((a, b) => {
                const aX = a.position?.x || 0;
                const bX = b.position?.x || 0;
                return aX - bX;
              });

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
                // Calculate relative offset
                const mainRelativeX =
                  mainPosition.x - correspondingMainVariant.position.x;
                const mainRelativeY =
                  mainPosition.y - correspondingMainVariant.position.y;

                // Apply same offset in this viewport
                posX = lastVariant.position.x + mainRelativeX;
                posY = lastVariant.position.y + mainRelativeY;
              } else {
                // Place it after the last variant
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
              }
            } else {
              // No existing variants, position relative to the base instance
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
                  posX += width + gap;
              }
            }

            // Create the new variant
            const newVariantId = nanoid();

            // Store in mappings
            idMappings.set(otherBaseInstance.id, newVariantId);

            // Get the source viewport
            const sourceViewportId = originalNode.dynamicViewportId;
            const targetViewportId = viewportId;
            const findResponsiveCounterpart = (
              originalNode,
              targetViewportId
            ) => {
              // Find a variant with the same variantInfo.id in the target viewport
              if (originalNode.isVariant && originalNode.variantInfo?.id) {
                // Look for existing variants with same ID but in target viewport
                const sameVariantInTargetViewport = draft.nodes.find(
                  (n) =>
                    n.isVariant &&
                    n.variantInfo?.id === originalNode.variantInfo?.id &&
                    n.dynamicViewportId === targetViewportId
                );

                if (sameVariantInTargetViewport) {
                  return sameVariantInTargetViewport;
                }
              }

              // Look for a node with matching variantResponsiveId and in target viewport
              const matchingNode = draft.nodes.find(
                (n) =>
                  n.variantResponsiveId === originalNode.variantResponsiveId &&
                  n.dynamicViewportId === targetViewportId &&
                  n.id !== originalNode.id
              );

              return matchingNode;
            };

            // First look for a direct counterpart of this specific variant in the target viewport
            const existingCounterpart = findResponsiveCounterpart(
              originalNode,
              targetViewportId
            );

            if (existingCounterpart) {
              console.log(
                `Found direct counterpart for ${originalNode.id} in viewport ${targetViewportId}: ${existingCounterpart.id}`
              );
            }

            // If no direct counterpart, look for any variant with the same variant ID
            // This is important - we need to find the equivalent variant in the target viewport
            const variantSourceInTargetViewport =
              existingCounterpart ||
              draft.nodes.find(
                (n) =>
                  n.isVariant &&
                  n.dynamicViewportId === targetViewportId &&
                  n.sharedId === originalNode.sharedId
              );

            // Create the new variant using styles from the target viewport's existing variant
            const newVariant = {
              id: newVariantId,
              type: otherBaseInstance.type,
              style: {
                // Use styles from the target viewport's counterpart variant if available
                ...(variantSourceInTargetViewport
                  ? variantSourceInTargetViewport.style
                  : otherBaseInstance.style),
                // Override position for placement
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
              variantResponsiveId: variantResponsiveId,
              dynamicFamilyId: familyId,
              independentStyles: {
                // Always preserve position properties
                left: true,
                top: true,
                position: true,
                // Copy target viewport-specific independent styles
                ...(variantSourceInTargetViewport &&
                variantSourceInTargetViewport.independentStyles
                  ? variantSourceInTargetViewport.independentStyles
                  : {}),
              },
              dynamicViewportId: viewportId,
              position: {
                x: posX,
                y: posY,
              },
            };

            // Copy viewport-specific properties from the target viewport variant
            if (variantSourceInTargetViewport) {
              // Copy variantIndependentSync
              if (variantSourceInTargetViewport.variantIndependentSync) {
                newVariant.variantIndependentSync = {
                  ...variantSourceInTargetViewport.variantIndependentSync,
                };
              }

              // Copy unsyncFromParentViewport settings
              if (variantSourceInTargetViewport.unsyncFromParentViewport) {
                newVariant.unsyncFromParentViewport = {
                  ...variantSourceInTargetViewport.unsyncFromParentViewport,
                };
              }

              // Copy lowerSyncProps
              if (variantSourceInTargetViewport.lowerSyncProps) {
                newVariant.lowerSyncProps = {
                  ...variantSourceInTargetViewport.lowerSyncProps,
                };
              }

              // IMPORTANT: Copy sizing properties specifically
              if (
                variantSourceInTargetViewport &&
                variantSourceInTargetViewport.style
              ) {
                // First copy any existing independent styles
                if (variantSourceInTargetViewport.independentStyles) {
                  // For each independent style property in the source variant
                  Object.keys(
                    variantSourceInTargetViewport.independentStyles
                  ).forEach((styleProp) => {
                    // If it's marked as independent and not a position property (which we already handle)
                    if (
                      variantSourceInTargetViewport.independentStyles[
                        styleProp
                      ] &&
                      !["position", "left", "top"].includes(styleProp)
                    ) {
                      // Copy the style value
                      newVariant.style[styleProp] =
                        variantSourceInTargetViewport.style[styleProp];
                      // Mark it as independent in the new variant
                      newVariant.independentStyles[styleProp] = true;
                    }
                  });
                }

                // Additionally, ensure we capture common important style properties
                // even if they're not explicitly marked as independent
                const commonImportantProps = [
                  "width",
                  "height",
                  "backgroundColor",
                  "borderRadius",
                  "border",
                  "color",
                  "padding",
                  "margin",
                  "fontSize",
                  "fontWeight",
                  "lineHeight",
                  "display",
                  "flexDirection",
                  "alignItems",
                  "justifyContent",
                  "gap",
                  "flexWrap",
                  "flex",
                  "opacity",
                  "overflow",
                ];

                commonImportantProps.forEach((prop) => {
                  if (
                    variantSourceInTargetViewport.style[prop] !== undefined &&
                    !newVariant.independentStyles[prop] && // Don't override already set properties
                    !["position", "left", "top"].includes(prop) // Don't override position properties
                  ) {
                    newVariant.style[prop] =
                      variantSourceInTargetViewport.style[prop];
                  }
                });
              }

              console.log(
                `Applied styling from viewport-specific variant: ${variantSourceInTargetViewport.id}`
              );
            }
            // Copy other properties
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

            // ==========================================
            // STEP 6: Build similar hierarchies for cross-viewport variants
            // ==========================================

            // Get original hierarchy from source viewport
            const sourceVariantId = originalNode.id;
            const sourceHierarchy = nodeHierarchyMap.get(
              duplicatingFromVariant ? sourceVariantId : baseNodeId
            );

            // If we have a hierarchy, duplicate it for this viewport
            if (sourceHierarchy && sourceHierarchy.length > 0) {
              duplicateNodeHierarchy(sourceHierarchy, newVariantId, viewportId);
            }

            // Additionally duplicate any canvas-added children
            const sourceCanvasChildren = draft.nodes.filter(
              (n) =>
                n.parentId === sourceVariantId &&
                canvasAddedChildren.has(n.sharedId)
            );

            if (sourceCanvasChildren.length > 0) {
              // Recursively duplicate canvas-added children
              const duplicateCanvasChild = (child, newParentId) => {
                const childDuplicateId = nanoid();

                // Get variantResponsiveId
                const childResponsiveId = childVariantResponsiveIds.get(
                  child.sharedId
                );

                // Create the duplicate
                const childDuplicate = {
                  ...child,
                  id: childDuplicateId,
                  parentId: newParentId,
                  dynamicViewportId: viewportId,
                  variantInfo: {
                    name: variantName,
                    id: variantSlug,
                  },
                  variantResponsiveId: childResponsiveId || nanoid(),
                };

                // Apply source styles if available
                const sourceChildStyle = sourceChildrenStyles.get(
                  child.sharedId
                );
                if (sourceChildStyle) {
                  // Apply stored inViewport flag
                  childDuplicate.inViewport = sourceChildStyle.inViewport;

                  // Apply stored styles for independent properties
                  Object.keys(sourceChildStyle.independentStyles || {}).forEach(
                    (styleProp) => {
                      if (sourceChildStyle.independentStyles[styleProp]) {
                        childDuplicate.style[styleProp] =
                          sourceChildStyle.style[styleProp];
                        childDuplicate.independentStyles =
                          childDuplicate.independentStyles || {};
                        childDuplicate.independentStyles[styleProp] = true;
                      }
                    }
                  );
                }

                // Add to nodes
                draft.nodes.push(childDuplicate);

                // Get and duplicate children of this canvas child
                const canvasChildChildren = draft.nodes.filter(
                  (n) => n.parentId === child.id
                );

                if (canvasChildChildren.length > 0) {
                  canvasChildChildren.forEach((grandchild) => {
                    duplicateCanvasChild(grandchild, childDuplicateId);
                  });
                }

                return childDuplicateId;
              };

              // Start duplication for all canvas-added children
              sourceCanvasChildren.forEach((canvasChild) => {
                duplicateCanvasChild(canvasChild, newVariantId);
              });
            }
          });
        }
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

  syncDroppedNodeWithChildren(sourceNodeId, additionalNodeIds = []) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        console.log(
          `Syncing dropped node ${sourceNodeId} with all its children and ${additionalNodeIds.length} additional nodes`
        );

        // First, build a dependency map to understand parent-child relationships
        const dependencyMap = new Map(); // nodeId -> childIds[]
        const allNodeIds = [sourceNodeId, ...additionalNodeIds];

        // Build a hierarchy map of the nodes we're processing
        for (const nodeId of allNodeIds) {
          // Find any children of this node
          const children = draft.nodes.filter((n) => n.parentId === nodeId);
          if (children.length > 0) {
            dependencyMap.set(
              nodeId,
              children.map((c) => c.id)
            );
          }
        }

        console.log("Dependency map:", dependencyMap);

        // Process the main node first
        const processNode = (nodeId, isRoot = false) => {
          const sourceNode = draft.nodes.find((n) => n.id === nodeId);
          if (!sourceNode) {
            console.log(`Source node ${nodeId} not found`);
            return;
          }

          // Check if this is a direct child of a viewport
          const isDirectViewportChild =
            sourceNode.parentId &&
            draft.nodes.some(
              (n) => n.id === sourceNode.parentId && n.isViewport
            );

          // Ensure the node has a sharedId for syncing
          if (!sourceNode.sharedId && isRoot) {
            console.log(`Node ${nodeId} has no sharedId, cannot sync properly`);
            return;
          }

          // If it's a direct viewport child, handle specially
          if (isDirectViewportChild) {
            console.log(`Node ${nodeId} is a direct child of a viewport`);

            // Find source viewport
            const sourceViewport = draft.nodes.find(
              (n) => n.id === sourceNode.parentId
            );
            if (!sourceViewport || !sourceViewport.isViewport) {
              console.log(`Source viewport for ${nodeId} not found`);
              return;
            }

            // Find all other viewports
            const otherViewports = draft.nodes.filter(
              (n) => n.isViewport && n.id !== sourceViewport.id
            );

            console.log(
              `Found ${otherViewports.length} other viewports for ${nodeId}`
            );

            // For each other viewport, create a copy
            otherViewports.forEach((targetViewport) => {
              // Check if node already exists in this viewport (by sharedId)
              const existingNode = draft.nodes.find(
                (n) =>
                  n.sharedId === sourceNode.sharedId &&
                  n.parentId === targetViewport.id
              );

              if (existingNode) {
                console.log(
                  `Node already exists in viewport ${targetViewport.id} - skipping`
                );
                return;
              }

              console.log(
                `Creating copy of ${nodeId} in viewport ${targetViewport.id}`
              );

              // Clone the source node under the target viewport
              const newNode = {
                ...sourceNode,
                id: nanoid(),
                parentId: targetViewport.id,
                style: { ...sourceNode.style },
                unsyncFromParentViewport: {
                  ...sourceNode.unsyncFromParentViewport,
                },
                independentStyles: { ...sourceNode.independentStyles },
                lowerSyncProps: { ...sourceNode.lowerSyncProps },
              };

              // Add to the nodes collection
              draft.nodes.push(newNode);
              console.log(
                `Created node ${newNode.id} in viewport ${targetViewport.id}`
              );

              // Clone all children of the source node
              const childIds = dependencyMap.get(nodeId) || [];
              if (childIds.length > 0) {
                // Process direct children, keeping them attached to this new parent
                cloneChildrenKeepingParent(nodeId, newNode.id, childIds);
              }
            });
          }
          // If it's a child of another node we're syncing, skip (it will be handled through its parent)
          else if (isPartOfDependencyTree(nodeId) && !isRoot) {
            console.log(
              `Node ${nodeId} is part of dependency tree, will be processed through its parent`
            );
            return;
          }
          // Normal case - node is child of another component with sharedId
          else if (sourceNode.sharedId || (isRoot && sourceNode.parentId)) {
            console.log(`Processing ${nodeId} as child of another component`);

            // Get the source parent to find corresponding targets in other viewports
            const sourceParent = draft.nodes.find(
              (n) => n.id === sourceNode.parentId
            );
            if (!sourceParent || !sourceParent.sharedId) {
              console.log(
                `Source parent for ${nodeId} not found or has no sharedId`
              );
              return;
            }

            console.log(
              `Source node parent is ${sourceParent.id} with sharedId ${sourceParent.sharedId}`
            );

            // Get all target parents across viewports (components with same sharedId as parent)
            const targetParents = draft.nodes.filter(
              (n) =>
                n.sharedId === sourceParent.sharedId && n.id !== sourceParent.id
            );

            console.log(
              `Found ${targetParents.length} target parents for ${nodeId}`
            );

            // For each target parent in other viewports, create a copy of source node and all its children
            targetParents.forEach((targetParent) => {
              console.log(
                `Creating copy of ${nodeId} under parent ${targetParent.id}`
              );

              // Clone the source node under the target parent
              const newNode = {
                ...sourceNode,
                id: nanoid(),
                parentId: targetParent.id,
                style: { ...sourceNode.style },
                unsyncFromParentViewport: {
                  ...sourceNode.unsyncFromParentViewport,
                },
                independentStyles: { ...sourceNode.independentStyles },
                lowerSyncProps: { ...sourceNode.lowerSyncProps },
              };

              // Add to the nodes collection
              draft.nodes.push(newNode);
              console.log(
                `Created node ${newNode.id} with parent ${targetParent.id}`
              );

              // Clone all children of the source node
              const childIds = dependencyMap.get(nodeId) || [];
              if (childIds.length > 0) {
                // Process direct children, keeping them attached to this new parent
                cloneChildrenKeepingParent(nodeId, newNode.id, childIds);
              }
            });
          }
        };

        // Check if a node is part of the dependency tree (is a child of another node we're syncing)
        function isPartOfDependencyTree(nodeId) {
          for (const [parentId, childIds] of dependencyMap.entries()) {
            if (childIds.includes(nodeId)) {
              return true;
            }
          }
          return false;
        }

        // Clone children keeping their relationship to their parent
        function cloneChildrenKeepingParent(
          sourceParentId,
          newParentId,
          childIds
        ) {
          // For each child, create a copy with the new parent
          childIds.forEach((childId) => {
            const sourceChild = draft.nodes.find((n) => n.id === childId);
            if (!sourceChild) {
              console.log(`Child ${childId} not found`);
              return;
            }

            const newChild = {
              ...sourceChild,
              id: nanoid(),
              parentId: newParentId, // Link to the new parent
              style: { ...sourceChild.style },
              unsyncFromParentViewport: {
                ...sourceChild.unsyncFromParentViewport,
              },
              independentStyles: { ...sourceChild.independentStyles },
              lowerSyncProps: { ...sourceChild.lowerSyncProps },
            };

            draft.nodes.push(newChild);
            console.log(
              `Created child ${newChild.id} with parent ${newParentId}`
            );

            // Recursively clone this child's children if any
            const grandchildren = dependencyMap.get(childId) || [];
            if (grandchildren.length > 0) {
              cloneChildrenKeepingParent(childId, newChild.id, grandchildren);
            }
          });
        }

        // Process the main node first
        processNode(sourceNodeId, true);

        // Then process additional nodes, but only if they're not children of the main node
        additionalNodeIds.forEach((nodeId) => {
          if (!isPartOfDependencyTree(nodeId)) {
            processNode(nodeId, true);
          }
        });

        console.log("Finished syncing all nodes with their children");
      })
    );
  }

  syncViewports() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const viewports = draft.nodes.filter((n) => n.isViewport);
        viewports.sort((a, b) => b.viewportWidth - a.viewportWidth);
        const viewportOrder = viewports.map((v) => v.id);

        // CRITICAL FIX: Helper function to check if a node is dynamic or related to dynamic nodes
        const isDynamicRelated = (node) => {
          if (!node) return false;
          return (
            node.isDynamic ||
            node.isVariant ||
            node.dynamicParentId ||
            node.dynamicFamilyId
          );
        };

        // Helper to check if a node is a descendant of a dynamic node
        const isDynamicDescendant = (nodeId) => {
          let currentNode = draft.nodes.find((n) => n.id === nodeId);
          if (!currentNode) return false;

          // Check if the current node itself is dynamic
          if (isDynamicRelated(currentNode)) return true;

          // Check parents recursively
          while (currentNode && currentNode.parentId) {
            const parentNode = draft.nodes.find(
              (n) => n.id === currentNode.parentId
            );
            if (!parentNode) break;

            if (isDynamicRelated(parentNode)) return true;
            currentNode = parentNode;
          }

          return false;
        };

        // Add utility for direct positioning
        const directlyMoveNodeToIndex = (nodeId, siblings, targetIndex) => {
          // Find the node we want to move
          const node = draft.nodes.find((n) => n.id === nodeId);
          if (!node) return;

          // CRITICAL FIX: Skip if this is a dynamic node or child of dynamic node
          if (isDynamicRelated(node) || isDynamicDescendant(node.id)) return;

          // Ensure target index is valid
          const safeIndex = Math.max(0, Math.min(targetIndex, siblings.length));

          // Get the real indices of all nodes in the actual draft.nodes array
          const nodeIndex = draft.nodes.findIndex((n) => n.id === nodeId);
          const siblingsIndices = siblings.map((s) =>
            draft.nodes.findIndex((n) => n.id === s.id)
          );

          // If the target position is already correct, do nothing
          const currentPosition = siblings.findIndex((s) => s.id === nodeId);
          if (currentPosition === safeIndex) return;

          // Move the node in the draft.nodes array directly
          if (nodeIndex !== -1) {
            // First remove the node
            const [removedNode] = draft.nodes.splice(nodeIndex, 1);

            // Recalculate siblings indices after removal
            const updatedSiblingIndices = siblings
              .map((s) => {
                if (s.id === nodeId) return -1; // Skip the node we're moving
                const idx = draft.nodes.findIndex((n) => n.id === s.id);
                return idx;
              })
              .filter((idx) => idx !== -1);

            // Find insert position
            let insertIndex;
            if (safeIndex === 0) {
              // Insert at beginning
              insertIndex =
                updatedSiblingIndices.length > 0
                  ? updatedSiblingIndices[0] // Before first sibling
                  : draft.nodes.length; // Or at the end if no siblings
            } else if (
              safeIndex >= siblings.length ||
              safeIndex >= updatedSiblingIndices.length
            ) {
              // Insert at end
              insertIndex = draft.nodes.length;
            } else {
              // Insert at specific position
              insertIndex = updatedSiblingIndices[safeIndex];
            }

            // Insert at the right position
            draft.nodes.splice(insertIndex, 0, removedNode);
          }
        };

        // CRITICAL FIX: Track the source viewport where a node was moved
        // and its position, to sync to other viewports
        let recentlyMovedSharedId = null;
        let sourceViewportId = null;
        let targetIndex = -1;

        const lastAddedInfo = draft._lastAddedNodeInfo;
        if (lastAddedInfo) {
          const newNode = draft.nodes.find(
            (n) => n.id === lastAddedInfo.nodeId
          );

          if (newNode && newNode.sharedId) {
            // CRITICAL FIX: Skip if this is a dynamic node or related to dynamic nodes
            if (
              !isDynamicRelated(newNode) &&
              !isDynamicDescendant(newNode.id)
            ) {
              // This is the source node that was moved - save its info
              recentlyMovedSharedId = newNode.sharedId;
              targetIndex = lastAddedInfo.exactIndex || 0;
              sourceViewportId = findParentViewport(
                newNode.parentId,
                draft.nodes
              );
            }
          }
        }

        // If a node was recently moved in one viewport,
        // directly force the same order in all other viewports
        if (recentlyMovedSharedId && sourceViewportId && targetIndex !== -1) {
          // Apply the same position to all other viewports immediately
          for (const viewport of viewports) {
            // Skip the source viewport - it already has the right position
            if (viewport.id === sourceViewportId) continue;

            // Find the node with the same sharedId in this viewport
            const nodeWithSameSharedId = draft.nodes.find(
              (n) =>
                n.sharedId === recentlyMovedSharedId &&
                findParentViewport(n.parentId, draft.nodes) === viewport.id &&
                // CRITICAL FIX: Skip dynamic nodes
                !isDynamicRelated(n) &&
                !isDynamicDescendant(n.id)
            );

            if (nodeWithSameSharedId) {
              // Get all direct children of this viewport to determine the target position
              const viewportChildren = draft.nodes.filter(
                (n) => n.parentId === viewport.id
              );

              // Directly manipulate the array to position this node at the same index
              directlyMoveNodeToIndex(
                nodeWithSameSharedId.id,
                viewportChildren,
                targetIndex
              );
            }
          }
        }

        // Clear the temporary info
        delete draft._lastAddedNodeInfo;

        // Continue with the normal sync process for other aspects
        // Phase 1: Find nodes that exist in some viewports but not all
        const nodesBySharedId = new Map(); // Map<sharedId, Array<node>>
        const viewportsBySharedId = new Map(); // Map<sharedId, Set<viewportId>>

        // Collect all nodes by sharedId and viewport
        for (const node of draft.nodes) {
          if (!node.sharedId) continue;

          // CRITICAL FIX: Skip dynamic nodes and their descendants completely
          if (isDynamicRelated(node) || isDynamicDescendant(node.id)) continue;

          const nodeViewportId = node.isViewport
            ? node.id
            : findParentViewport(node.parentId, draft.nodes);

          if (!nodeViewportId) continue;

          if (!nodesBySharedId.has(node.sharedId)) {
            nodesBySharedId.set(node.sharedId, []);
            viewportsBySharedId.set(node.sharedId, new Set());
          }

          nodesBySharedId.get(node.sharedId).push(node);
          viewportsBySharedId.get(node.sharedId).add(nodeViewportId);
        }

        // Helper function to find position index of a node among its siblings
        function findPositionIndex(nodeId, parentId, nodes) {
          const siblings = nodes.filter((n) => n.parentId === parentId);
          for (let i = 0; i < siblings.length; i++) {
            if (siblings[i].id === nodeId) return i;
          }
          return 0;
        }

        // For each shared ID that doesn't exist in all viewports, create copies
        nodesBySharedId.forEach((nodes, sharedId) => {
          // Skip if this shared ID exists in all viewports
          const existingViewports = viewportsBySharedId.get(sharedId);
          const missingViewports = viewports.filter(
            (v) => !existingViewports.has(v.id)
          );

          if (missingViewports.length === 0) return;

          // Find the source node (prefer higher viewport nodes)
          let sourceNode = null;

          // Try to find a source node from the highest viewport first
          for (const vpId of viewportOrder) {
            if (!existingViewports.has(vpId)) continue;

            const candidateNode = nodes.find((n) => {
              const nvpId = findParentViewport(n.parentId, draft.nodes);
              return nvpId === vpId;
            });

            if (candidateNode) {
              sourceNode = candidateNode;
              break;
            }
          }

          if (!sourceNode) {
            // Fallback to using the first node
            sourceNode = nodes[0];
          }

          if (!sourceNode) return;

          // CRITICAL FIX: Skip if source node is dynamic or related to dynamic nodes
          if (
            isDynamicRelated(sourceNode) ||
            isDynamicDescendant(sourceNode.id)
          )
            return;

          // Get source parent info
          const sourceParentId = sourceNode.parentId;
          const sourceParent = draft.nodes.find((n) => n.id === sourceParentId);
          if (!sourceParent) return;

          // Find the position index within parent
          const sourceIndex = findPositionIndex(
            sourceNode.id,
            sourceParentId,
            draft.nodes
          );

          // For each missing viewport, create a copy at the same position
          for (const targetViewport of missingViewports) {
            let targetParentId;

            // If parent is a viewport, use the target viewport
            if (sourceParent.isViewport) {
              targetParentId = targetViewport.id;
            }
            // If parent is a node with sharedId, find corresponding node in target viewport
            else if (sourceParent.sharedId) {
              const targetParent = draft.nodes.find(
                (n) =>
                  n.sharedId === sourceParent.sharedId &&
                  findParentViewport(n.parentId, draft.nodes) ===
                    targetViewport.id
              );

              if (targetParent) {
                targetParentId = targetParent.id;
              } else {
                // Fallback to viewport if we can't find the parent
                targetParentId = targetViewport.id;
              }
            } else {
              // Default to viewport
              targetParentId = targetViewport.id;
            }

            // Create the new node
            const newNode = {
              ...sourceNode,
              id: nanoid(),
              parentId: targetParentId,
              style: { ...sourceNode.style },
              unsyncFromParentViewport: {
                ...sourceNode.unsyncFromParentViewport,
              },
              independentStyles: { ...sourceNode.independentStyles },
              lowerSyncProps: { ...sourceNode.lowerSyncProps },
            };

            // Add to node collection
            draft.nodes.push(newNode);

            const processedChildrenKeys = new Set();

            // Replace with this modified version that uses our tracking set:
            const sourceChildren = draft.nodes.filter(
              (n) => n.parentId === sourceNode.id
            );

            if (sourceChildren.length > 0) {
              sourceChildren.forEach((sourceChild) => {
                // CRITICAL FIX: Skip children that are dynamic nodes or related to dynamic nodes
                if (
                  isDynamicRelated(sourceChild) ||
                  isDynamicDescendant(sourceChild.id)
                )
                  return;

                // Add this check to prevent duplication
                const childTrackingKey = `${sourceChild.id || ""}-${
                  targetViewport.id
                }`;
                if (processedChildrenKeys.has(childTrackingKey)) {
                  return;
                }

                // Mark as processed
                processedChildrenKeys.add(childTrackingKey);

                const newChild = {
                  ...sourceChild,
                  id: nanoid(),
                  parentId: newNode.id,
                  style: { ...sourceChild.style },
                  unsyncFromParentViewport: {
                    ...sourceChild.unsyncFromParentViewport,
                  },
                  independentStyles: { ...sourceChild.independentStyles },
                  lowerSyncProps: { ...sourceChild.lowerSyncProps },
                };

                draft.nodes.push(newChild);

                // Modified recursive function to exclude dynamic nodes and their descendants
                const processChildrenRecursively = (sourceId, newParentId) => {
                  const children = draft.nodes.filter(
                    (n) => n.parentId === sourceId
                  );
                  if (children.length === 0) return;

                  children.forEach((child) => {
                    // CRITICAL FIX: Skip children that are dynamic nodes or related to dynamic nodes
                    if (
                      isDynamicRelated(child) ||
                      isDynamicDescendant(child.id)
                    )
                      return;

                    // Check if this nested child has been processed
                    const nestedChildKey = `${child.id || ""}-${
                      targetViewport.id
                    }`;
                    if (processedChildrenKeys.has(nestedChildKey)) {
                      return;
                    }

                    // Mark as processed
                    processedChildrenKeys.add(nestedChildKey);

                    const newChildNode = {
                      ...child,
                      id: nanoid(),
                      parentId: newParentId,
                      style: { ...child.style },
                      unsyncFromParentViewport: {
                        ...child.unsyncFromParentViewport,
                      },
                      independentStyles: { ...child.independentStyles },
                      lowerSyncProps: { ...child.lowerSyncProps },
                    };

                    draft.nodes.push(newChildNode);
                    processChildrenRecursively(child.id, newChildNode.id);
                  });
                };

                // Process any deeper children
                processChildrenRecursively(sourceChild.id, newChild.id);
              });
            }
            // Get siblings to determine position
            const targetSiblings = draft.nodes.filter(
              (n) => n.parentId === targetParentId && n.id !== newNode.id
            );

            // Position directly in the array
            directlyMoveNodeToIndex(newNode.id, targetSiblings, sourceIndex);
          }
        });

        // Phase 2: Desktop-based style sync
        const desktopViewport = viewports.length > 0 ? viewports[0] : null;
        if (!desktopViewport) return;

        const desktopSubtree = getSubtree(draft.nodes, desktopViewport.id);

        viewports.forEach((viewport) => {
          if (viewport.id === desktopViewport.id) return;

          const oldSubtree = getSubtree(draft.nodes, viewport.id);
          const oldNodesBySharedId = new Map();

          // Track dynamic nodes to preserve them
          const dynamicNodesToPreserve = new Set();

          // CRITICAL FIX: Store position of nodes by sharedId and parent
          const positionsByParent = new Map(); // Map<parentId, Map<sharedId, index>>

          // Get positions of all nodes before making changes
          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport || !oldNode.sharedId) continue;

            // CRITICAL FIX: Skip if this is a dynamic node or related to dynamic nodes
            if (isDynamicRelated(oldNode) || isDynamicDescendant(oldNode.id))
              continue;

            const parentId = oldNode.parentId;
            if (!parentId) continue;

            // Get siblings with this parent
            const siblings = draft.nodes.filter((n) => n.parentId === parentId);

            // Find position of this node among siblings
            const index = siblings.findIndex((n) => n.id === oldNode.id);

            if (index !== -1) {
              if (!positionsByParent.has(parentId)) {
                positionsByParent.set(parentId, new Map());
              }

              // Preserve position by sharedId
              positionsByParent.get(parentId).set(oldNode.sharedId, index);
            }
          }

          // Identify dynamic nodes and nodes with sharedId
          for (const oldNode of oldSubtree) {
            if (oldNode.isViewport) continue;

            // Preserve isDynamic nodes and their children
            if (isDynamicRelated(oldNode) || isDynamicDescendant(oldNode.id)) {
              dynamicNodesToPreserve.add(oldNode.id);
            }

            if (
              oldNode.sharedId &&
              !isDynamicRelated(oldNode) &&
              !isDynamicDescendant(oldNode.id)
            ) {
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

          const idMap = new Map();

          // First pass: clone all nodes
          for (const desktopNode of desktopSubtree) {
            // CRITICAL FIX: Skip dynamic nodes and their descendants completely
            if (
              isDynamicRelated(desktopNode) ||
              isDynamicDescendant(desktopNode.id)
            )
              continue;

            const oldNode = oldNodesBySharedId.get(desktopNode.sharedId || "");
            const cloned = {
              ...desktopNode,
              id: oldNode?.id || nanoid(),
              style: { ...desktopNode.style },
            };

            // Respect independent styles and unsyncFromParentViewport
            if (oldNode) {
              // First initialize flag objects if they don't exist
              cloned.independentStyles = cloned.independentStyles || {};
              cloned.unsyncFromParentViewport =
                cloned.unsyncFromParentViewport || {};
              cloned.lowerSyncProps = cloned.lowerSyncProps || {};

              // Copy over all the existing flags
              if (oldNode.independentStyles) {
                cloned.independentStyles = { ...oldNode.independentStyles };
              }

              if (oldNode.unsyncFromParentViewport) {
                cloned.unsyncFromParentViewport = {
                  ...oldNode.unsyncFromParentViewport,
                };
              }

              if (oldNode.lowerSyncProps) {
                cloned.lowerSyncProps = { ...oldNode.lowerSyncProps };
              }

              // Apply all independent/unsync styles from the old node
              Object.keys(oldNode.style).forEach((prop) => {
                // If this property is marked as independent or unsync, keep the old value
                if (
                  (oldNode.independentStyles &&
                    oldNode.independentStyles[prop]) ||
                  (oldNode.unsyncFromParentViewport &&
                    oldNode.unsyncFromParentViewport[prop])
                ) {
                  cloned.style[prop] = oldNode.style[prop];
                }
              });
            }

            idMap.set(desktopNode.id, cloned.id);
            draft.nodes.push(cloned);
          }

          // Second pass: update parent references and position nodes
          for (const dNode of desktopSubtree) {
            // CRITICAL FIX: Skip dynamic nodes and their descendants completely
            if (isDynamicRelated(dNode) || isDynamicDescendant(dNode.id))
              continue;

            const newId = idMap.get(dNode.id);
            if (!newId) continue;

            const clonedNode = draft.nodes.find((n) => n.id === newId);
            if (!clonedNode) continue;

            // Determine parent ID
            let newParentId;
            if (dNode.parentId === desktopViewport.id) {
              newParentId = viewport.id;
            } else {
              newParentId = idMap.get(dNode.parentId || "") || viewport.id;
            }

            clonedNode.parentId = newParentId;

            // Handle positioning based on stored positions
            if (
              dNode.sharedId &&
              positionsByParent.has(newParentId) &&
              positionsByParent.get(newParentId).has(dNode.sharedId)
            ) {
              // Get the position this sharedId had in this parent
              const targetIndex = positionsByParent
                .get(newParentId)
                .get(dNode.sharedId);

              // Get siblings for positioning
              const siblings = draft.nodes.filter(
                (n) => n.parentId === newParentId && n.id !== clonedNode.id
              );

              // Position directly in the array
              directlyMoveNodeToIndex(clonedNode.id, siblings, targetIndex);
            } else {
              // Use desktop order
              const desktopParent = dNode.parentId;
              const desktopSiblings = desktopSubtree.filter(
                (n) => n.parentId === desktopParent
              );
              const desktopIndex = desktopSiblings.findIndex(
                (n) => n.id === dNode.id
              );

              if (desktopIndex !== -1) {
                // Get siblings for positioning
                const siblings = draft.nodes.filter(
                  (n) => n.parentId === newParentId && n.id !== clonedNode.id
                );

                // Position directly in the array
                directlyMoveNodeToIndex(clonedNode.id, siblings, desktopIndex);
              }
            }
          }
        });

        // FINAL FIX: Check once more for the recently moved shared ID
        // and force its position again to be 100% sure
        if (recentlyMovedSharedId && sourceViewportId && targetIndex !== -1) {
          for (const viewport of viewports) {
            if (viewport.id === sourceViewportId) continue;

            const nodeWithSameSharedId = draft.nodes.find(
              (n) =>
                n.sharedId === recentlyMovedSharedId &&
                findParentViewport(n.parentId, draft.nodes) === viewport.id &&
                // CRITICAL FIX: Skip dynamic nodes
                !isDynamicRelated(n) &&
                !isDynamicDescendant(n.id)
            );

            if (nodeWithSameSharedId) {
              const viewportChildren = draft.nodes.filter(
                (n) => n.parentId === viewport.id
              );
              directlyMoveNodeToIndex(
                nodeWithSameSharedId.id,
                viewportChildren,
                targetIndex
              );
            }
          }
        }
      })
    );
  }

  // This function should be added to your NodeDispatcher class
  // Updated: syncNodePosition()
  // When synchronizing a node’s position, if it’s nested we look up its target parent using the parent's shared data.
  syncNodePosition(nodeId: string | number) {
    this.setState((prev) =>
      produce(prev, (draft) => {
        const node = draft.nodes.find((n) => n.id === nodeId);
        if (!node || !node.sharedId) return;

        console.log(" SYNCING NODES ???");

        const sharedNodes = draft.nodes.filter(
          (n) => n.id !== nodeId && n.sharedId === node.sharedId
        );

        const sourceViewport = findParentViewport(node.parentId, draft.nodes);
        if (!sourceViewport) return;

        const sourceParentId = node.parentId;
        if (!sourceParentId) return;

        const sourceParentNode = draft.nodes.find(
          (n) => n.id === sourceParentId
        );
        if (!sourceParentNode) return;

        const sourceIndex = findIndexWithinParent(
          draft.nodes,
          nodeId,
          sourceParentId
        );
        if (sourceIndex === -1) return;

        const viewports = draft.nodes.filter((n) => n.isViewport);
        viewports.sort((a, b) => b.viewportWidth - a.viewportWidth);
        const viewportOrder = viewports.map((v) => v.id);

        // Update the position of every clone in other viewports
        sharedNodes.forEach((sharedNode) => {
          const targetViewport = findParentViewport(
            sharedNode.parentId,
            draft.nodes
          );
          if (!targetViewport || targetViewport === sourceViewport) return;

          if (sourceParentNode.isViewport) {
            // Special handling for direct children of viewports
            const targetViewportChildren = draft.nodes.filter(
              (n) => n.parentId === targetViewport
            );
            if (targetViewportChildren.length > sourceIndex) {
              const siblingAtIndex = targetViewportChildren[sourceIndex];
              if (siblingAtIndex && siblingAtIndex.id !== sharedNode.id) {
                this.reorderNode(sharedNode.id, targetViewport, sourceIndex);
              }
            } else {
              this.reorderNode(
                sharedNode.id,
                targetViewport,
                targetViewportChildren.length
              );
            }
          } else {
            if (!sourceParentNode.sharedId) return;
            const targetParentNode = draft.nodes.find(
              (n) =>
                n.sharedId === sourceParentNode.sharedId &&
                findParentViewport(n.parentId, draft.nodes) === targetViewport
            );
            if (targetParentNode) {
              sharedNode.parentId = targetParentNode.id;
              const targetSiblings = draft.nodes.filter(
                (n) => n.parentId === targetParentNode.id
              );
              if (targetSiblings.length > 0) {
                this.reorderNode(
                  sharedNode.id,
                  targetParentNode.id,
                  Math.min(sourceIndex, targetSiblings.length)
                );
              }
            }
          }
        });

        // Process all related dynamic nodes to ensure correct viewportId
        const allDynamicNodes = draft.nodes.filter(
          (n) => n.isDynamic && n.sharedId === node.sharedId
        );

        allDynamicNodes.forEach((dynamicNode) => {
          // Find the actual viewport for this node - this is the key fix
          const actualViewportId = findParentViewport(
            dynamicNode.parentId,
            draft.nodes
          );

          if (actualViewportId) {
            // Make sure dynamicViewportId is set to the actual viewport, not the parent
            dynamicNode.dynamicViewportId = actualViewportId;
          }

          // Also ensure dynamicFamilyId is consistent
          if (node.dynamicFamilyId && !dynamicNode.dynamicFamilyId) {
            dynamicNode.dynamicFamilyId = node.dynamicFamilyId;
          }

          // Ensure isDynamic is preserved
          if (node.isDynamic) dynamicNode.isDynamic = node.isDynamic;
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
          } else {
            // For nested children, map the parent relationship to the new variant tree
            const originalParentId = childNode.parentId;
            if (originalParentId) {
              const newParentId = idMap.get(originalParentId);
              if (newParentId) {
                childVariant.parentId = newParentId;
              } else {
              }
            }
          }

          // Store the ID mapping for this node
          idMap.set(childNode.id, childVariantId);

          // Add to the nodes array
          draft.nodes.push(childVariant);
        });
      })
    );

    return variantId;
  }

  removePlaceholders() {
    this.setState((prev) =>
      produce(prev, (draft) => {
        draft.nodes = draft.nodes.filter((node) => node.type !== "placeholder");
      })
    );
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
