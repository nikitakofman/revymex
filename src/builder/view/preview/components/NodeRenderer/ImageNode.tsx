import React, { useMemo } from "react";
import Image from "next/image";
import { usePreview } from "../../preview-context";
import { findNodeById } from "../../utils/nodeUtils";
import {
  generateResponsiveCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";

type ImageNodeProps = {
  nodeId: string;
};

export const ImageNode: React.FC<ImageNodeProps> = ({ nodeId }) => {
  const { nodeTree, viewportBreakpoints, transformNode } = usePreview();

  // Find this node from the context
  const node = useMemo(
    () => findNodeById(nodeTree, nodeId),
    [nodeTree, nodeId]
  );

  if (!node) return null;

  const { src, text, backgroundImage, backgroundVideo, ...styleProps } =
    node.style;
  const responsiveCSS = generateResponsiveCSS(node, viewportBreakpoints);
  const mediaQueryContent = generateMediaQueryContent(
    node,
    viewportBreakpoints
  );

  // Handle click for dynamic nodes
  const handleClick = () => {
    if (node.isDynamic) {
      transformNode(nodeId, "click");
    }
  };

  return (
    <React.Fragment>
      {responsiveCSS && <style>{responsiveCSS}</style>}
      {mediaQueryContent && <style>{mediaQueryContent}</style>}

      <Image
        id={`node-${nodeId}`}
        data-node-id={nodeId}
        data-node-type={node.type}
        data-is-dynamic={node.isDynamic ? "true" : undefined}
        className={`node node-image ${node.isDynamic ? "node-dynamic" : ""}`}
        src={src}
        width={parseFloat(styleProps.width)}
        height={parseFloat(styleProps.height)}
        alt=""
        style={
          {
            ...styleProps,
            objectFit: styleProps.objectFit || "cover",
            cursor: node.isDynamic ? "pointer" : undefined,
          } as React.CSSProperties
        }
        onClick={node.isDynamic ? handleClick : undefined}
      />
    </React.Fragment>
  );
};
