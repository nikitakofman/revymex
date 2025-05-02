import { Node } from "@/builder/reducer/nodeDispatcher";
import { nanoid } from "nanoid";
import { convertToNewUnit } from "@/builder/context/utils";
import { parseSkew } from "@/builder/context/utils";
import {
  nodeStore,
  nodeBasicsAtom,
  nodeStyleAtom,
  nodeFlagsAtom,
} from "@/builder/context/atoms/node-store";

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

  // Extract skew values from the node's transform style
  let transformValue = "";

  if (node.style.transform) {
    // Extract skew values
    const skewValues = parseSkew(node.style.transform);

    // Only add skew transformations if they exist
    if (skewValues.skewX !== 0 || skewValues.skewY !== 0) {
      const skewXValue =
        skewValues.skewX !== 0 ? `skewX(${skewValues.skewX}deg) ` : "";
      const skewYValue =
        skewValues.skewY !== 0 ? `skewY(${skewValues.skewY}deg)` : "";
      transformValue = `${skewXValue}${skewYValue}`.trim();
    }
  }

  // Create a placeholder node
  const placeholderId = nanoid();
  const placeholderStyle = {
    width: placeholderWidth,
    height: placeholderHeight,
    backgroundColor: "rgba(0,153,255,0.8)",
    position: "relative",
    flex: "0 0 auto",
    rotate: node.style.rotate,
    borderRadius: node.style.borderRadius,
    transform: transformValue || undefined, // Only add if there are skew values
  };

  // Register the placeholder in the node-store
  nodeStore.set(nodeBasicsAtom(placeholderId), {
    id: placeholderId,
    type: "placeholder",
    customName: "Placeholder",
  });

  nodeStore.set(nodeStyleAtom(placeholderId), placeholderStyle);

  nodeStore.set(nodeFlagsAtom(placeholderId), {
    inViewport: true,
    isLocked: false,
    isAbsoluteInFrame: false,
    isViewport: false,
  });

  console.log(`Created placeholder ${placeholderId} for node ${node.id}`);

  return {
    id: placeholderId,
    type: "placeholder",
    style: placeholderStyle,
    inViewport: true,
    parentId: node.parentId,
  };
};
