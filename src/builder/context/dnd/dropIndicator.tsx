interface DropIndicatorProps {
  position: {
    top: number;
    left: number;
    width: string | number;
    height: number;
    position: "absolute";
  } | null;
  type: "before" | "after" | "inside" | null;
}

export const DropIndicator = ({ position, type }: DropIndicatorProps) => {
  if (!position || !type) return null;

  const style = {
    ...position,
    height: type === "inside" ? position.height : 2,
    top:
      type === "before"
        ? position.top
        : type === "after"
        ? position.top + position.height
        : position.top,
  };

  return (
    <div
      className={`pointer-events-none ${
        type === "inside"
          ? "border-2 border-blue-500 bg-blue-500/10"
          : "bg-blue-500"
      }`}
      style={style}
    />
  );
};
