import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { findIndexWithinParent } from "./utils";
import { nanoid } from "nanoid";
import { convertToNewUnit } from "@/builder/registry/tools/_components/ToolInput";
import { parse } from "path";

export const useDragStart = () => {
  const {
    dragDisp,
    nodeDisp,
    transform,
    contentRef,
    nodeState,
    dragState,
    setNodeStyle,
    startRecording,
  } = useBuilder();

  const getDynamicParentNode = (node: Node): Node | null => {
    let currentNode = node;
    while (currentNode.parentId) {
      const parent = nodeState.nodes.find((n) => n.id === currentNode.parentId);
      if (!parent) break;
      if (parent.isDynamic) return parent;
      currentNode = parent;
    }
    return null;
  };

  return (e: React.MouseEvent, fromToolbarType?: string, node?: Node) => {
    // Check if the click is on a resize handle or its parent resize handle container
    const target = e.target as HTMLElement;
    const resizeHandle = target.closest('[data-resize-handle="true"]');

    console.log("STARTING DRAG");

    console.log("REISZE HANDLE", resizeHandle);
    if (resizeHandle) {
      e.preventDefault();
      e.stopPropagation();
      return; // Exit early if clicking on a resize handle
    }

    e.preventDefault();
    dragDisp.setIsDragging(true);

    const sessionId = startRecording();
    dragDisp.setRecordingSessionId(sessionId);

    if (fromToolbarType) {
      const newNode: Node = {
        id: nanoid(),
        type: fromToolbarType,
        style: {
          width: "150px",
          height: "150px",
          position: "fixed",
          backgroundColor: fromToolbarType === "frame" ? "gray" : undefined,
          flex: "0 0 auto",
        },
        inViewport: true,
        parentId: null,
      };

      dragDisp.setDraggedNode(newNode, {
        x: e.clientX,
        y: e.clientY,
        mouseX: 0,
        mouseY: 0,
      });
      dragDisp.setIsDragging(true);
      dragDisp.setDraggedItem(fromToolbarType);
      dragDisp.setDragSource("toolbar");
      return;
    }

    if (!node || !contentRef.current) return;

    if (!dragState.dynamicModeNodeId) {
      const dynamicParent = getDynamicParentNode(node);
      if (dynamicParent && !node.isDynamic) {
        node = dynamicParent;
      }
    }

    const element = document.querySelector(`[data-node-id="${node.id}"]`);
    if (!element) return;

    const elementRect = element.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

    if (node.inViewport) {
      // Rest of your existing viewport logic...
      dragDisp.setDragSource("viewport");
      const oldIndex = findIndexWithinParent(
        nodeState.nodes,
        node.id,
        node.parentId
      );

      const element = document.querySelector(
        `[data-node-id="${node.id}"]`
      ) as HTMLElement;
      const style = element.style;
      const isWidthPercent = style.width?.includes("%");
      const isHeightPercent = style.height?.includes("%");
      const isWidthAuto = style.width === "auto";
      const isHeightAuto = style.height === "auto";
      const isFillMode = style.flex === "1 0 0px";

      if (
        isWidthPercent ||
        isHeightPercent ||
        isWidthAuto ||
        isHeightAuto ||
        isFillMode
      ) {
        dragDisp.setOriginalWidthHeight(
          element.style.width,
          element.style.height,
          isFillMode
        );
      }

      let finalWidth = node.style.width;
      let finalHeight = node.style.height;

      if (isFillMode) {
        const rect = element.getBoundingClientRect();
        finalWidth = `${Math.round(rect.width / transform.scale)}px`;
        finalHeight = `${Math.round(rect.height / transform.scale)}px`;

        setNodeStyle(
          {
            width: finalWidth,
            height: finalHeight,
            flex: "0 0 auto",
          },
          [node.id]
        );
      } else if ((isWidthPercent || isWidthAuto) && element) {
        let widthInPx;

        if (isWidthPercent) {
          widthInPx = convertToNewUnit(
            parseFloat(style.width),
            "%",
            "px",
            "width",
            element
          );
        } else if (isWidthAuto) {
          widthInPx = convertToNewUnit(
            parseFloat(style.width),
            "auto",
            "px",
            "width",
            element
          );
        }
        finalWidth = `${widthInPx}px`;
        setNodeStyle(
          {
            width: finalWidth,
          },
          [node.id]
        );
      }

      if ((isHeightPercent || isHeightAuto) && element) {
        let heightInPx;

        if (isHeightPercent) {
          heightInPx = convertToNewUnit(
            parseFloat(style.height),
            "%",
            "px",
            "height",
            element
          );
        } else if (isHeightAuto) {
          heightInPx = convertToNewUnit(
            parseFloat(style.height),
            "auto",
            "px",
            "height",
            element
          );
        }
        finalHeight = `${heightInPx}px`;
        setNodeStyle(
          {
            height: finalHeight,
          },
          [node.id]
        );
      }

      const placeholderNode: Node = {
        id: nanoid(),
        type: "placeholder",
        style: {
          width: isFillMode
            ? finalWidth
            : isWidthAuto
            ? convertToNewUnit(
                parseFloat(style.width),
                "auto",
                "px",
                "width",
                element
              )
            : isWidthPercent
            ? convertToNewUnit(
                parseFloat(style.width),
                "%",
                "px",
                "width",
                element
              )
            : node.style.width,
          height: isFillMode
            ? finalHeight
            : isHeightAuto
            ? convertToNewUnit(
                parseFloat(style.height),
                "auto",
                "px",
                "height",
                element
              )
            : isHeightPercent
            ? convertToNewUnit(
                parseFloat(style.height),
                "%",
                "px",
                "height",
                element
              )
            : node.style.height,
          backgroundColor: "rgba(0,153,255,0.8)",
          position: "relative",
          flex: "0 0 auto",
          rotate: node.style.rotate,
          borderRadius: node.style.borderRadius,
        },
        inViewport: true,
        parentId: node.parentId,
      };

      nodeDisp.insertAtIndex(placeholderNode, oldIndex, node.parentId);

      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      dragDisp.setDraggedNode(node, {
        x:
          (elementRect.left - contentRect.left - transform.x) / transform.scale,
        y: (elementRect.top - contentRect.top - transform.y) / transform.scale,
        mouseX: mouseOffsetX,
        mouseY: mouseOffsetY,
      });
    } else {
      dragDisp.setDragSource("canvas");

      const currentLeft = parseFloat(node.style.left as string) || 0;
      const currentTop = parseFloat(node.style.top as string) || 0;

      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      setNodeStyle(
        {
          position: "absolute",
          left: undefined,
          top: undefined,
        },
        [node.id]
      );

      dragDisp.setIsDragging(true);

      dragDisp.setDraggedNode(node, {
        x: currentLeft,
        y: currentTop,
        mouseX: mouseOffsetX,
        mouseY: mouseOffsetY,
      });
    }

    dragDisp.setDraggedItem(null);
  };
};
