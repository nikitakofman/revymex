import { useBuilderDynamic } from "@/builder/context/builderState";
import { ToolbarSection } from "./_components/ToolbarAtoms";
import { ToolInput } from "./_components/ToolInput";
import { ToolSelect } from "./_components/ToolSelect";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import PlaceholderToolInput from "./_components/ToolInputPlaceholder";
import { useEffect, useState } from "react";
import { useSelectedIds } from "../context/atoms/select-store";
import {
  useIsDragging,
  useDraggedNode,
  useDragSource,
  useDragPositions,
  useLastMousePosition,
} from "../context/atoms/drag-store";
import { useTransform } from "../context/atoms/canvas-interaction-store";
import { useGetNode } from "../context/atoms/node-store";

export const PositionTool = () => {
  const [realTimePosition, setRealTimePosition] = useState({ x: 0, y: 0 });

  // Get state from atoms
  const isDraggingFromStore = useIsDragging();
  const draggedNode = useDraggedNode();
  const dragSource = useDragSource();
  const dragPositions = useDragPositions();
  const lastMousePosition = useLastMousePosition();
  const transform = useTransform();

  // Use reactive hook
  const selectedIds = useSelectedIds();
  const getNode = useGetNode();

  const [viewportNode, setViewportNode] = useState(false);

  // Check if first selected node is a viewport using Jotai
  useEffect(() => {
    if (selectedIds.length === 0) {
      setViewportNode(false);
      return;
    }

    // Check if the selected node is a viewport
    // Here we use Jotai's getNode utility instead of nodeState
    const node = getNode(selectedIds[0]);
    const isViewport =
      node && (node.isViewport || node.id.toString().includes("viewport"));

    setViewportNode(!!isViewport);
  }, [selectedIds, getNode]);

  const positionStyle = useComputedStyle({
    property: "position",
    parseValue: false,
    defaultValue: "static",
  });

  const positionOptions = [
    { label: "Default", value: "static" },
    { label: "Relative", value: "relative" },
    { label: "Absolute", value: "absolute" },
    { label: "Fixed", value: "fixed" },
  ];

  const position = positionStyle.mixed
    ? "static"
    : (positionStyle.value as string);
  const showCoordinates = position === "absolute" || position === "fixed";

  const isDragging = dragPositions && isDraggingFromStore;

  // Helper to check if node is absolutely positioned within a frame using Jotai
  const isAbsoluteInFrame = (nodeId: string) => {
    if (!nodeId) return false;
    const node = getNode(nodeId);
    return node?.isAbsoluteInFrame === true && node?.parentId !== null;
  };

  // Use draggedNode from the store
  const isDraggingAbsoluteInFrame =
    isDragging &&
    draggedNode &&
    (dragSource === "absolute-in-frame" ||
      isAbsoluteInFrame(draggedNode.node.id));

  // Update real-time position when drag state changes
  useEffect(() => {
    if (isDragging && draggedNode) {
      const node = draggedNode.node;

      if (isDraggingAbsoluteInFrame) {
        // For absolute-in-frame nodes, calculate position based on mouse position and offset
        if (
          lastMousePosition.x !== undefined &&
          lastMousePosition.y !== undefined
        ) {
          // Get the mouse position
          const mouseX = lastMousePosition.x;
          const mouseY = lastMousePosition.y;
          const offset = draggedNode.offset;

          // Get parent node info using Jotai
          const parentId = node.parentId;
          if (parentId) {
            const parentElement = document.querySelector(
              `[data-node-id="${parentId}"]`
            );
            if (parentElement) {
              const parentRect = parentElement.getBoundingClientRect();

              // Calculate position relative to parent frame
              const x = Math.round(
                (mouseX - parentRect.left) / transform.scale - offset.mouseX
              );
              const y = Math.round(
                (mouseY - parentRect.top) / transform.scale - offset.mouseY
              );

              setRealTimePosition({ x, y });
            }
          }
        }
      } else {
        setRealTimePosition({
          x: Math.round(dragPositions.x),
          y: Math.round(dragPositions.y),
        });
      }
    }
  }, [
    isDragging,
    dragPositions,
    lastMousePosition,
    draggedNode,
    isDraggingAbsoluteInFrame,
    transform.scale,
  ]);

  return (
    <ToolbarSection title="Position">
      <div className="flex flex-col gap-3">
        {isDragging ? (
          <div className="grid grid-cols-2 gap-3">
            <PlaceholderToolInput value={realTimePosition.x} label="X" />
            <PlaceholderToolInput value={realTimePosition.y} label="Y" />
          </div>
        ) : (
          <>
            {!viewportNode && (
              <ToolSelect
                label="Type"
                name="position"
                options={positionOptions}
              />
            )}
            {showCoordinates && (
              <div className="grid grid-cols-2 gap-3">
                <ToolInput type="number" label="X" name="left" />
                <ToolInput type="number" label="Y" name="top" />
              </div>
            )}
          </>
        )}
      </div>
    </ToolbarSection>
  );
};

export default PositionTool;
