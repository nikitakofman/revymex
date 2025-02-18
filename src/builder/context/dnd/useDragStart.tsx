import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import { findIndexWithinParent } from "./utils";
import { nanoid } from "nanoid";
import { convertToNewUnit } from "@/builder/registry/tools/_components/ToolInput";
import { parse } from "path";
import { createPlaceholder } from "./createPlaceholder";
import { calculateAndUpdateDimensions } from "./calculateAndUpdateDimensions";

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
    selectedIdsRef,
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

    selectedIdsRef.current = [...dragState.selectedIds];

    const selectedIds = dragState.selectedIds;
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

    // TODO EXTEND TO IF NODE IN VIEWPORT TRUE OR NODE PARENT ID TRUE , CURRETNLY EVERYTHING THAT HAS A PRENT IS BECOME IN VIEWPORT TRUE EVEN IF PARENT IN CANVAS AND NOT IN VIEWPORT

    if (node.inViewport) {
      dragDisp.setDragSource("viewport");
      const oldIndex = findIndexWithinParent(
        nodeState.nodes,
        node.id,
        node.parentId
      );

      const element = document.querySelector(
        `[data-node-id="${node.id}"]`
      ) as HTMLElement;

      // TODO: fill mode is good on drag start but when I drop it goes to 1px

      const { finalWidth, finalHeight } = calculateAndUpdateDimensions({
        node,
        element,
        transform,
        setNodeStyle,
      });

      // Create main placeholder
      const mainPlaceholder = createPlaceholder({
        node,
        element: element as HTMLElement,
        transform,
        finalWidth,
        finalHeight,
      });

      const isFillMode = element.style.flex === "1 0 0px";

      const mainDimensions = {
        width: element.style.width,
        height: element.style.height,
        isFillMode: isFillMode,
        finalWidth,
        finalHeight,
      };

      dragDisp.setNodeDimensions(node.id, mainDimensions);

      const placeholderInfo = {
        mainPlaceholderId: mainPlaceholder.id,
        // Instead of using selectedIds, get nodes in DOM order
        nodeOrder: selectedIds
          .map((id) => {
            const node = nodeState.nodes.find((n) => n.id === id);
            return node
              ? {
                  id: node.id,
                  index: findIndexWithinParent(
                    nodeState.nodes,
                    node.id,
                    node.parentId
                  ),
                }
              : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.index - b.index)
          .map((item) => item.id),
        additionalPlaceholders: [],
      };

      nodeDisp.insertAtIndex(mainPlaceholder, oldIndex, node.parentId);

      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      dragDisp.setDraggedNode(node, {
        x:
          (elementRect.left - contentRect.left - transform.x) / transform.scale,
        y: (elementRect.top - contentRect.top - transform.y) / transform.scale,
        mouseX: mouseOffsetX,
        mouseY: mouseOffsetY,
      });

      if (selectedIds.length > 1) {
        const additional = selectedIds
          .filter((id) => id !== node.id)
          .map((id) => {
            const otherNode = nodeState.nodes.find((n) => n.id === id);
            if (!otherNode) return null;

            const el = document.querySelector(
              `[data-node-id="${id}"]`
            ) as HTMLElement;
            if (!el) return null;

            // Calculate dimensions for additional node

            const {
              finalWidth: additionalWidth,
              finalHeight: additionalHeight,
            } = calculateAndUpdateDimensions({
              node: otherNode,
              element: el,
              transform,
              setNodeStyle,
            });

            dragDisp.setNodeDimensions(otherNode.id, {
              width: el.style.width,
              height: el.style.height,
              isFillMode: el.style.flex === "1 0 0px",
              finalWidth: additionalWidth as string,
              finalHeight: additionalHeight as string,
            });

            const additionalOldIndex = findIndexWithinParent(
              nodeState.nodes,
              otherNode.id,
              otherNode.parentId
            );
            const additionalPlaceholder = createPlaceholder({
              node: otherNode,
              element: el,
              transform,
              finalWidth: additionalWidth,
              finalHeight: additionalHeight,
            });

            // Insert additional placeholder
            nodeDisp.insertAtIndex(
              additionalPlaceholder,
              additionalOldIndex,
              otherNode.parentId
            );

            // Add to placeholder tracking
            placeholderInfo.additionalPlaceholders.push({
              placeholderId: additionalPlaceholder.id,
              nodeId: otherNode.id,
            });

            const rect = el.getBoundingClientRect();
            const contentRect = contentRef.current!.getBoundingClientRect();

            const xPos =
              (rect.left - contentRect.left - transform.x) / transform.scale;
            const yPos =
              (rect.top - contentRect.top - transform.y) / transform.scale;

            const mouseOffsetX = (e.clientX - rect.left) / transform.scale;
            const mouseOffsetY = (e.clientY - rect.top) / transform.scale;

            return {
              node: otherNode,
              offset: {
                x: xPos,
                y: yPos,
                mouseX: mouseOffsetX,
                mouseY: mouseOffsetY,
              },
              placeholderId: additionalPlaceholder.id,
            };
          })
          .filter(Boolean) as Array<{ node: Node; offset: any }>;

        dragDisp.setPlaceholderInfo(placeholderInfo);
        dragDisp.setAdditionalDraggedNodes(additional);
      }
    } else {
      dragDisp.setDragSource("canvas");

      const currentLeft = parseFloat(node.style.left as string) || 0;
      const currentTop = parseFloat(node.style.top as string) || 0;

      const mouseOffsetX1 = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY1 = (e.clientY - elementRect.top) / transform.scale;

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
        mouseX: mouseOffsetX1,
        mouseY: mouseOffsetY1,
      });

      if (selectedIds.length > 1) {
        const additional = selectedIds
          .filter((id) => id !== node.id)
          .map((id) => {
            const otherNode = nodeState.nodes.find((n) => n.id === id);
            if (!otherNode) return null;

            const el = document.querySelector(
              `[data-node-id="${id}"]`
            ) as HTMLElement;
            if (!el) return null;

            const rect = el.getBoundingClientRect();

            const xPos =
              (rect.left - contentRect.left - transform.x) / transform.scale;
            const yPos =
              (rect.top - contentRect.top - transform.y) / transform.scale;

            const mouseOffsetX = (e.clientX - rect.left) / transform.scale;
            const mouseOffsetY = (e.clientY - rect.top) / transform.scale;

            setNodeStyle(
              {
                position: "absolute",
                left: "0px",
                top: "0px",
              },
              [otherNode.id]
            );

            return {
              node: otherNode,
              offset: {
                x: xPos,
                y: yPos,
                mouseX: mouseOffsetX,
                mouseY: mouseOffsetY,
              },
            };
          })
          .filter(Boolean) as Array<{ node: Node; offset: any }>;

        dragDisp.setAdditionalDraggedNodes(additional);
      }
    }

    dragDisp.setDraggedItem(null);
  };
};
