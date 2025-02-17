import { Node } from "@/builder/reducer/nodeDispatcher";
import { convertToNewUnit } from "@/builder/registry/tools/_components/ToolInput";

interface CalculateDimensionsParams {
  node: Node;
  element: HTMLElement;
  transform: { scale: number };
  setNodeStyle: (
    styles: React.CSSProperties & { src?: string } & { text?: string },
    nodeIds?: (string | number)[],
    sync?: boolean
  ) => void;
}

interface DimensionResult {
  finalWidth: string | number | undefined;
  finalHeight: string | number | undefined;
}

export const calculateAndUpdateDimensions = ({
  node,
  element,
  transform,
  setNodeStyle,
}: CalculateDimensionsParams): DimensionResult => {
  const style = element.style;
  const isWidthPercent = style.width?.includes("%");
  const isHeightPercent = style.height?.includes("%");
  const isWidthAuto = style.width === "auto";
  const isHeightAuto = style.height === "auto";
  const isFillMode = style.flex === "1 0 0px";

  let finalWidth = node.style.width;
  let finalHeight = node.style.height;

  // Handle fill mode
  if (isFillMode) {
    const rect = element.getBoundingClientRect();
    finalWidth = `${Math.round(rect.width / transform.scale)}px`;
    finalHeight = `${Math.round(rect.height / transform.scale)}px`;

    setNodeStyle(
      {
        width: finalWidth,
        height: finalHeight,
        flex: "0 0 auto",
      },
      [node.id]
    );
  } else {
    // Handle width calculations
    if (isWidthPercent || isWidthAuto) {
      const widthInPx = convertToNewUnit(
        parseFloat(style.width),
        isWidthPercent ? "%" : "auto",
        "px",
        "width",
        element
      );
      finalWidth = `${widthInPx}px`;
      setNodeStyle(
        {
          width: finalWidth,
        },
        [node.id]
      );
    }

    // Handle height calculations
    if (isHeightPercent || isHeightAuto) {
      const heightInPx = convertToNewUnit(
        parseFloat(style.height),
        isHeightPercent ? "%" : "auto",
        "px",
        "height",
        element
      );
      finalHeight = `${heightInPx}px`;
      setNodeStyle(
        {
          height: finalHeight,
        },
        [node.id]
      );
    }
  }

  return { finalWidth, finalHeight };
};
