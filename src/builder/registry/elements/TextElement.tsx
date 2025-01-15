import { ResizableWrapper } from "@/builder/context/dnd/resizable";
import { useConnect } from "@/builder/context/dnd/useConnect";
import { ElementProps } from "@/builder/types";
import React from "react";

const TextElement = ({ node }: ElementProps) => {
  const connect = useConnect();

  const style = {
    ...node.style,
    fontSize: "30px",
    fontWeight: "bold",
    color: "black",
  };

  return (
    <ResizableWrapper node={node}>
      <div {...connect(node)} style={style}>
        {node.text || "bruh"}
      </div>
    </ResizableWrapper>
  );
};

export default TextElement;
