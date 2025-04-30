// src/builder/context/rules/drag-rules.ts
import { Node } from "@/builder/reducer/nodeDispatcher";
import { NodeId } from "@/builder/context/atoms/node-store";
import { createPlaceholder } from "../createPlaceholder";
import { dragOps, DragState } from "@/builder/context/atoms/drag-store";
import {
  visualOps,
  LineIndicatorProps,
} from "@/builder/context/atoms/visual-store";
import {
  computeSiblingReorderResult,
  findIndexWithinParent,
} from "../../utils";
import { unstable_batchedUpdates } from "react-dom";
import {
  NodeOperations,
  createInsertOperation,
  createMoveOperation,
  createRemoveOperation,
  applyNodeOperations,
} from "@/builder/context/atoms/node-store/operations/insert-operations";

// Enum for drag rule types
export enum DragRuleType {
  START = "START",
  MOVE = "MOVE",
  END = "END",
}

// Strongly typed discriminated union for operations
export type DragOperation =
  | {
      type: "node-operation";
      payload: NodeOperations;
    }
  | {
      type: "update-drag-state";
      payload: Partial<DragState>;
    }
  | {
      type: "show-indicator";
      payload: LineIndicatorProps;
    }
  | {
      type: "hide-indicator";
    };

// Interfaces for parent container drag rule params
export interface ParentDragStartParams {
  node: Node;
  element: HTMLElement;
  selectedIds: NodeId[];
  transform: { x: number; y: number; scale: number };
  contentRect: DOMRect;
  mouseX: number;
  mouseY: number;
  finalWidth?: string;
  finalHeight?: string;
  nodeState: any;
}

export interface SiblingReorderParams {
  draggedNode: Node;
  placeholderInfo: {
    mainPlaceholderId: NodeId;
    nodeOrder: NodeId[];
    additionalPlaceholders: Array<{
      placeholderId: NodeId;
      nodeId: NodeId;
    }>;
  };
  parentElement: Element;
  mouseX: number;
  mouseY: number;
  prevMouseX: number;
  prevMouseY: number;
  canvasX: number;
  canvasY: number;
  nodeState: any;
}

export interface EndDragParams {
  placeholderInfo: {
    mainPlaceholderId: NodeId;
    additionalPlaceholders: Array<{
      placeholderId: NodeId;
      nodeId: NodeId;
    }>;
  } | null;
  nodeState: any;
}

// Generic type for a drag rule
export interface DragRule<T> {
  name: string;
  description: string;
  condition: (params: T) => boolean;
  operations: (params: T) => DragOperation[];
  after?: (params: T) => void;
  cleanup?: () => void;
}

// Apply drag operations using node operations with batched updates
export function applyDragOperations(operations: DragOperation[]): void {
  // Collect node operations to apply them in one batch
  const nodeOperations: NodeOperations[] = [];

  // Batch all operations in one update
  unstable_batchedUpdates(() => {
    operations.forEach((op) => {
      switch (op.type) {
        case "node-operation":
          // Collect node operations for batched processing
          nodeOperations.push(op.payload);
          break;
        case "update-drag-state":
          dragOps.setPartialDragState(op.payload);
          break;
        case "show-indicator":
          visualOps.setLineIndicator(op.payload);
          break;
        case "hide-indicator":
          visualOps.hideLineIndicator();
          break;
        default:
          console.warn(`Unknown drag operation type: ${(op as any).type}`);
          break;
      }
    });

    // Apply all node operations in a single batch if we have any
    if (nodeOperations.length > 0) {
      applyNodeOperations(nodeOperations);
    }
  });
}

