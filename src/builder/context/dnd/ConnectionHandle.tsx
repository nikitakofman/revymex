import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useBuilder } from "../builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Cable } from "lucide-react";

export const ConnectionHandle: React.FC<{
  node: Node;
  transform: { x: number; y: number; scale: number };
}> = ({ node, transform }) => {
  const { dragState, nodeDisp, nodeState, contentRef } = useBuilder();
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(
    null
  );

  const cableIconRef = useRef<HTMLDivElement>(null);

  const shouldShowHandle = () => {
    if (node.id === dragState.dynamicModeNodeId) return true;
    if (node.dynamicParentId === dragState.dynamicModeNodeId) return true;
    const mainNode = nodeState.nodes.find(
      (n) => n.id === dragState.dynamicModeNodeId
    );
    const connections = mainNode?.dynamicConnections || [];
    return connections.some(
      (conn) => conn.sourceId === node.id || conn.targetId === node.id
    );
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Get the cable icon's center position in screen coordinates
    if (cableIconRef.current) {
      const rect = cableIconRef.current.getBoundingClientRect();
      setStartPoint({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }

    setIsDragging(true);
    setEndPoint({ x: e.clientX, y: e.clientY });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setEndPoint({ x: moveEvent.clientX, y: moveEvent.clientY });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      setStartPoint(null);
      setEndPoint(null);

      const elementsUnder = document.elementsFromPoint(
        upEvent.clientX,
        upEvent.clientY
      );
      const targetElement = elementsUnder.find((el) =>
        el.hasAttribute("data-node-id")
      );
      if (targetElement) {
        const targetId = targetElement.getAttribute("data-node-id");
        if (targetId && targetId !== node.id) {
          nodeDisp.updateNode(node.id, {
            dynamicConnections: [
              ...(node.dynamicConnections || []),
              { sourceId: node.id, targetId, type: "click" },
            ],
          });
        }
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!shouldShowHandle()) return null;
  if (!contentRef.current) return null;

  return (
    <>
      {/* Cable Icon */}
      <div
        ref={cableIconRef}
        className="absolute bg-purple-500 rounded-full cursor-pointer"
        style={{
          width: `${24 / transform.scale}px`,
          height: `${24 / transform.scale}px`,
          border: `${2 / transform.scale}px solid white`,
          right: `-${36 / transform.scale}px`,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
        }}
        onMouseDown={handleMouseDown}
      >
        <Cable size={12 / transform.scale} />
      </div>

      {/* Connection Line Portal */}
      {isDragging &&
        startPoint &&
        endPoint &&
        createPortal(
          <svg
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          >
            <path
              d={`M ${startPoint.x} ${startPoint.y}
                C ${startPoint.x + 50} ${startPoint.y}
                  ${endPoint.x - 50} ${endPoint.y}
                  ${endPoint.x} ${endPoint.y}`}
              stroke="#9966FE"
              strokeWidth={2}
              fill="none"
              strokeDasharray="5,5"
            />
          </svg>,
          document.body
        )}
    </>
  );
};

export default ConnectionHandle;
