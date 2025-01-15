import { ResizableWrapper } from "@/builder/context/dnd/resizable";
import { useConnect } from "@/builder/context/dnd/useConnect";
import { ElementProps } from "@/builder/types";

export const Frame = ({ children, node }: ElementProps) => {
  const connect = useConnect();

  const style = {
    ...node.style,
  };

  return (
    <ResizableWrapper node={node}>
      <div {...connect(node)} style={style}>
        {children}
      </div>
    </ResizableWrapper>
  );
};
