import { useBuilder } from "@/builder/context/builderState";
import { ResizableWrapper } from "@/builder/context/dnd/resizable";
import { useConnect } from "@/builder/context/dnd/useConnect";
import { ElementProps } from "@/builder/types";
import { Plus } from "lucide-react";
import { nanoid } from "nanoid";

export const Frame = ({ children, node }: ElementProps) => {
  const connect = useConnect();
  const { dragState, nodeDisp, transform } = useBuilder();

  const isDropTarget =
    dragState.dropInfo?.targetId === node.id &&
    dragState.dropInfo?.position === "inside";

  if (node.isViewport) {
    const headerHeight = 32;
    const headerMargin = 8;
    const scaledHeaderHeight = headerHeight / transform.scale;
    const scaledHeaderMargin = headerMargin / transform.scale;

    return (
      <ResizableWrapper node={node}>
        <div
          {...connect(node)}
          className={`${
            isDropTarget ? "dropTarget border-4 border-blue-900" : ""
          } relative`}
          style={{
            ...node.style,
            overflow: "visible",
          }}
        >
          <div
            className="absolute left-0 right-0 bg-[var(--grid-line)]  rounded-t-lg z-[9999] flex items-center shadow-lg"
            style={{
              zIndex: 9999,
              top: `-${scaledHeaderHeight + scaledHeaderMargin}px`,
              height: `${scaledHeaderHeight}px`,
              padding: `${4 / transform.scale}px ${10}px`,
            }}
          >
            <div className="flex items-center justify-between w-full">
              {/* Left side with viewport width */}
              <div className="flex font-bold items-center">
                <span style={{ fontSize: `${10 / transform.scale}px` }}>
                  {node.viewportWidth}px
                </span>
              </div>

              {/* Right side with add button */}
              <div className="flex items-center">
                {node.viewportWidth === 1440 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
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
                      nodeDisp.syncViewports();
                    }}
                    className="flex items-center gap-1 bg-white/30 hover:bg-white/40 rounded transition-colors duration-150"
                    style={{
                      padding: `${6 / transform.scale}px ${
                        8 / transform.scale
                      }px`,
                    }}
                  >
                    <Plus size={14 / transform.scale} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {children}
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
      >
        {children}
      </div>
    </ResizableWrapper>
  );
};