// Rule for starting a drag within a parent container
export const parentContainerDragStartRule: DragRule<ParentDragStartParams> = {
  name: "parent-container-drag-start",
  description: "Handle starting a drag for a node within its parent container",

  condition: (params: ParentDragStartParams) => {
    // Only apply for nodes with a parent in the viewport
    return !!params.node.parentId && !!params.node.inViewport;
  },

  operations: (params: ParentDragStartParams) => {
    const {
      node,
      element,
      selectedIds,
      transform,
      contentRect,
      mouseX,
      mouseY,
      finalWidth,
      finalHeight,
      nodeState,
    } = params;

    // Create a placeholder
    const placeholder = createPlaceholder({
      node,
      element,
      transform,
      finalWidth,
      finalHeight,
    });

    // Find the index of the node
    const oldIndex = findIndexWithinParent(
      nodeState.nodes,
      node.id,
      node.parentId
    );

    // Calculate element dimensions
    const elementRect = element.getBoundingClientRect();
    const isFillMode = element.style.flex === "1 0 0px";

    // Initial position for dragged node in canvas coordinates
    const initialX =
      (elementRect.left - contentRect.left - transform.x) / transform.scale;
    const initialY =
      (elementRect.top - contentRect.top - transform.y) / transform.scale;

    // Create operations
    return [
      {
        type: "node-operation",
        payload: createInsertOperation(placeholder, node.parentId, oldIndex),
      },
      {
        type: "update-drag-state",
        payload: {
          isDragging: true,
          dragSource: "viewport",
          draggedNode: {
            node,
            offset: {
              x: initialX,
              y: initialY,
              mouseX: mouseX,
              mouseY: mouseY,
            },
          },
          // Set initial position for the dragged element
          dragPositions: {
            x: initialX,
            y: initialY,
          },
          placeholderInfo: {
            mainPlaceholderId: placeholder.id,
            nodeOrder: selectedIds,
            additionalPlaceholders: [],
          },
          nodeDimensions: {
            [node.id]: {
              width: element.style.width,
              height: element.style.height,
              isFillMode,
              finalWidth: finalWidth || element.style.width,
              finalHeight: finalHeight || element.style.height,
            },
          },
        },
      },
    ];
  },
};

// Rule for reordering siblings during a drag
export const siblingReorderDragMoveRule: DragRule<SiblingReorderParams> = {
  name: "sibling-reorder-drag-move",
  description: "Handle reordering a node among its siblings during drag",

  condition: (params: SiblingReorderParams) => {
    // Only apply if we have a placeholder and parent element
    return (
      !!params.draggedNode?.parentId &&
      !!params.placeholderInfo?.mainPlaceholderId &&
      !!params.parentElement
    );
  },

  operations: (params: SiblingReorderParams) => {
    const {
      draggedNode,
      placeholderInfo,
      parentElement,
      mouseX,
      mouseY,
      prevMouseX,
      prevMouseY,
      nodeState,
      canvasX,
      canvasY,
    } = params;

    // Always create an operation to update the drag positions
    const operations: DragOperation[] = [
      {
        type: "update-drag-state",
        payload: {
          // Set the drag positions based on current mouse position
          dragPositions: {
            x: canvasX,
            y: canvasY,
          },
        },
      },
    ];

    // Compute the reordering result
    const computedResult = computeSiblingReorderResult(
      draggedNode,
      nodeState.nodes,
      parentElement,
      mouseX,
      mouseY,
      prevMouseX,
      prevMouseY
    );

    if (computedResult) {
      // Add operations for placeholder movement and drop info
      operations.push(
        {
          type: "node-operation",
          payload: createMoveOperation(placeholderInfo.mainPlaceholderId, {
            targetId: computedResult.targetId,
            position: computedResult.position,
            inViewport: true,
          }),
        },
        {
          type: "update-drag-state",
          payload: {
            dropInfo: {
              targetId: computedResult.targetId,
              position: computedResult.position,
              dropX: canvasX,
              dropY: canvasY,
            },
          },
        },
        {
          type: "hide-indicator",
        }
      );
    }

    return operations;
  },
};

// Rule for ending a drag operation with placeholders
export const endDragWithPlaceholdersRule: DragRule<EndDragParams> = {
  name: "end-drag-with-placeholders",
  description: "Clean up placeholders when drag ends",

  condition: (params) => {
    return !!params.placeholderInfo;
  },

  operations: (params) => {
    const { placeholderInfo } = params;

    // Create operations to remove all placeholders
    const operations: DragOperation[] = [];

    // Remove main placeholder
    if (placeholderInfo) {
      operations.push({
        type: "node-operation",
        payload: createRemoveOperation(placeholderInfo.mainPlaceholderId),
      });

      // Remove any additional placeholders
      if (placeholderInfo.additionalPlaceholders.length > 0) {
        placeholderInfo.additionalPlaceholders.forEach(
          (additionalPlaceholder) => {
            operations.push({
              type: "node-operation",
              payload: createRemoveOperation(
                additionalPlaceholder.placeholderId
              ),
            });
          }
        );
      }
    }

    // Reset drag state
    operations.push({
      type: "update-drag-state",
      payload: {
        isDragging: false,
        placeholderInfo: null,
        dropInfo: null,
        // Clear drag positions when ending drag
        dragPositions: null,
      },
    });

    // Hide any indicators
    operations.push({
      type: "hide-indicator",
    });

    return operations;
  },
};

// Collection of drag rules
export const DRAG_RULES = {
  [DragRuleType.START]: [parentContainerDragStartRule],
  [DragRuleType.MOVE]: [siblingReorderDragMoveRule],
  [DragRuleType.END]: [endDragWithPlaceholdersRule],
};
