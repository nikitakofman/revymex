// src/builder/context/hooks/useDragRules.ts
import { useCallback, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilderRefs } from "@/builder/context/builderState";
import {
  DRAG_RULES,
  applyDragOperations,
  DragRuleType,
  ParentDragStartParams,
  SiblingReorderParams,
  EndDragParams,
} from "../rules/drag-rules";
import { calculateAndUpdateDimensions } from "../../utils";
import { useGetTransform } from "@/builder/context/atoms/canvas-interaction-store";
import { useGetSelectedIds } from "@/builder/context/atoms/select-store";
import {
  useGetIsDragging,
  useGetDraggedNode,
  useGetPlaceholderInfo,
  dragOps,
} from "@/builder/context/atoms/drag-store";
import { useGetNodesForDrag } from "../../atoms/node-store";

/**
 * Hook to handle drag and drop using rules-based operations
 */
export function useDragRules() {
  const { contentRef, containerRef, selectedIdsRef } = useBuilderRefs();
  const getTransform = useGetTransform();
  const currentSelectedIds = useGetSelectedIds();
  const isDragging = useGetIsDragging();
  const getDraggedNode = useGetDraggedNode();
  const getPlaceholderInfo = useGetPlaceholderInfo();

  // Ref to store the parent element during drag, avoiding repeated DOM queries
  const parentElementRef = useRef<Element | null>(null);

  // Ref to track previous mouse position
  const prevMousePosRef = useRef({ x: 0, y: 0 });

  // Get nodes for drag operations
  const getNodesForDrag = useGetNodesForDrag();

  /**
   * Start dragging a node
   */
  const dragStart = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();

      if (!node || !contentRef.current) return;

      // Get selected nodes
      const selectedIds = currentSelectedIds();
      selectedIdsRef.current = [...selectedIds];

      // Get element for the node
      const element = document.querySelector(
        `[data-node-id="${node.id}"]`
      ) as HTMLElement;
      if (!element) return;

      // Store reference to the parent element for future use
      parentElementRef.current = document.querySelector(
        `[data-node-id="${node.parentId}"]`
      );

      // Get transform and content rect
      const transform = getTransform();
      const contentRect = contentRef.current.getBoundingClientRect();

      // Calculate dimensions for the placeholder
      const { finalWidth, finalHeight } = calculateAndUpdateDimensions({
        node,
        element,
        transform,
        setNodeStyle: () => {}, // No-op as we're just calculating
        preventUnsync: true,
      });

      // Calculate mouse offset relative to the element
      const elementRect = element.getBoundingClientRect();
      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      // Create params for the rules
      const params: ParentDragStartParams = {
        node,
        element,
        selectedIds,
        transform,
        contentRect,
        mouseX: mouseOffsetX,
        mouseY: mouseOffsetY,
        finalWidth,
        finalHeight,
        nodeState: getNodesForDrag(),
      };

      // Apply each drag start rule that matches the conditions
      for (const rule of DRAG_RULES[DragRuleType.START]) {
        // Check if rule applies
        if (rule.condition(params)) {
          // Generate operations from the rule
          const operations = rule.operations(params);

          // Apply the operations
          applyDragOperations(operations);

          // Call after hook if it exists
          if (rule.after) {
            rule.after(params);
          }
        }
      }

      // Store initial mouse position
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    },
    [contentRef, currentSelectedIds, getTransform, selectedIdsRef]
  );

  /**
   * Handle mouse movement during dragging
   */
  const dragMove = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();

      // Only process if dragging
      if (!isDragging) return;

      // Always update last mouse position
      dragOps.setLastMousePosition(e.clientX, e.clientY);

      // Get the current dragged node info
      const draggedNodeInfo = getDraggedNode();
      if (!draggedNodeInfo) return;

      // Get placeholder info
      const placeholderInfo = getPlaceholderInfo();
      if (!placeholderInfo) return;

      // Get transform
      const transform = getTransform();

      // Calculate canvas position
      const containerRect =
        containerRef.current?.getBoundingClientRect() || new DOMRect();
      const canvasX =
        (e.clientX - containerRect.left - transform.x) / transform.scale;
      const canvasY =
        (e.clientY - containerRect.top - transform.y) / transform.scale;

      // Use the cached parent element or re-query if needed
      const parentElement =
        parentElementRef.current ||
        document.querySelector(
          `[data-node-id="${draggedNodeInfo.node.parentId}"]`
        );

      // Store for future reference
      parentElementRef.current = parentElement;

      // Create params for the rules
      const params: SiblingReorderParams = {
        draggedNode: draggedNodeInfo.node,
        placeholderInfo,
        parentElement,
        mouseX: e.clientX,
        mouseY: e.clientY,
        prevMouseX: prevMousePosRef.current.x,
        prevMouseY: prevMousePosRef.current.y,
        canvasX,
        canvasY,
        nodeState: getNodesForDrag(),
      };

      // Apply each drag move rule that matches conditions
      for (const rule of DRAG_RULES[DragRuleType.MOVE]) {
        // Check if rule applies
        if (rule.condition(params)) {
          // Generate operations from the rule
          const operations = rule.operations(params);

          // Apply the operations
          applyDragOperations(operations);

          // Call after hook if it exists
          if (rule.after) {
            rule.after(params);
          }
        }
      }

      // Update previous mouse position
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    },
    [isDragging, getDraggedNode, getPlaceholderInfo, getTransform, containerRef]
  );

  /**
   * Handle mouse up to end dragging
   */
  const dragEnd = useCallback(() => {
    // Only process if dragging
    if (!isDragging) return;

    // Get placeholder info
    const placeholderInfo = getPlaceholderInfo();

    // Create params for the rules
    const params: EndDragParams = {
      placeholderInfo,
      nodeState: getNodesForDrag(),
    };

    // Apply each drag end rule that matches conditions
    for (const rule of DRAG_RULES[DragRuleType.END]) {
      // Check if rule applies
      if (rule.condition(params)) {
        // Generate operations from the rule
        const operations = rule.operations(params);

        // Apply the operations
        applyDragOperations(operations);

        // Call after hook if it exists
        if (rule.after) {
          rule.after(params);
        }
      }
    }

    // Clean up refs
    parentElementRef.current = null;
  }, [isDragging, getPlaceholderInfo]);

  return { dragStart, dragMove, dragEnd };
}
