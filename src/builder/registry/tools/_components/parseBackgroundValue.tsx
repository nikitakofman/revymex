export type GradientStop = {
  color: string;
  position: number;
  id: string;
};

export type ParsedBackground = {
  type: "solid" | "linear" | "radial";
  value: string;
  stops?: GradientStop[];
  angle?: number;
};

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

export const parseBackgroundValue = (value: string): ParsedBackground => {
  // Handle linear gradients
  if (value.includes("linear-gradient")) {
    const stops: GradientStop[] = [];
    let angle = 90;

    // Extract angle
    const angleMatch = value.match(/linear-gradient\((\d+)deg/);
    if (angleMatch) {
      angle = parseInt(angleMatch[1], 10);
    }

    // Extract color stops
    const stopsMatch = value.match(/linear-gradient\([^,]+,(.+)\)/);
    if (stopsMatch) {
      const stopsStr = stopsMatch[1];
      const stopParts = stopsStr.split(",").map((s) => s.trim());

      stops.push(
        ...stopParts.map((stop, index) => {
          const [color, position] = stop.split(/\s+/);
          return {
            color: color.startsWith("rgb") ? rgbToHex(color) : color,
            position: position ? parseInt(position, 10) : index * 100,
            id: index.toString(),
          };
        })
      );
    }

    return {
      type: "linear",
      value,
      stops,
      angle,
    };
  }

  // Handle radial gradients
  if (value.includes("radial-gradient")) {
    const stops: GradientStop[] = [];

    // Extract color stops
    const stopsMatch = value.match(/radial-gradient\([^,]+,(.+)\)/);
    if (stopsMatch) {
      const stopsStr = stopsMatch[1];
      const stopParts = stopsStr.split(",").map((s) => s.trim());

      stops.push(
        ...stopParts.map((stop, index) => {
          const [color, position] = stop.split(/\s+/);
          return {
            color: color.startsWith("rgb") ? rgbToHex(color) : color,
            position: position ? parseInt(position, 10) : index * 100,
            id: index.toString(),
          };
        })
      );
    }

    return {
      type: "radial",
      value,
      stops,
    };
  }

  // Handle solid colors
  if (value.startsWith("rgb")) {
    return {
      type: "solid",
      value: rgbToHex(value),
    };
  }

  return {
    type: "solid",
    value,
  };
};
