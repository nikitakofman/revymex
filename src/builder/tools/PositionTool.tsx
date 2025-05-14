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
import {
  useGetNode,
  useNodeStyle,
  useNodeParent,
  useGetNodeFlags,
  useGetNodeStyle,
  useGetNodeParent,
} from "../context/atoms/node-store";

export const PositionTool = () => {
  const [realTimePosition, setRealTimePosition] = useState({ x: 0, y: 0 });

  // Get state from atoms
  const isDraggingFromStore = useIsDragging();
  const draggedNode = useDraggedNode();
  const dragSource = useDragSource();
  const dragPositions = useDragPositions();
  const lastMousePosition = useLastMousePosition();
  const transform = useTransform();

  // Use reactive hooks for selected node and its parent
  const selectedIds = useSelectedIds();
  const getNode = useGetNode();
  const getNodeFlags = useGetNodeFlags();
  const getNodeStyle = useGetNodeStyle();
  const getNodeParent = useGetNodeParent();

  // Get the current node's style directly to ensure we have the accurate position value
  const nodeStyle = useNodeStyle(selectedIds[0]);
  const parentId = useNodeParent(selectedIds[0]);

  const [viewportNode, setViewportNode] = useState(false);
  // State to track the actual position value
  const [positionValue, setPositionValue] = useState("static");
  // State to track if the parent is a viewport
  const [isParentViewport, setIsParentViewport] = useState(false);

  // Check if first selected node is a viewport using Jotai
  useEffect(() => {
    if (selectedIds.length === 0) {
      setViewportNode(false);
      setPositionValue("static");
      setIsParentViewport(false);
      return;
    }

    // Check if the selected node is a viewport
    const node = getNode(selectedIds[0]);
    const isViewport =
      node && (node.isViewport || node.id.toString().includes("viewport"));
    setViewportNode(!!isViewport);

    // Get the style for the node
    const style = getNodeStyle(selectedIds[0]);

    // Check if the node is "fake fixed" and set the position value accordingly
    if (style && style["isFakeFixed"] === "true") {
      setPositionValue("fixed");
    } else if (node && node.style && node.style.position) {
      setPositionValue(node.style.position.toString());
    } else {
      setPositionValue("static");
    }

    // Check if parent is a viewport
    if (parentId) {
      const parentFlags = getNodeFlags(parentId);
      setIsParentViewport(
        !!parentFlags?.isViewport ||
          (typeof parentId === "string" && parentId.includes("viewport"))
      );
    } else {
      setIsParentViewport(false);
    }
  }, [selectedIds, getNode, parentId, getNodeFlags, getNodeStyle]);

  // Also update position value when nodeStyle changes
  useEffect(() => {
    if (nodeStyle) {
      if (nodeStyle["isFakeFixed"] === "true") {
        setPositionValue("fixed");
      } else if (nodeStyle.position) {
        setPositionValue(nodeStyle.position.toString());
      }
    }
  }, [nodeStyle]);

  const positionStyle = useComputedStyle({
    property: "position",
    parseValue: false,
    defaultValue: "static",
  });

  // Modify position options to include sticky and disable fixed positioning unless parent is a viewport
  const positionOptions = [
    { label: "Relative", value: "relative" },
    { label: "Absolute", value: "absolute" },
    { label: "Fixed", value: "fixed", disabled: !isParentViewport },
    { label: "Sticky", value: "sticky" }, // Added sticky option
  ];

  // Use our state-tracked position value instead of relying solely on computedStyle
  // This ensures we properly detect "fake fixed" positioning
  const position = positionStyle.mixed ? "static" : positionValue;

  // Show coordinates for absolute or fixed positioning
  const showCoordinates = position === "absolute" || position === "fixed";

  // Show top offset for sticky positioning
  const showStickyOffset = position === "sticky";

  const isDragging = dragPositions && isDraggingFromStore;

  // Helper to check if node is absolutely positioned within a frame using style property
  const isAbsoluteInFrame = (nodeId: string) => {
    if (!nodeId) return false;
    const style = getNodeStyle(nodeId);
    return (
      (style?.isAbsoluteInFrame === "true" ||
        style?.["isFakeFixed"] === "true") &&
      getNodeParent(nodeId) !== null
    );
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
                value={position} // Use our tracked position value
              />
            )}
            {showCoordinates && (
              <div className="grid grid-cols-2 gap-3">
                <ToolInput type="number" label="X" name="left" />
                <ToolInput type="number" label="Y" name="top" />
              </div>
            )}
            {showStickyOffset && (
              <div>
                <ToolInput type="number" label="Top Offset" name="top" />
              </div>
            )}
          </>
        )}
      </div>
    </ToolbarSection>
  );
};

export default PositionTool;
