import { ResizableWrapper } from "@/builder/context/resizable";
import { useConnect } from "@/builder/context/hooks/useConnect";
import Image from "next/image";
import React from "react";
import { useDropInfo } from "@/builder/context/atoms/drag-store";
import {
  NodeId,
  useNodeBasics,
  useNodeStyle,
  useNodeFlags,
  useNodeParent,
} from "@/builder/context/atoms/node-store";

interface ExtendedElementProps {
  nodeId: NodeId;
  className?: string;
}

export const ImageElement = ({
  nodeId,
  className = "",
}: ExtendedElementProps) => {
  const connect = useConnect();
  const dropInfo = useDropInfo();

  // Get node data using Jotai hooks
  const nodeBasics = useNodeBasics(nodeId);
  const nodeStyle = useNodeStyle(nodeId);
  const nodeFlags = useNodeFlags(nodeId);
  const parentId = useNodeParent(nodeId);

  const isDropTarget =
    dropInfo?.targetId === nodeId && dropInfo?.position === "inside";

  // Create a node object for ResizableWrapper and other components
  const nodeObject = {
    id: nodeId,
    type: nodeBasics.type,
    style: nodeStyle,
    parentId: parentId,
    // Add any other properties that are needed by components that expect a node object
  };

  const connectProps = connect(nodeId);

  return (
    <ResizableWrapper nodeId={nodeId}>
      <div
        {...connectProps}
        onContextMenu={connectProps.onContextMenu}
        onMouseDown={connectProps.onMouseDown}
        className={`relative ${className}`}
      >
        <Image
          crossOrigin="anonymous"
          width={200}
          height={200}
          style={{
            ...nodeStyle,
            width: "100%",
            height: "100%",
            objectFit: nodeStyle.objectFit || "cover",
            borderRadius: nodeStyle.borderRadius,
            objectPosition: nodeStyle.objectPosition,
            pointerEvents: "none",
          }}
          src={nodeStyle.src || "https://batiment.imag.fr/img/imag.png"}
          alt="Image"
        />

        {/* Drop target overlay */}
        {isDropTarget && (
          <div
            className="absolute inset-0 dropTarget rounded-[inherit] z-10"
            style={{ borderRadius: nodeStyle.borderRadius }}
          />
        )}
      </div>
    </ResizableWrapper>
  );
};
