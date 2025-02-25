import { useBuilder } from "@/builder/context/builderState";
import { ResizableWrapper } from "@/builder/context/resizable";
import { useConnect } from "@/builder/context/hooks/useConnect";
import { ElementProps } from "@/builder/types";
import {
  Plus,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Settings,
} from "lucide-react";
import { nanoid } from "nanoid";
import Image from "next/image";

export const Frame = ({ children, node }: ElementProps) => {
  const connect = useConnect();
  const { dragState, nodeDisp, transform } = useBuilder();

  const isDropTarget =
    dragState.dropInfo?.targetId === node.id &&
    dragState.dropInfo?.position === "inside";

  if (node.isViewport) {
    const headerHeight = 36; // Slightly taller header
    const headerMargin = 10;
    const scaledHeaderHeight = headerHeight / transform.scale;
    const scaledHeaderMargin = headerMargin / transform.scale;

    // Get connect handlers but only apply them to the header
    const connectHandlers = connect(node);

    // Choose appropriate icon based on viewport width
    const getDeviceIcon = () => {
      const width = node.viewportWidth;
      if (width <= 480) return <Smartphone size={12 / transform.scale} />;
      if (width <= 768) return <Tablet size={12 / transform.scale} />;
      if (width <= 1024) return <Laptop size={12 / transform.scale} />;
      return <Monitor size={12 / transform.scale} />;
    };

    // Get device type name based on viewport width
    const getDeviceType = () => {
      const width = node.viewportWidth;
      if (width <= 480) return "Mobile";
      if (width <= 768) return "Tablet";
      if (width <= 1024) return "Laptop";
      return "Desktop";
    };

    return (
      <ResizableWrapper node={node}>
        <div
          className={`${
            isDropTarget ? "dropTarget border-4 border-blue-900" : ""
          } relative`}
          style={{
            ...node.style,
            overflow: "visible",
          }}
          data-node-id={node.id}
          data-node-type={node.type}
        >
          {/* Improved header with better styling */}
          <div
            {...connectHandlers}
            className="absolute viewport-header left-0 right-0 bg-[var(--bg-surface)] rounded-t-lg z-[9999] flex items-center "
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              zIndex: 9999,
              top: `-${scaledHeaderHeight + scaledHeaderMargin}px`,
              height: `${scaledHeaderHeight}px`,
              boxShadow: "var(--shadow-md)",
              border: "1px solid var(--border-light)",
              padding: `0 ${8 / transform.scale}px`,
            }}
          >
            <div
              className="flex items-center justify-between w-full"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div
                className="flex items-center gap-1 text-[var(--text-secondary)]"
                style={{
                  padding: `${6 / transform.scale}px ${8 / transform.scale}px`,
                  fontSize: `${10 / transform.scale}px`,
                }}
              >
                {node.viewportName || node.id}
              </div>

              <div className="flex items-center gap-1">
                {/* Settings button */}

                {/* Add viewport button */}
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
                    className="flex items-center  justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg text-white transition-colors duration-150"
                    style={{
                      width: `${24 / transform.scale}px`,
                      height: `${24 / transform.scale}px`,
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
      <div {...connect(node)}>
        {/* Background media wrapper */}
        {(node.style.backgroundImage || node.style.backgroundVideo) && (
          <div
            data-background-wrapper="true"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              overflow: "hidden",
            }}
          >
            {node.style.backgroundVideo ? (
              <video
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "inherit",
                  pointerEvents: "none",
                }}
                src={node.style.backgroundVideo}
                autoPlay
                muted
                loop
                playsInline
              />
            ) : node.style.backgroundImage ? (
              <Image
                fill
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "inherit",
                  pointerEvents: "none",
                }}
                src={node.style.backgroundImage}
                alt=""
              />
            ) : null}
          </div>
        )}
        {isDropTarget && (
          <div
            className="absolute inset-0 dropTarget rounded-[inherit] z-10"
            style={{ borderRadius: node.style.borderRadius }}
          />
        )}
        {children}
      </div>
    </ResizableWrapper>
  );
};
