import { ResizableWrapper } from "@/builder/context/dnd/resizable";
import { useConnect } from "@/builder/context/dnd/useConnect";
import { ElementProps } from "@/builder/types";
import Image from "next/image";
import React from "react";

export const ImageElement = ({ node }: ElementProps) => {
  const connect = useConnect();

  return (
    <ResizableWrapper node={node}>
      <div {...connect(node)}>
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
      </div>
    </ResizableWrapper>
  );
};
