import React, { useCallback } from "react";
import { ResizableWrapper } from "@/builder/context/resizable";
import { useConnect } from "@/builder/context/hooks/useConnect";
import {
  NodeId,
  useNodeStyle,
  useNodeFlags,
} from "@/builder/context/atoms/node-store";
import { useNodeSelected } from "@/builder/context/atoms/select-store";
import {
  canvasOps,
  useIsEditingText,
  useEditingTextNodeId,
} from "@/builder/context/atoms/canvas-interaction-store";
import { useGetDynamicModeNodeId } from "@/builder/context/atoms/drag-store";
import { dynamicOps } from "@/builder/context/atoms/dynamic-store";

// Default text content when none exists
const DEFAULT_TEXT = '<p class="text-inherit"><span>Text</span></p>';

/**
 * TextElement component that hides its content when in edit mode
 */
const TextElement = ({ nodeId }: { nodeId: NodeId }) => {
  // Get node data
  const nodeStyle = useNodeStyle(nodeId);
  const nodeFlags = useNodeFlags(nodeId);

  // Selection state
  const isNodeSelected = useNodeSelected(nodeId);
  const dynamicModeNodeId = useGetDynamicModeNodeId();

  // Check if this specific element is being edited
  const isEditingText = useIsEditingText();
  const editingNodeId = useEditingTextNodeId();
  const isThisNodeBeingEdited = isEditingText && editingNodeId === nodeId;

  // Get connect props for drag and drop
  const connect = useConnect();
  const connectProps = connect(nodeId);

  // Handle double-click to enter edit mode
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // If in dynamic mode, handle that first
      if (nodeFlags.isDynamic && dynamicModeNodeId === null) {
        dynamicOps.setDynamicModeNodeId(nodeId);
        return;
      }

      // Only start editing if already selected
      if (isNodeSelected) {
        // Tell the canvas which node we're editing using the store
        canvasOps.setEditingTextNodeId(nodeId);
        canvasOps.setIsEditingText(true);
      }
    },
    [nodeId, isNodeSelected, nodeFlags.isDynamic, dynamicModeNodeId]
  );

  // Extract text content from style
  const { text, ...otherStyles } = nodeStyle;

  // Compute style without text property
  const style = {
    position: "relative",
    outline: "none",
    minWidth: "1px",
    minHeight: "1em",
    ...otherStyles,
  };

  return (
    <ResizableWrapper nodeId={nodeId}>
      <div
        data-node-id={nodeId}
        data-node-type="text"
        style={style}
        onDoubleClick={handleDoubleClick}
        onContextMenu={connectProps.onContextMenu}
        onMouseDown={connectProps.onMouseDown}
        onMouseOver={connectProps.onMouseOver}
        onMouseOut={connectProps.onMouseOut}
      >
        {/* HTML content display - hidden when this node is being edited */}
        <div
          className="text-content-display"
          style={{
            width: "100%",
            height: "100%",
            pointerEvents: "none", // Make sure not to interfere with drag
            userSelect: "none",
            WebkitUserSelect: "none",
            // Hide content when this node is being edited
            opacity: isThisNodeBeingEdited ? 0 : 1,
            // Keep the element in the DOM for layout, just make it invisible
            overflowWrap: "break-word",
            visibility: isThisNodeBeingEdited ? "hidden" : "visible",
          }}
          dangerouslySetInnerHTML={{ __html: text || DEFAULT_TEXT }}
        />
      </div>
    </ResizableWrapper>
  );
};

export default TextElement;
