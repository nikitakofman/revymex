import { useCallback, useState } from "react";
import { useBuilder } from "../builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Cable } from "lucide-react";

export const ConnectionHandle: React.FC<{
  node: Node;
  transform: { scale: number };
}> = ({ node, transform }) => {
  const { dragState, dragDisp, nodeDisp, nodeState, contentRef } = useBuilder();
  const [isDragging, setIsDragging] = useState(false);
  const [dragEndPoint, setDragEndPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const getAdjustedPosition = useCallback(
    (rect: DOMRect, containerRect: DOMRect) => {
      return {
        x:
          (rect.left - containerRect.left) / transform.scale +
          transform.x / transform.scale,
        y:
          (rect.top - containerRect.top) / transform.scale +
          transform.y / transform.scale,
        width: rect.width / transform.scale,
        height: rect.height / transform.scale,
      };
    },
    [transform]
  );

  const shouldShowHandle = useCallback(() => {
    if (node.id === dragState.dynamicModeNodeId) return true;
    if (node.dynamicParentId === dragState.dynamicModeNodeId) return true;

    const mainNode = nodeState.nodes.find(
      (n) => n.id === dragState.dynamicModeNodeId
    );
    const connections = mainNode?.dynamicConnections || [];

    return connections.some(
      (conn) => conn.sourceId === node.id || conn.targetId === node.id
    );
  }, [node, dragState.dynamicModeNodeId, nodeState.nodes]);

  if (!shouldShowHandle()) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!contentRef.current) return;

      const containerRect = contentRef.current.getBoundingClientRect();
      const mousePos = {
        x: (moveEvent.clientX - containerRect.left) / transform.scale,
        y: (moveEvent.clientY - containerRect.top) / transform.scale,
      };

      setDragEndPoint(mousePos);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      setDragEndPoint(null);

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
              {
                sourceId: node.id,
                targetId,
                type: "click",
              },
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

  if (!contentRef.current) return null;

  const source = document.querySelector(`[data-node-id="${node.id}"]`);
  if (!source) return null;

  const containerRect = contentRef.current.getBoundingClientRect();
  const sourcePos = getAdjustedPosition(
    source.getBoundingClientRect(),
    containerRect
  );

  const startX = sourcePos.x + sourcePos.width;
  const startY = sourcePos.y + sourcePos.height / 2;

  return (
    <>
      <div
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
        }}
        onMouseDown={handleMouseDown}
      >
        <Cable size={12 / transform.scale} />
      </div>
      {isDragging && dragEndPoint && (
        <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-50">
          <g transform={`scale(${transform.scale})`}>
            <path
              d={`M ${startX} ${startY}
                 C ${startX + 50} ${startY}
                   ${dragEndPoint.x - 50} ${dragEndPoint.y}
                   ${dragEndPoint.x} ${dragEndPoint.y}`}
              stroke="#9966FE"
              strokeWidth={2 / transform.scale}
              fill="none"
              strokeDasharray="5,5"
            />
          </g>
        </svg>
      )}
    </>
  );
};
