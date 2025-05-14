import { CSSProperties } from "react";
import {
  NodeId,
  nodeStore,
  nodeStyleAtom,
  changedNodesAtom,
  batchNodeUpdates,
  nodeSyncFlagsAtom,
  getCurrentNodes,
} from "../";
import { STYLE_RULES } from "../rules/style-rules";

/**
 * Update a node's style and propagate changes to nodes with the same sharedId
 */

type BuilderCSS = CSSProperties & {
  text?: string;
  isAbsoluteInFrame?: string;
  isFakeFixed?: string;
};

interface UpdateNodeStyleOptions {
  dontSync?: boolean;
}

export function updateNodeStyle(
  nodeId: NodeId,
  style: BuilderCSS,
  options?: UpdateNodeStyleOptions
): void {
  // Batch all operations to minimize re-renders
  batchNodeUpdates(() => {
    // First, update the source node's style
    nodeStore.set(nodeStyleAtom(nodeId), {
      ...nodeStore.get(nodeStyleAtom(nodeId)),
      ...style,
    });

    // Skip rule application if dontSync option is provided
    if (options?.dontSync) {
      // Mark source node as changed but skip cascading
      nodeStore.set(changedNodesAtom, (prev: Set<NodeId>) => {
        const newSet = new Set(prev);
        newSet.add(nodeId);
        return newSet;
      });
      return;
    }

    // Collect all operations from rules
    const operations: StyleOperation[] = [];

    // Apply rules to generate operations
    STYLE_RULES.forEach((rule) => {
      if (rule.condition(nodeId, style)) {
        const ruleOps = rule.operations(nodeId, style);
        operations.push(...ruleOps);

        // Execute any "after" hooks
        if (rule.after) {
          rule.after(nodeId, style);
        }
      }
    });

    // Apply all operations
    applyStyleOperations(operations);

    // Mark source node as changed
    nodeStore.set(changedNodesAtom, (prev: Set<NodeId>) => {
      const newSet = new Set(prev);
      newSet.add(nodeId);
      return newSet;
    });
  });
}

// Type for style operations
interface StyleOperation {
  type: "update";
  targetId: NodeId;
  style: CSSProperties;
  reason: string;
}

/**
 * Apply a list of style operations to the node store
 */
function applyStyleOperations(operations: StyleOperation[]): void {
  // Track nodes that were changed
  const changedNodes = new Set<NodeId>();

  // Apply each operation
  operations.forEach((op) => {
    if (op.type === "update") {
      // Update the target node's style
      nodeStore.set(nodeStyleAtom(op.targetId), {
        ...nodeStore.get(nodeStyleAtom(op.targetId)),
        ...op.style,
      });

      // Mark node as changed
      changedNodes.add(op.targetId);
    }
  });

  // Update the changed nodes atom
  if (changedNodes.size > 0) {
    nodeStore.set(changedNodesAtom, (prev: Set<NodeId>) => {
      const newSet = new Set(prev);
      changedNodes.forEach((id) => newSet.add(id));
      return newSet;
    });
  }
}

/**
 * React hook to update a node's style with synchronization
 */
export function useUpdateNodeStyleWithSync(nodeId: NodeId) {
  return (style: CSSProperties, options?: UpdateNodeStyleOptions) => {
    updateNodeStyle(nodeId, style, options);
  };
}

/**
 * Align all viewports horizontally with proper spacing
 * This arranges viewports from largest to smallest width
 */
export function alignViewports() {
  // Batch all operations to minimize re-renders
  batchNodeUpdates(() => {
    // First get all nodes and filter for viewports
    const allNodes = getCurrentNodes();
    const viewports = allNodes
      .filter((node) => node.isViewport)
      .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0));

    // If less than 2 viewports, no need to align
    if (viewports.length <= 1) return;

    // Calculate and apply positions for each viewport
    const VIEWPORT_GAP = 160; // Gap between viewports
    let currentLeft = 0;

    viewports.forEach((viewport) => {
      const width =
        viewport.viewportWidth ||
        parseFloat(viewport.style.width as string) ||
        0;

      // Update style with dontSync option to prevent cascading updates
      updateNodeStyle(
        viewport.id,
        {
          left: `${currentLeft}px`,
          top: "0px",
        },
        { dontSync: true }
      );

      // Calculate position for next viewport
      currentLeft += width + VIEWPORT_GAP;
    });
  });
}
