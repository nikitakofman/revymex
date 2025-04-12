import { useBuilder } from "@/builder/context/builderState";
import { ResizableWrapper } from "@/builder/context/resizable";
import { useConnect } from "@/builder/context/hooks/useConnect";
import { ElementProps } from "@/builder/types";
import Image from "next/image";
import React from "react";

interface ExtendedElementProps extends ElementProps {
  className?: string;
}

export const ImageElement = ({
  node,
  className = "",
}: ExtendedElementProps) => {
  const connect = useConnect();
  const { dragState } = useBuilder();

  const isDropTarget =
    dragState.dropInfo?.targetId === node.id &&
    dragState.dropInfo?.position === "inside";

  return (
    <ResizableWrapper node={node}>
      <div {...connect(node)} className={`relative ${className}`}>
        <Image
          crossOrigin="anonymous"
          width={200}
          height={200}
          style={{
            width: "100%",
            height: "100%",
            objectFit: node.style.objectFit || "cover",
            borderRadius: node.style.borderRadius,
            objectPosition: node.style.objectPosition,
            pointerEvents: "none",
          }}
          src={
            dragState.dynamicState === "hovered"
              ? node.dynamicState?.hovered?.src
              : node.style.src || "https://batiment.imag.fr/img/imag.png"
          }
          alt="Image"
        />

        {/* Drop target overlay */}
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
