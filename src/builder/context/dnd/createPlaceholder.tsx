import { Node } from "@/builder/reducer/nodeDispatcher";
import { nanoid } from "nanoid";
import { convertToNewUnit } from "@/builder/context/utils";

interface CreatePlaceholderParams {
  node: Node;
  element: HTMLElement;
  transform: { scale: number; x: number; y: number };
  finalWidth?: string | number | undefined;
  finalHeight?: string | number | undefined;
}

export const createPlaceholder = ({
  node,
  element,
  transform,
  finalWidth,
  finalHeight,
}: CreatePlaceholderParams): Node => {
  const style = element.style;
  const isWidthPercent = style.width?.includes("%");
  const isHeightPercent = style.height?.includes("%");
  const isWidthAuto = style.width === "auto";
  const isHeightAuto = style.height === "auto";
  const isFillMode = style.flex === "1 0 0px";

  // Calculate dimensions if not provided
  let placeholderWidth = finalWidth || node.style.width;
  let placeholderHeight = finalHeight || node.style.height;

  if (!finalWidth) {
    if (isFillMode) {
      const rect = element.getBoundingClientRect();
      placeholderWidth = `${Math.round(rect.width / transform.scale)}px`;
    } else if (isWidthPercent || isWidthAuto) {
      const widthInPx = convertToNewUnit(
        parseFloat(style.width),
        isWidthPercent ? "%" : "auto",
        "px",
        "width",
        element
      );
      placeholderWidth = `${widthInPx}px`;
    }
  }

  if (!finalHeight) {
    if (isFillMode) {
      const rect = element.getBoundingClientRect();
      placeholderHeight = `${Math.round(rect.height / transform.scale)}px`;
    } else if (isHeightPercent || isHeightAuto) {
      const heightInPx = convertToNewUnit(
        parseFloat(style.height),
        isHeightPercent ? "%" : "auto",
        "px",
        "height",
        element
      );
      placeholderHeight = `${heightInPx}px`;
    }
  }

  return {
    id: nanoid(),
    type: "placeholder",
    style: {
      width: placeholderWidth,
      height: placeholderHeight,
      backgroundColor: "rgba(0,153,255,0.8)",
      position: "relative",
      flex: "0 0 auto",
      rotate: node.style.rotate,
      borderRadius: node.style.borderRadius,
    },
    inViewport: true,
    parentId: node.parentId,
  };
};
