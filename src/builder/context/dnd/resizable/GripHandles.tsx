import { useCallback, useState, useLayoutEffect, RefObject } from "react";
import { createPortal } from "react-dom";
import { useBuilder } from "../../builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Move, MoveHorizontal, MoveVertical } from "lucide-react";
import { useDragStart } from "../useDragStart";

export const GripHandles = ({
  node,
  elementRef,
}: {
  node: Node;
  elementRef: RefObject<HTMLDivElement>;
}) => {
  const { dragDisp, dragState, nodeState, transform, contentRef } =
    useBuilder();
  const handleDragStart = useDragStart();
  const [parentRect, setParentRect] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });

  const startGripDrag = useCallback(
    async (e: React.MouseEvent, nodeToMove: Node) => {
      if (!elementRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const targetElement = document.querySelector(
        `[data-node-id="${nodeToMove.id}"]`
      );
      const parentElement = targetElement?.parentElement;
      if (!parentElement) return;

      const isColumn =
        getComputedStyle(parentElement).flexDirection === "column";

      handleDragStart(e, undefined, nodeToMove);

      requestAnimationFrame(() => {
        dragDisp.setPartialDragState({
          dragSource: "gripHandle",
          gripHandleDirection: isColumn ? "vertical" : "horizontal",
        });
      });
    },
    [elementRef, dragDisp, handleDragStart]
  );

  const parentNode = nodeState.nodes.find(
    (n) => n.id === node.parentId && n.type === "frame"
  );
  const parentElement = parentNode
    ? (document.querySelector(
        `[data-node-id="${parentNode.id}"]`
      ) as HTMLElement)
    : null;
  const parentParentElement = parentElement?.parentElement;
  const isParentColumn = parentParentElement
    ? getComputedStyle(parentParentElement).flexDirection === "column"
    : false;

  const currentElement = elementRef.current?.parentElement;
  const isColumn = currentElement
    ? getComputedStyle(currentElement).flexDirection === "column"
    : false;

  useLayoutEffect(() => {
    if (!parentElement || !contentRef.current) return;

    const updateParentRect = () => {
      const pElement = parentElement;
      const content = contentRef.current;
      if (!pElement || !content) return;

      const elementRect = pElement.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();

      const width = elementRect.width / transform.scale;
      const height = elementRect.height / transform.scale;
      const left = (elementRect.left - contentRect.left) / transform.scale;
      const top = (elementRect.top - contentRect.top) / transform.scale;

      setParentRect({
        top,
        left,
        width,
        height,
      });
    };

    const observer = new MutationObserver(updateParentRect);
    observer.observe(parentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "transform"],
      subtree: false,
    });

    window.addEventListener("resize", updateParentRect);
    window.addEventListener("scroll", updateParentRect, true);

    updateParentRect();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateParentRect);
      window.removeEventListener("scroll", updateParentRect, true);
    };
  }, [parentElement, contentRef, transform.scale]);

  const renderGripHandle = (
    targetNode: Node,
    isParentHandle: boolean = false,
    flexDir: boolean
  ) => (
    <div
      key={`grip-${targetNode.id}`}
      className="absolute"
      style={{
        pointerEvents: "auto",
        opacity: isParentHandle ? 0.5 : 1,
        transition: "opacity 0.15s",
        ...(flexDir
          ? {
              left: `${-36 / transform.scale}px`,
              top: "50%",
              transform: "translateY(-50%)",
            }
          : {
              bottom: `${-36 / transform.scale}px`,
              left: "50%",
              transform: "translateX(-50%)",
            }),
      }}
      onMouseDown={(e) => {
        dragDisp.clearSelection();
        dragDisp.addToSelection(targetNode.id);
        startGripDrag(e, targetNode);
      }}
      onClick={(e) => {
        e.stopPropagation();
        console.log("CLICK", targetNode);
        dragDisp.addToSelection(targetNode.id);
      }}
      onMouseEnter={
        isParentHandle
          ? (e) => (e.currentTarget.style.opacity = "1")
          : undefined
      }
      onMouseLeave={
        isParentHandle
          ? (e) => (e.currentTarget.style.opacity = "0.5")
          : undefined
      }
    >
      <div
        className={`rounded-full cursor-grabbing ${
          targetNode.isDynamic || dragState.dynamicModeNodeId
            ? `bg-[var(--accent-secondary)]`
            : `bg-[var(--accent)]`
        } flex items-center justify-center`}
        style={{
          width: `${24 / transform.scale}px`,
          height: `${24 / transform.scale}px`,
          padding: `${5 / transform.scale}px`,
        }}
      >
        {flexDir ? (
          node.parentId ? (
            <MoveVertical size={18 / transform.scale} />
          ) : (
            <Move size={18 / transform.scale} />
          )
        ) : node.parentId ? (
          <MoveHorizontal size={18 / transform.scale} />
        ) : (
          <Move size={18 / transform.scale} />
        )}
      </div>
    </div>
  );

  return (
    <>
      {(node.style.rotate === "0deg" || node.style.rotate === undefined) &&
        renderGripHandle(node, false, isColumn)}

      {parentNode &&
        (parentNode.style.rotate === "0deg" ||
          parentNode?.style.rotate === undefined) &&
        contentRef.current &&
        createPortal(
          <div
            className="pointer-events-none"
            style={{
              position: "absolute",
              top: parentRect.top,
              left: parentRect.left,
              width: parentRect.width,
              height: parentRect.height,
              zIndex: 9999,
            }}
          >
            {renderGripHandle(parentNode, true, isParentColumn)}
          </div>,
          contentRef.current
        )}
    </>
  );
};
