import React from "react";
import { ResponsiveNode, Viewport } from "../../types";
import {
  generateResponsiveCSS,
  generateMediaQueryContent,
} from "../../utils/cssUtils";

type ImageNodeProps = {
  node: ResponsiveNode;
  viewportBreakpoints: Viewport[];
  eventHandlers?: Record<string, (e: React.SyntheticEvent) => void>;
};

export const ImageNode: React.FC<ImageNodeProps> = ({
  node,
  viewportBreakpoints,
  eventHandlers = {},
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

      <img
        id={`node-${node.id}`}
        className="node node-image"
        src={src}
        alt=""
        style={
          {
            ...styleProps,
            objectFit: styleProps.objectFit || "cover",
          } as React.CSSProperties
        }
        {...eventHandlers}
      />
    </React.Fragment>
  );
};
