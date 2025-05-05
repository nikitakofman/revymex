import { useRef } from "react";
import {
  useGetDraggedNode,
  useGetIsDragging,
  dragOps,
} from "../atoms/drag-store";
import {
  useGetNodeParent,
  useGetNodeChildren,
} from "../atoms/node-store/hierarchy-store";
import { moveNode } from "../atoms/node-store/operations/insert-operations";

export const useMouseMove = () => {
  const getDraggedNode = useGetDraggedNode();
  const getIsDragging = useGetIsDragging();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();

  const lastTarget = useRef<{ id: string; pos: "before" | "after" } | null>(
    null
  );
  const prevMousePosRef = useRef({ x: 0, y: 0 });

  return (e: MouseEvent) => {
    if (!getIsDragging()) return;

    const dragged = getDraggedNode();
    if (!dragged) return;

    const placeholderId = dragged.offset.placeholderId;
    if (!placeholderId) return;

    const parentId = getNodeParent(placeholderId);
    if (!parentId) return;

    /* --- siblings minus placeholders & self --- */
    const siblings = getNodeChildren(parentId).filter(
      (id) =>
        id !== placeholderId &&
        id !== dragged.node.id &&
        !id.includes("placeholder")
    );
    if (!siblings.length) return;

    // Get parent element to check flex direction
    const parentElement = document.querySelector(
      `[data-node-id="${parentId}"]`
    );
    if (!parentElement) return;

    // Check parent's flex direction
    const parentStyle = window.getComputedStyle(parentElement);
    const isColumn = parentStyle.flexDirection.includes("column");

    /* --- Get sibling elements with their boundaries --- */
    const siblingElements = siblings
      .map((id) => {
        const el = document.querySelector<HTMLElement>(
          `[data-node-id="${id}"]`
        );
        if (!el) return null;
        return { id, rect: el.getBoundingClientRect() };
      })
      .filter(Boolean);

    /* --- Sort siblings by position --- */
    const sortedSiblings = siblingElements.sort((a, b) => {
      return isColumn
        ? a.rect.top - b.rect.top // Sort by vertical position for column layout
        : a.rect.left - b.rect.left; // Sort by horizontal position for row layout
    });

    /* --- Calculate movement direction --- */
    const mouseXDirection = e.clientX - prevMousePosRef.current.x;
    const mouseYDirection = e.clientY - prevMousePosRef.current.y;

    const isMovingRight = mouseXDirection > 1;
    const isMovingLeft = mouseXDirection < -1;
    const isMovingDown = mouseYDirection > 1;
    const isMovingUp = mouseYDirection < -1;

    /* --- Find which zone contains the mouse --- */
    let targetInfo = null;

    if (isColumn) {
      // For column layout (vertical zones)

      // Check if we're before the first sibling
      if (sortedSiblings.length > 0 && e.clientY < sortedSiblings[0].rect.top) {
        targetInfo = { id: sortedSiblings[0].id, pos: "before" as const };
      }
      // Check if we're after the last sibling
      else if (
        sortedSiblings.length > 0 &&
        e.clientY > sortedSiblings[sortedSiblings.length - 1].rect.bottom
      ) {
        targetInfo = {
          id: sortedSiblings[sortedSiblings.length - 1].id,
          pos: "after" as const,
        };
      } else {
        // Find which vertical zone we're in
        for (let i = 0; i < sortedSiblings.length; i++) {
          const sibling = sortedSiblings[i];

          // If cursor is within this sibling's vertical bounds
          if (
            e.clientY >= sibling.rect.top &&
            e.clientY <= sibling.rect.bottom
          ) {
            // Immediately use movement direction to determine position
            if (isMovingUp) {
              targetInfo = { id: sibling.id, pos: "before" as const };
            } else if (isMovingDown) {
              targetInfo = { id: sibling.id, pos: "after" as const };
            } else {
              // If no significant movement, use position in the sibling
              const pos =
                e.clientY < sibling.rect.top + sibling.rect.height / 2
                  ? "before"
                  : "after";
              targetInfo = { id: sibling.id, pos: pos as const };
            }
            break;
          }

          // If we're between this sibling and the next one
          if (i < sortedSiblings.length - 1) {
            const nextSibling = sortedSiblings[i + 1];
            if (
              e.clientY > sibling.rect.bottom &&
              e.clientY < nextSibling.rect.top
            ) {
              targetInfo = { id: sibling.id, pos: "after" as const };
              break;
            }
          }
        }
      }
    } else {
      // For row layout (horizontal zones)

      // Check if we're before the first sibling
      if (
        sortedSiblings.length > 0 &&
        e.clientX < sortedSiblings[0].rect.left
      ) {
        targetInfo = { id: sortedSiblings[0].id, pos: "before" as const };
      }
      // Check if we're after the last sibling
      else if (
        sortedSiblings.length > 0 &&
        e.clientX > sortedSiblings[sortedSiblings.length - 1].rect.right
      ) {
        targetInfo = {
          id: sortedSiblings[sortedSiblings.length - 1].id,
          pos: "after" as const,
        };
      } else {
        // Find which horizontal zone we're in
        for (let i = 0; i < sortedSiblings.length; i++) {
          const sibling = sortedSiblings[i];

          // If cursor is within this sibling's horizontal bounds
          if (
            e.clientX >= sibling.rect.left &&
            e.clientX <= sibling.rect.right
          ) {
            // Immediately use movement direction to determine position
            if (isMovingLeft) {
              targetInfo = { id: sibling.id, pos: "before" as const };
            } else if (isMovingRight) {
              targetInfo = { id: sibling.id, pos: "after" as const };
            } else {
              // If no significant movement, use position in the sibling
              const pos =
                e.clientX < sibling.rect.left + sibling.rect.width / 2
                  ? "before"
                  : "after";
              targetInfo = { id: sibling.id, pos: pos as const };
            }
            break;
          }

          // If we're between this sibling and the next one
          if (i < sortedSiblings.length - 1) {
            const nextSibling = sortedSiblings[i + 1];
            if (
              e.clientX > sibling.rect.right &&
              e.clientX < nextSibling.rect.left
            ) {
              targetInfo = { id: sibling.id, pos: "after" as const };
              break;
            }
          }
        }
      }
    }

    /* --- Skip if no target found or if it hasn't changed --- */
    if (!targetInfo) {
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    /* --- Skip redundant moves --- */
    if (
      lastTarget.current &&
      lastTarget.current.id === targetInfo.id &&
      lastTarget.current.pos === targetInfo.pos
    ) {
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Update last target
    lastTarget.current = targetInfo;

    /* --- Move placeholder --- */
    const ordered = getNodeChildren(parentId); // includes placeholder
    const clean = ordered.filter(
      (id) => id !== placeholderId && !id.includes("placeholder")
    );
    const targetIdx = clean.indexOf(targetInfo.id);
    const newIdx = targetInfo.pos === "before" ? targetIdx : targetIdx + 1;

    const currentIdx = ordered.indexOf(placeholderId);
    if (currentIdx !== newIdx) {
      moveNode(placeholderId, parentId, newIdx);
      dragOps.setDropInfo(targetInfo.id, targetInfo.pos, 0, 0);
    }

    // Update mouse position for next calculation
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
