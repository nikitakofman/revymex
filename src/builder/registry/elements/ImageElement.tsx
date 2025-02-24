import { useBuilder } from "@/builder/context/builderState";
import { ResizableWrapper } from "@/builder/context/dnd/resizable";
import { useConnect } from "@/builder/context/hooks/useConnect";
import { ElementProps } from "@/builder/types";
import Image from "next/image";
import React from "react";

export const ImageElement = ({ node }: ElementProps) => {
  const connect = useConnect();
  const { dragState } = useBuilder();

  const isDropTarget =
    dragState.dropInfo?.targetId === node.id &&
    dragState.dropInfo?.position === "inside";

  return (
    <ResizableWrapper node={node}>
      <div {...connect(node)} className="relative">
        <Image
          width={200}
          height={200}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: node.style.borderRadius,
            pointerEvents: "none",
          }}
          src={node.style.src || "https://batiment.imag.fr/img/imag.png"}
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
