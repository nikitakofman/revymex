import { useBuilder } from "@/builder/context/builderState";
import { ResizableWrapper } from "@/builder/context/dnd/resizable";
import { useConnect } from "@/builder/context/dnd/useConnect";
import { ElementProps } from "@/builder/types";
import { Plus } from "lucide-react";
import { nanoid } from "nanoid";

export const Frame = ({ children, node }: ElementProps) => {
  const connect = useConnect();
  const { dragState, nodeDisp } = useBuilder();

  const isDropTarget =
    dragState.dropInfo?.targetId === node.id &&
    dragState.dropInfo?.position === "inside";

  if (node.isViewport) {
    return (
      <ResizableWrapper node={node}>
        <div
          {...connect(node)}
          className={`${
            isDropTarget ? "dropTarget border-4 border-blue-900" : ""
          } relative`}
          style={node.style}
        >
          {/* Viewport header - Inside the draggable container */}
          <div className="absolute -top-8 left-0 right-0 h-8 flex items-center justify-center bg-pink-500 text-white rounded-t-lg z-10">
            <div className="flex items-center gap-2">
              <span>{node.viewportWidth}px</span>
              {node.viewportWidth === 1440 && ( // Only show on desktop viewport
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent dragging when clicking button
                    const width = prompt("Enter viewport width in pixels:");
                    if (width && !isNaN(parseInt(width))) {
                      nodeDisp.addNode(
                        {
                          id: `viewport-${nanoid()}`,
                          type: "frame",
                          isViewport: true,
                          viewportWidth: parseInt(width),
                          style: {
                            width: `${width}px`,
                            height: "1000px",
                            position: "absolute",
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            left: "100px",
                            top: "100px",
                          },
                          inViewport: false,
                          parentId: null,
                          position: { x: 100, y: 100 },
                        },
                        null,
                        null,
                        false
                      );
                    }
                  }}
                  className="ml-2 bg-white/20 hover:bg-white/30 rounded p-1"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Content container */}
          <div className="h-full contents overflow-auto">{children}</div>
        </div>
      </ResizableWrapper>
    );
  }

  return (
    <ResizableWrapper node={node}>
      <div
        {...connect(node)}
        className={`${
          isDropTarget ? "dropTarget border-4 border-blue-900" : ""
        }`}
        style={node.style}
      >
        {children}
      </div>
    </ResizableWrapper>
  );
};
