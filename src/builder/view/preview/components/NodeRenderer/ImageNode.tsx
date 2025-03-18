import React from "react";
import { ResponsiveNode, Viewport } from "../../types";
import {
  generateResponsiveCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";
import Image from "next/image";

type ImageNodeProps = {
  node: ResponsiveNode;
  viewportBreakpoints: Viewport[];
};

export const ImageNode: React.FC<ImageNodeProps> = ({
  node,
  viewportBreakpoints,
}) => {
  const { src, text, backgroundImage, backgroundVideo, ...styleProps } =
    node.style;
  const responsiveCSS = generateResponsiveCSS(node, viewportBreakpoints);
  const mediaQueryContent = generateMediaQueryContent(
    node,
    viewportBreakpoints
  );

  return (
    <React.Fragment>
      {responsiveCSS && <style>{responsiveCSS}</style>}
      {mediaQueryContent && <style>{mediaQueryContent}</style>}

      <Image
        id={`node-${node.id}`}
        className="node node-image"
        src={src}
        width={parseFloat(styleProps.width)}
        height={parseFloat(styleProps.height)}
        alt=""
        style={
          {
            ...styleProps,
            objectFit: styleProps.objectFit || "cover",
          } as React.CSSProperties
        }
      />
    </React.Fragment>
  );
};
