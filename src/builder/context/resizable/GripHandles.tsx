import {
  useCallback,
  useState,
  useLayoutEffect,
  RefObject,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useBuilderRefs } from "../builderState";
import { Move, MoveHorizontal, MoveVertical } from "lucide-react";
import { useDragStart } from "../dnd/useDragStart";
import { hasSkewTransform } from "../utils";
import { selectOps, useGetSelectedIds } from "../atoms/select-store";
import { dragOps } from "../atoms/drag-store";
import { useTransform } from "../atoms/canvas-interaction-store";
import { useDynamicModeNodeId } from "../atoms/dynamic-store";
import {
  NodeId,
  useNodeStyle,
  useNodeFlags,
  useNodeParent,
  useGetNode,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeParent,
} from "../atoms/node-store";
import {
  useNodeChildren,
  useGetNodeChildren,
} from "../atoms/node-store/hierarchy-store";

export const GripHandles = ({
  nodeId,
  elementRef,
}: {
  nodeId: NodeId;
  elementRef: RefObject<HTMLDivElement>;
}) => {
  // Get node data directly from atoms
  const style = useNodeStyle(nodeId);
  const flags = useNodeFlags(nodeId);
  const { isDynamic = false } = flags;
  const parentId = useNodeParent(nodeId);

  // Get getter functions for other operations
  const getNode = useGetNode();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();

  const { contentRef } = useBuilderRefs();
  const handleDragStart = useDragStart();
  const [parentRect, setParentRect] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });

  const { clearSelection, addToSelection } = selectOps;

  const dynamicModeNodeId = useDynamicModeNodeId();

  const transform = useTransform();

  // Check if node has siblings (nodes with same parent) using hierarchy store
  // This avoids filtering through all nodes
  const hasSiblings = useMemo(() => {
    if (!parentId) return false;

    // Get children of the parent from hierarchy store
    const siblings = getNodeChildren(parentId);

    // Count siblings excluding the current node
    return siblings.filter((id) => id !== nodeId).length > 0;
  }, [parentId, nodeId, getNodeChildren]);

  // Get the parent node directly instead of filtering through all nodes
  const parentNodeId = parentId;
  const parentNodeType = parentNodeId ? getNodeStyle(parentNodeId)?.type : null;
  const isParentFrame = parentNodeType === "frame";

  // Check if parent node has siblings using hierarchy store
  const parentHasSiblings = useMemo(() => {
    if (!parentNodeId || !isParentFrame) return false;

    // Get the parent's parent
    const grandparentId = getNodeParent(parentNodeId);
    if (!grandparentId) return false;

    // Get children of the grandparent
    const parentSiblings = getNodeChildren(grandparentId);

    // Count parent's siblings excluding the parent
    return parentSiblings.filter((id) => id !== parentNodeId).length > 0;
  }, [parentNodeId, isParentFrame, getNodeParent, getNodeChildren]);

  const startGripDrag = useCallback(
    async (e: React.MouseEvent, nodeIdToMove: NodeId) => {
      if (!elementRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const targetElement = document.querySelector(
        `[data-node-id="${nodeIdToMove}"]`
      );
      const parentElement = targetElement?.parentElement;
      if (!parentElement) return;

      const isColumn =
        getComputedStyle(parentElement).flexDirection === "column";

      // Build a full node for the drag operation
      const nodeToMove = getNode(nodeIdToMove);

      handleDragStart(e, undefined, nodeToMove);

      requestAnimationFrame(() => {
        dragOps.setPartialDragState({
          dragSource: "gripHandle",
          gripHandleDirection: isColumn ? "vertical" : "horizontal",
        });
      });
    },
    [elementRef, handleDragStart, getNode]
  );

  // Get the parent element from the DOM
  const parentElement = parentNodeId
    ? (document.querySelector(
        `[data-node-id="${parentNodeId}"]`
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
    targetNodeId: NodeId,
    isParentHandle: boolean = false,
    flexDir: boolean
  ) => {
    // Get the target node's flags and style on-demand
    const targetNodeIsDynamic = getNodeFlags(targetNodeId)?.isDynamic || false;

    return (
      <div
        key={`grip-${targetNodeId}`}
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
          clearSelection();
          addToSelection(targetNodeId);
          startGripDrag(e, targetNodeId);
        }}
        onClick={(e) => {
          e.stopPropagation();
          addToSelection(targetNodeId);
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
            targetNodeIsDynamic || dynamicModeNodeId
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
            parentId ? (
              <MoveVertical size={18 / transform.scale} />
            ) : (
              <Move size={18 / transform.scale} />
            )
          ) : parentId ? (
            <MoveHorizontal size={18 / transform.scale} />
          ) : (
            <Move size={18 / transform.scale} />
          )}
        </div>
      </div>
    );
  };

  // Get parent node style
  const parentNodeStyle = parentNodeId ? getNodeStyle(parentNodeId) : null;
  const parentRotate = parentNodeStyle?.rotate;

  return (
    <>
      {/* Only show the node's grip handle if it has siblings */}
      {hasSiblings &&
        (style.rotate === "0deg" ||
          style.rotate === undefined ||
          !style.transform) &&
        !hasSkewTransform(style.transform) &&
        renderGripHandle(nodeId, false, isColumn)}

      {/* Only show the parent's grip handle if the parent has siblings */}
      {parentNodeId &&
        isParentFrame &&
        parentHasSiblings &&
        (parentRotate === "0deg" || parentRotate === undefined) &&
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
            {renderGripHandle(parentNodeId, true, isParentColumn)}
          </div>,
          contentRef.current
        )}
    </>
  );
};
