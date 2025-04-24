import { useBuilder } from "@/builder/context/builderState";
import { ToolbarSection } from "./_components/ToolbarAtoms";
import { ToolInput } from "./_components/ToolInput";
import { ToolSelect } from "./_components/ToolSelect";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import PlaceholderToolInput from "./_components/ToolInputPlaceholder";
import { useEffect, useState } from "react";
import { useGetSelectedIds } from "../context/atoms/select-store";

export const PositionTool = () => {
  const { dragState, nodeState, transform } = useBuilder();
  const [realTimePosition, setRealTimePosition] = useState({ x: 0, y: 0 });

  // Replace subscription with imperative getter
  const getSelectedIds = useGetSelectedIds();
  const [viewportNode, setViewportNode] = useState(false);

  // Update viewportNode state when needed
  useEffect(() => {
    // Get the current selection
    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) {
      setViewportNode(false);
      return;
    }

    // Check if the selected node is a viewport
    const isViewport = nodeState.nodes
      .find((n) => n.id === selectedIds[0])
      ?.id.includes("viewport");

    setViewportNode(!!isViewport);
  }, [nodeState.nodes, getSelectedIds]);

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

  const isDragging = dragState.dragPositions && dragState.isDragging;

  // Helper to check if node is absolutely positioned within a frame
  const isAbsoluteInFrame = (nodeId: string) => {
    if (!nodeId) return false;
    const node = nodeState.nodes.find((n) => n.id === nodeId);
    return node?.isAbsoluteInFrame === true && node?.parentId !== null;
  };

  // Check if the currently dragged node is an absolute-in-frame node
  const isDraggingAbsoluteInFrame =
    isDragging &&
    dragState.draggedNode &&
    (dragState.dragSource === "absolute-in-frame" ||
      isAbsoluteInFrame(dragState.draggedNode.node.id));

  // Update real-time position when drag state changes
  useEffect(() => {
    if (isDragging && dragState.draggedNode) {
      const node = dragState.draggedNode.node;

      if (isDraggingAbsoluteInFrame) {
        // For absolute-in-frame nodes, calculate position based on mouse position and offset
        if (
          dragState.lastMouseX !== undefined &&
          dragState.lastMouseY !== undefined
        ) {
          // Get the mouse position
          const mouseX = dragState.lastMouseX;
          const mouseY = dragState.lastMouseY;
          const offset = dragState.draggedNode.offset;

          // Find the parent frame element to get its position
          const parentNode = nodeState.nodes.find(
            (n) => n.id === node.parentId
          );
          if (parentNode) {
            const parentElement = document.querySelector(
              `[data-node-id="${node.parentId}"]`
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
          x: Math.round(dragState.dragPositions.x),
          y: Math.round(dragState.dragPositions.y),
        });
      }
    }
  }, [
    isDragging,
    dragState.dragPositions,
    dragState.lastMouseX,
    dragState.lastMouseY,
    dragState.draggedNode,
    isDraggingAbsoluteInFrame,
    nodeState.nodes,
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
