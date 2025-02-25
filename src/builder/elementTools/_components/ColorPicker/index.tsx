import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Pipette } from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import {
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
} from "./utils";

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
