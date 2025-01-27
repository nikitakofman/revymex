import { useEffect, useState } from "react";
import { useBuilder } from "../builderState";

export function useSelectedNodesStyles<T extends Record<string, any>>(
  properties: (keyof T)[]
) {
  const { dragState } = useBuilder();
  const [styles, setStyles] = useState<Partial<T> | null>(null);

  useEffect(() => {
    if (!dragState.selectedIds.length) {
      setStyles(null);
      return;
    }

    const selectedStyles = dragState.selectedIds
      .map((id) => {
        const element = document.querySelector(`[data-node-id="${id}"]`);
        if (!element) return null;

        const computedStyle = window.getComputedStyle(element);
        const result: Record<string, string> = {};

        properties.forEach((prop) => {
          const cssProperty = prop
            .toString()
            .replace(/([A-Z])/g, "-$1")
            .toLowerCase();
          let value = computedStyle.getPropertyValue(cssProperty).trim();
          // Handle special cases
          if (cssProperty === "gap") {
            value = value.split(" ")[0]; // Take first value if it's a shorthand
          }
          result[prop.toString()] = value;
        });

        return result;
      })
      .filter(Boolean);

    if (!selectedStyles.length) {
      setStyles(null);
      return;
    }

    const result: Record<string, string> = {};
    properties.forEach((prop) => {
      const values = new Set(
        selectedStyles.map((style) => style[prop.toString()])
      );
      result[prop.toString()] =
        values.size === 1 ? selectedStyles[0][prop.toString()] : "mixed";
    });

    setStyles(result as Partial<T>);
  }, [dragState.selectedIds, properties]);

  return styles;
}
