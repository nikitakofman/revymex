import React from "react";
import { usePreview } from "./preview-context";

// A component to show debug information about state
export const DebugContext: React.FC = () => {
  const {
    nodeTree,
    initialNodeTree,
    currentViewport,
    viewportBreakpoints,
    originalNodes,
  } = usePreview();

  // Format node data to be more readable
  const formatNodeData = (node) => {
    return {
      id: node.id,
      type: node.type,
      isDynamic: node.isDynamic,
      dynamicConnections: node.dynamicConnections,
      styles: {
        backgroundColor: node.style.backgroundColor,
      },
    };
  };

  // Find dynamic nodes in the tree
  const findDynamicNodes = (nodes) => {
    let dynamicNodes = [];

    const traverse = (node) => {
      if (node.isDynamic) {
        dynamicNodes.push(formatNodeData(node));
      }

      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);
    return dynamicNodes;
  };

  const dynamicNodes = findDynamicNodes(nodeTree);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "10px",
        right: "10px",
        backgroundColor: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        fontSize: "12px",
        maxWidth: "400px",
        maxHeight: "300px",
        overflow: "auto",
        zIndex: 9999,
      }}
    >
      <h3>Debug Info</h3>
      <div>
        <strong>Current Viewport:</strong> {currentViewport}px
      </div>
      <div>
        <strong>Breakpoints:</strong>{" "}
        {viewportBreakpoints.map((vp) => vp.width).join(", ")}
      </div>
      <div>
        <strong>Dynamic Nodes:</strong> {dynamicNodes.length}
        <pre style={{ maxHeight: "100px", overflow: "auto" }}>
          {JSON.stringify(dynamicNodes, null, 2)}
        </pre>
      </div>
      <button
        onClick={() => console.log("Node Tree:", nodeTree)}
        style={{ marginRight: "5px", padding: "2px 5px" }}
      >
        Log Node Tree
      </button>
      <button
        onClick={() => console.log("Initial Tree:", initialNodeTree)}
        style={{ padding: "2px 5px" }}
      >
        Log Initial Tree
      </button>
    </div>
  );
};
