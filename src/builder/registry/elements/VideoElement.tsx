import { useBuilder } from "@/builder/context/builderState";
import { ResizableWrapper } from "@/builder/context/resizable";
import { useConnect } from "@/builder/context/hooks/useConnect";
import { ElementProps } from "@/builder/types";
import React from "react";

export const VideoElement = ({ node }: ElementProps) => {
  const connect = useConnect();
  const { dragState } = useBuilder();

  const isDropTarget =
    dragState.dropInfo?.targetId === node.id &&
    dragState.dropInfo?.position === "inside";

  return (
    <ResizableWrapper node={node}>
      <div {...connect(node)}>
        <video
          style={{
            ...node.style,
            width: "100%",
            height: "100%",
            objectFit: node.style.objectFit || "cover",
            objectPosition: node.style.objectPosition,

            pointerEvents: "none",
          }}
          src={
            dragState.dynamicState === "hovered"
              ? node.dynamicState?.hovered?.src
              : node.style.src ||
                "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
          }
          controls={false}
          autoPlay={true}
          muted
          loop
        />
        {isDropTarget && (
          <div
            className="absolute inset-0 dropTarget rounded-[inherit] z-10"
            style={{ borderRadius: node.style.borderRadius }}
          />
        )}
      </div>
    </ResizableWrapper>
  );
};
