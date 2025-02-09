import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Pipette } from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";

type ColorMode = "hex" | "rgb" | "hsl" | "hsv";

interface ColorPickerProps {
  name?: string;
  label?: string;
  position?: "left" | "bottom";
  value?: string;
  onChange?: (color: string) => void;
  usePseudoElement?: boolean;
  pseudoElement?: "::before" | "::after";
}

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) => {
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

const rgbToHsl = ({ r, g, b }: { r: number; g: number; b: number }) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
};

const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }) => {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

const rgbToHsv = ({ r, g, b }: { r: number; g: number; b: number }) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    v: v * 100,
  };
};

const hsvToRgb = ({ h, s, v }: { h: number; s: number; v: number }) => {
  h /= 360;
  s /= 100;
  v /= 100;

  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    default:
      r = 0;
      g = 0;
      b = 0;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

const ColorPreview = ({
  color,
  size = 16,
}: {
  color: string;
  size?: number;
}) => (
  <div
    className="relative rounded-xl overflow-hidden"
    style={{ width: size, height: size }}
  >
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
      <div className="bg-gray-200" />
      <div className="bg-white" />
      <div className="bg-white" />
      <div className="bg-gray-200" />
    </div>
    <div className="absolute inset-0" style={{ backgroundColor: color }} />
  </div>
);

export const ColorPicker = ({
  name,
  label,
  position = "left",
  value: externalValue,
  onChange: externalOnChange,
  usePseudoElement = false,
  pseudoElement = "::after",
}: ColorPickerProps) => {
  const { setNodeStyle, startRecording, stopRecording } = useBuilder();
  const [isOpen, setIsOpen] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("hex");
  const [hsv, setHsv] = useState({ h: 0, s: 100, v: 100 });
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const [isDraggingColor, setIsDraggingColor] = useState(false);

  const sessionIdRef = useRef<string | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const computedStyle = useComputedStyle({
    property: name || "",
    usePseudoElement,
    pseudoElement,
    isColor: true,
    defaultValue: "#000000",
  });

  const currentValue =
    externalValue ||
    (computedStyle.mixed ? "#000000" : (computedStyle.value as string));

  useEffect(() => {
    const rgb = hexToRgb(currentValue);
    setHsv(rgbToHsv(rgb));
  }, [currentValue]);

  const handleColorChange = (color: string) => {
    if (externalOnChange) {
      externalOnChange(color);
    } else if (name) {
      setNodeStyle({ [name]: color }, undefined, true);
    }
  };

  const handleSaturationMouseDown = (e: React.MouseEvent) => {
    setIsDraggingColor(true);
    sessionIdRef.current = startRecording();
    handleSaturationMove(e);
  };

  const handleHueMouseDown = (e: React.MouseEvent) => {
    setIsDraggingHue(true);
    sessionIdRef.current = startRecording();
    handleHueMove(e);
  };

  const handleSaturationMove = (e: MouseEvent | React.MouseEvent) => {
    if (!saturationRef.current) return;

    const rect = saturationRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const newHsv = {
      ...hsv,
      s: x * 100,
      v: 100 - y * 100,
    };

    setHsv(newHsv);
    const rgb = hsvToRgb(newHsv);
    handleColorChange(rgbToHex(rgb));
  };

  const handleHueMove = (e: MouseEvent | React.MouseEvent) => {
    if (!hueRef.current) return;

    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const newHsv = {
      ...hsv,
      h: x * 360,
    };

    setHsv(newHsv);
    const rgb = hsvToRgb(newHsv);
    handleColorChange(rgbToHex(rgb));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isDraggingColor) handleSaturationMove(e);
      if (isDraggingHue) handleHueMove(e);
    };

    const handleMouseUp = () => {
      stopRecording(sessionIdRef.current!);
      setIsDraggingColor(false);
      setIsDraggingHue(false);
    };

    if (isDraggingColor || isDraggingHue) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingColor, isDraggingHue]);

  const currentRgb = hsvToRgb(hsv);
  const currentHsl = rgbToHsl(currentRgb);

  return (
    <div
      className="relative"
      ref={pickerRef}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex tabular-nums items-center gap-2 justify-between">
        {label && (
          <span className="text-xs text-[var(--text-secondary)] w-12">
            {label}
          </span>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 h-7 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors"
        >
          <ColorPreview color={currentValue} />
          <span>{currentValue.toUpperCase()}</span>
          <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 p-3 w-64"
          style={{
            left:
              position === "left" && pickerRef.current
                ? pickerRef.current.getBoundingClientRect().left - 280
                : pickerRef.current?.getBoundingClientRect().left || 0,
            top: pickerRef.current
              ? pickerRef.current.getBoundingClientRect().top -
                (position === "left" ? 0 : 8)
              : 0,
          }}
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Color
            </span>
            <div className="flex items-center gap-2">
              <select
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as ColorMode)}
                className="h-6 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              >
                <option value="hex">HEX</option>
                <option value="rgb">RGB</option>
                <option value="hsl">HSL</option>
                <option value="hsv">HSV</option>
              </select>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={saturationRef}
            className="relative w-full h-40 rounded-lg mb-3 cursor-crosshair"
            style={{
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSaturationMouseDown(e);
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
            <div
              className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full shadow-sm"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
              }}
            />
          </div>

          <div
            ref={hueRef}
            className="relative h-4 rounded-md mb-3 cursor-pointer"
            style={{
              background:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              handleHueMouseDown(e);
            }}
          >
            <div
              className="absolute w-2 h-full -translate-x-1/2 border-2 border-white rounded-sm shadow-sm"
              style={{
                left: `${(hsv.h / 360) * 100}%`,
              }}
            />
          </div>

          <div className="space-y-2">
            {colorMode === "hex" && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentValue.toUpperCase()}
                  onChange={(e) => {
                    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                      handleColorChange(e.target.value);
                    }
                  }}
                  className="flex-1 h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                />
                <button className="h-8 w-8 flex items-center justify-center bg-[var(--control-bg)] border border-[var(--control-border)] rounded">
                  <Pipette className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>
            )}

            {colorMode === "rgb" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-secondary)]">
                    R
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={currentRgb.r}
                    onChange={(e) => {
                      const rgb = { ...currentRgb, r: Number(e.target.value) };
                      const newHsv = rgbToHsv(rgb);
                      setHsv(newHsv);
                      handleColorChange(rgbToHex(rgb));
                    }}
                    className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-secondary)]">
                    G
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={currentRgb.g}
                    onChange={(e) => {
                      const rgb = { ...currentRgb, g: Number(e.target.value) };
                      const newHsv = rgbToHsv(rgb);
                      setHsv(newHsv);
                      handleColorChange(rgbToHex(rgb));
                    }}
                    className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-secondary)]">
                    B
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={currentRgb.b}
                    onChange={(e) => {
                      const rgb = { ...currentRgb, b: Number(e.target.value) };
                      const newHsv = rgbToHsv(rgb);
                      setHsv(newHsv);
                      handleColorChange(rgbToHex(rgb));
                    }}
                    className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                  />
                </div>
              </div>
            )}

            {colorMode === "hsl" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-secondary)]">
                    H
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={Math.round(currentHsl.h)}
                    onChange={(e) => {
                      const hsl = { ...currentHsl, h: Number(e.target.value) };
                      const rgb = hslToRgb(hsl);
                      const newHsv = rgbToHsv(rgb);
                      setHsv(newHsv);
                      handleColorChange(rgbToHex(rgb));
                    }}
                    className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-secondary)]">
                    S
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(currentHsl.s)}
                    onChange={(e) => {
                      const hsl = { ...currentHsl, s: Number(e.target.value) };
                      const rgb = hslToRgb(hsl);
                      const newHsv = rgbToHsv(rgb);
                      setHsv(newHsv);
                      handleColorChange(rgbToHex(rgb));
                    }}
                    className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-secondary)]">
                    L
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(currentHsl.l)}
                    onChange={(e) => {
                      const hsl = { ...currentHsl, l: Number(e.target.value) };
                      const rgb = hslToRgb(hsl);
                      const newHsv = rgbToHsv(rgb);
                      setHsv(newHsv);
                      handleColorChange(rgbToHex(rgb));
                    }}
                    className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                  />
                </div>
              </div>
            )}

            {colorMode === "hsv" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-secondary)]">
                    H
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={Math.round(hsv.h)}
                    onChange={(e) => {
                      const newHsv = { ...hsv, h: Number(e.target.value) };
                      setHsv(newHsv);
                      const rgb = hsvToRgb(newHsv);
                      handleColorChange(rgbToHex(rgb));
                    }}
                    className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-secondary)]">
                    S
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(hsv.s)}
                    onChange={(e) => {
                      const newHsv = { ...hsv, s: Number(e.target.value) };
                      setHsv(newHsv);
                      const rgb = hsvToRgb(newHsv);
                      handleColorChange(rgbToHex(rgb));
                    }}
                    className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-secondary)]">
                    V
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(hsv.v)}
                    onChange={(e) => {
                      const newHsv = { ...hsv, v: Number(e.target.value) };
                      setHsv(newHsv);
                      const rgb = hsvToRgb(newHsv);
                      handleColorChange(rgbToHex(rgb));
                    }}
                    className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
