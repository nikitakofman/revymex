import React from "react";
import { ResizableWrapper } from "@/builder/context/resizable";
import { useConnect } from "@/builder/context/hooks/useConnect";
import { useGetIsDragging } from "@/builder/context/atoms/drag-store";
import {
  useNodeStyle,
  useGetNodeFlags,
  useGetNodeParent,
} from "@/builder/context/atoms/node-store";
import { useBuilderRefs } from "@/builder/context/builderState";
import { ViewportHeader } from "./ViewportHeader";
import { BackgroundMedia } from "./BackgroundMedia";

export const Frame = ({
  children,
  nodeId,
}: {
  children?: React.ReactNode;
  nodeId: string;
}) => {
  const style = useNodeStyle(nodeId);
  const getNodeFlags = useGetNodeFlags();
  const flags = getNodeFlags(nodeId);
  const getNodeParent = useGetNodeParent();

  const getIsDragging = useGetIsDragging();
  const connect = useConnect();

  // console.log("🔍 Frame re-rendering:", nodeId);

  const { isViewport, isDynamic, isVariant } = flags;

  if (isViewport) {
    return (
      <ResizableWrapper nodeId={nodeId} isDraggable={!isViewport}>
        <div
          className={`relative`}
          style={{
            ...style,
            minHeight: "100vh",
            pointerEvents: "auto",
          }}
          data-node-id={nodeId}
          data-node-type="frame"
          data-viewport="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
          onMouseOver={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <ViewportHeader nodeId={nodeId} />

          <BackgroundMedia style={style} />

          {children}
        </div>
      </ResizableWrapper>
    );
  }

  const connectProps = connect(nodeId);

  return (
    <ResizableWrapper nodeId={nodeId} isDraggable={!isViewport}>
      <div
        data-node-id={nodeId}
        data-node-type="frame"
        data-is-viewport={isViewport ? "true" : "false"}
        data-is-variant={isVariant ? "true" : "false"}
        data-is-dynamic={isDynamic ? "true" : "false"}
        style={{
          ...style,
          cursor: getIsDragging() ? "grabbing" : "auto",
        }}
        onContextMenu={connectProps.onContextMenu}
        onMouseDown={connectProps.onMouseDown}
      >
        <BackgroundMedia style={style} />

        {children}
      </div>
    </ResizableWrapper>
  );
};
