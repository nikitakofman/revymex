import { useCallback, useEffect, useState, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { debounce } from "lodash";

interface StyleValue {
  value: string | number;
  unit?: string;
  mixed?: boolean;
}

const rgbToHex = (rgb: string): string => {
  const matches = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!matches) return rgb;

  const r = parseInt(matches[1], 10);
  const g = parseInt(matches[2], 10);
  const b = parseInt(matches[3], 10);

  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

const extractColor = (value: string): string => {
  if (value.startsWith("#")) return value;

  if (value.startsWith("rgb")) {
    const rgbPart = value.match(/^rgba?\([^)]+\)/)?.[0];
    if (rgbPart) return rgbToHex(rgbPart);
  }

  const parts = value.split(" ");
  for (const part of parts) {
    if (part.startsWith("rgb")) {
      return rgbToHex(part);
    }
    if (part.startsWith("#")) {
      return part;
    }
  }

  return "#000000";
};

interface UseComputedStyleProps {
  property: string;
  usePseudoElement?: boolean;
  pseudoElement?: string;
  parseValue?: boolean;
  defaultValue?: string | number;
  defaultUnit?: string;
  isColor?: boolean;
}

export function useComputedStyle({
  property,
  usePseudoElement = false,
  pseudoElement = "::after",
  parseValue = false,
  defaultValue = "",
  defaultUnit = "px",
  isColor = false,
}: UseComputedStyleProps) {
  const { dragState, nodeState } = useBuilder();
  const [styleValue, setStyleValue] = useState<StyleValue>({
    value: defaultValue,
    unit: defaultUnit,
  });

  const previousValueRef = useRef<string>();
  const isUpdatingRef = useRef(false);

  const getComputedStyleValue = useCallback(() => {
    if (!dragState.selectedIds.length) return null;

    const computedValues = dragState.selectedIds
      .map((id) => {
        const element = document.querySelector(
          `[data-node-id="${id}"]`
        ) as HTMLElement;
        if (!element) return null;

        const computedStyle = usePseudoElement
          ? window.getComputedStyle(element, pseudoElement)
          : window.getComputedStyle(element);

        let value = computedStyle[property as any];
        if (
          !value ||
          value === "none" ||
          value === "rgba(0, 0, 0, 0)" ||
          value === "transparent"
        )
          return null;

        if (
          isColor ||
          property === "background" ||
          property === "backgroundColor"
        ) {
          value = extractColor(value);
        }

        if (!parseValue) {
          return { value };
        }

        const match = value.match(/^([-\d.]+)(\D+)?$/);
        if (!match) return { value };

        return {
          value: parseFloat(match[1]),
          unit: match[2] || defaultUnit,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (computedValues.length === 0) return null;

    const firstValue = computedValues[0];
    const allSameValue = computedValues.every(
      (v) =>
        v.value === firstValue.value && (!v.unit || v.unit === firstValue.unit)
    );

    if (!allSameValue) {
      return {
        mixed: true,
        unit: computedValues.every((v) => v.unit === firstValue.unit)
          ? firstValue.unit
          : undefined,
      };
    }

    return firstValue;
  }, [
    dragState.selectedIds,
    property,
    usePseudoElement,
    pseudoElement,
    parseValue,
    defaultUnit,
    isColor,
  ]);

  const debouncedUpdate = useCallback(
    debounce((computed: ReturnType<typeof getComputedStyleValue>) => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      try {
        if (!computed) {
          const newValue = JSON.stringify({
            value: defaultValue,
            unit: defaultUnit,
          });
          if (previousValueRef.current !== newValue) {
            previousValueRef.current = newValue;
            setStyleValue({ value: defaultValue, unit: defaultUnit });
          }
          return;
        }

        if ("mixed" in computed && computed.mixed) {
          const newValue = JSON.stringify({
            value: defaultValue,
            unit: computed.unit,
            mixed: true,
          });
          if (previousValueRef.current !== newValue) {
            previousValueRef.current = newValue;
            setStyleValue({
              value: defaultValue,
              unit: computed.unit,
              mixed: true,
            });
          }
        } else {
          const newValue = JSON.stringify({
            value: computed.value,
            unit: computed.unit || defaultUnit,
          });
          if (previousValueRef.current !== newValue) {
            previousValueRef.current = newValue;
            setStyleValue({
              value: computed.value,
              unit: computed.unit || defaultUnit,
              mixed: false,
            });
          }
        }
      } finally {
        isUpdatingRef.current = false;
      }
    }, 100),
    [defaultValue, defaultUnit]
  );

  useEffect(() => {
    const computed = getComputedStyleValue();
    debouncedUpdate(computed);

    return () => {
      debouncedUpdate.cancel();
    };
  }, [
    dragState.selectedIds,
    nodeState.nodes,
    property,
    defaultValue,
    defaultUnit,
    getComputedStyleValue,
    debouncedUpdate,
  ]);

  return styleValue;
}
