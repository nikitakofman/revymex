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
  displayMode?: "trigger" | "direct";
  containerClassName?: string;
  contentPadding?: string;
}

// Helper function to convert hex color with alpha to rgba
const hexToRgba = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(2)})`;
};

// Helper function to extract alpha value from rgba/hsla string
const extractAlpha = (colorString: string): number => {
  const match =
    colorString.match(/rgba?\(.*,\s*([0-9.]+)\)/) ||
    colorString.match(/hsla?\(.*,\s*([0-9.]+)%?\)/);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return 1;
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

// Separate ColorPickerContent component that can be used directly or in a popup
export const ColorPickerContent = ({
  colorMode,
  setColorMode,
  hsv,
  setHsv,
  alpha,
  setAlpha,
  currentValue,
  handleColorChange,
  handleSaturationMouseDown,
  handleHueMouseDown,
  handleAlphaMouseDown,
  saturationRef,
  hueRef,
  alphaRef,
  onClose,
  showHeader = true,
  contentPadding = "",
}) => {
  const currentRgb = hsvToRgb(hsv);
  const currentHsl = rgbToHsl(currentRgb);
  const currentHex = rgbToHex(currentRgb);

  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-lg ${
        contentPadding ? contentPadding : "p-0.5"
      } w-full space-y-3`}
    >
      {showHeader && (
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-[var(--text-primary)]">
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
            {onClose && (
              <button
                onClick={onClose}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={saturationRef}
        className="relative w-full h-40 mb-1 cursor-crosshair"
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
        className="relative h-4 rounded-md cursor-pointer"
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

      {/* New Alpha Slider */}
      <div
        ref={alphaRef}
        className="relative h-4 rounded-md cursor-pointer"
        style={{
          background: `linear-gradient(to right, transparent, ${currentHex})`,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleAlphaMouseDown(e);
        }}
      >
        {/* Checkboard pattern for transparency */}
        <div className="absolute inset-0 rounded-md overflow-hidden">
          <div className="w-full h-full grid grid-cols-8 grid-rows-2">
            {Array(16)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className={i % 2 === 0 ? "bg-gray-200" : "bg-white"}
                />
              ))}
          </div>
        </div>
        <div
          className="absolute inset-0 rounded-md"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0), ${currentHex})`,
          }}
        />
        <div
          className="absolute w-2 h-full -translate-x-1/2 border-2 border-white rounded-sm shadow-sm"
          style={{
            left: `${alpha * 100}%`,
          }}
        />
      </div>

      <div className="space-y-2">
        {colorMode === "hex" && (
          <div className="flex gap-2">
            <input
              type="text"
              value={currentHex.toUpperCase()}
              onChange={(e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                  handleColorChange(
                    alpha < 1
                      ? hexToRgba(e.target.value, alpha)
                      : e.target.value
                  );
                }
              }}
              className="flex-1 h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
            />
            <div className="flex items-center h-8 gap-1 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]">
              <span>A</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(alpha * 100)}
                onChange={(e) => {
                  const newAlpha = Math.max(
                    0,
                    Math.min(1, parseInt(e.target.value) / 100)
                  );
                  setAlpha(newAlpha);
                  handleColorChange(hexToRgba(currentHex, newAlpha));
                }}
                className="w-10 bg-transparent border-none text-right focus:outline-none"
              />
              <span>%</span>
            </div>
            <button className="h-8 w-8 flex items-center justify-center bg-[var(--control-bg)] border border-[var(--control-border)] rounded">
              <Pipette className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>
        )}

        {colorMode === "rgb" && (
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">R</label>
              <input
                type="number"
                min={0}
                max={255}
                value={currentRgb.r}
                onChange={(e) => {
                  const rgb = { ...currentRgb, r: Number(e.target.value) };
                  const newHsv = rgbToHsv(rgb);
                  setHsv(newHsv);
                  handleColorChange(
                    alpha < 1
                      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
                      : rgbToHex(rgb)
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">G</label>
              <input
                type="number"
                min={0}
                max={255}
                value={currentRgb.g}
                onChange={(e) => {
                  const rgb = { ...currentRgb, g: Number(e.target.value) };
                  const newHsv = rgbToHsv(rgb);
                  setHsv(newHsv);
                  handleColorChange(
                    alpha < 1
                      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
                      : rgbToHex(rgb)
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">B</label>
              <input
                type="number"
                min={0}
                max={255}
                value={currentRgb.b}
                onChange={(e) => {
                  const rgb = { ...currentRgb, b: Number(e.target.value) };
                  const newHsv = rgbToHsv(rgb);
                  setHsv(newHsv);
                  handleColorChange(
                    alpha < 1
                      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
                      : rgbToHex(rgb)
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">A</label>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(alpha * 100)}
                onChange={(e) => {
                  const newAlpha = Math.max(
                    0,
                    Math.min(1, parseInt(e.target.value) / 100)
                  );
                  setAlpha(newAlpha);
                  handleColorChange(
                    `rgba(${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b}, ${newAlpha})`
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
          </div>
        )}

        {colorMode === "hsl" && (
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">H</label>
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
                  handleColorChange(
                    alpha < 1
                      ? `hsla(${Math.round(hsl.h)}, ${Math.round(
                          hsl.s
                        )}%, ${Math.round(hsl.l)}%, ${alpha})`
                      : rgbToHex(rgb)
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">S</label>
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
                  handleColorChange(
                    alpha < 1
                      ? `hsla(${Math.round(hsl.h)}, ${Math.round(
                          hsl.s
                        )}%, ${Math.round(hsl.l)}%, ${alpha})`
                      : rgbToHex(rgb)
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">L</label>
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
                  handleColorChange(
                    alpha < 1
                      ? `hsla(${Math.round(hsl.h)}, ${Math.round(
                          hsl.s
                        )}%, ${Math.round(hsl.l)}%, ${alpha})`
                      : rgbToHex(rgb)
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">A</label>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(alpha * 100)}
                onChange={(e) => {
                  const newAlpha = Math.max(
                    0,
                    Math.min(1, parseInt(e.target.value) / 100)
                  );
                  setAlpha(newAlpha);
                  handleColorChange(
                    `hsla(${Math.round(currentHsl.h)}, ${Math.round(
                      currentHsl.s
                    )}%, ${Math.round(currentHsl.l)}%, ${newAlpha})`
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
          </div>
        )}

        {colorMode === "hsv" && (
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">H</label>
              <input
                type="number"
                min={0}
                max={360}
                value={Math.round(hsv.h)}
                onChange={(e) => {
                  const newHsv = { ...hsv, h: Number(e.target.value) };
                  setHsv(newHsv);
                  const rgb = hsvToRgb(newHsv);
                  handleColorChange(
                    alpha < 1
                      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
                      : rgbToHex(rgb)
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">S</label>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(hsv.s)}
                onChange={(e) => {
                  const newHsv = { ...hsv, s: Number(e.target.value) };
                  setHsv(newHsv);
                  const rgb = hsvToRgb(newHsv);
                  handleColorChange(
                    alpha < 1
                      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
                      : rgbToHex(rgb)
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">V</label>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(hsv.v)}
                onChange={(e) => {
                  const newHsv = { ...hsv, v: Number(e.target.value) };
                  setHsv(newHsv);
                  const rgb = hsvToRgb(newHsv);
                  handleColorChange(
                    alpha < 1
                      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
                      : rgbToHex(rgb)
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-[var(--text-secondary)]">A</label>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(alpha * 100)}
                onChange={(e) => {
                  const newAlpha = Math.max(
                    0,
                    Math.min(1, parseInt(e.target.value) / 100)
                  );
                  setAlpha(newAlpha);
                  const rgb = hsvToRgb(hsv);
                  handleColorChange(
                    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${newAlpha})`
                  );
                }}
                className="h-8 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] rounded text-[var(--text-primary)]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ColorPicker = ({
  name,
  label,
  position = "left",
  value: externalValue,
  onChange: externalOnChange,
  usePseudoElement = false,
  pseudoElement = "::after",
  displayMode = "trigger", // Default to trigger mode for backward compatibility
  containerClassName = "",
  contentPadding,
}: ColorPickerProps) => {
  // Use the shared popupRef from useBuilder
  const { setNodeStyle, startRecording, stopRecording, popupRef } =
    useBuilder();
  const [isOpen, setIsOpen] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("hex");
  const [hsv, setHsv] = useState({ h: 0, s: 100, v: 100 });
  const [alpha, setAlpha] = useState(1); // New state for alpha channel
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const [isDraggingColor, setIsDraggingColor] = useState(false);
  const [isDraggingAlpha, setIsDraggingAlpha] = useState(false); // New state for alpha dragging

  // Store the position of the popup
  const [popupPosition, setPopupPosition] = useState({ left: 0, top: 0 });

  const sessionIdRef = useRef<string | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null); // New ref for alpha slider

  // Define our own colorPickerPopupRef
  const colorPickerPopupRef = useRef<HTMLDivElement>(null);

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
    // Check if the current value has an alpha component
    if (currentValue.startsWith("rgba") || currentValue.startsWith("hsla")) {
      setAlpha(extractAlpha(currentValue));
    } else {
      setAlpha(1); // Reset to fully opaque for non-alpha colors
    }

    // Extract the RGB regardless of the format
    let rgb;
    if (currentValue.startsWith("rgba")) {
      const parts = currentValue.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (parts) {
        rgb = {
          r: parseInt(parts[1]),
          g: parseInt(parts[2]),
          b: parseInt(parts[3]),
        };
      } else {
        rgb = hexToRgb("#000000");
      }
    } else if (currentValue.startsWith("hsla")) {
      // Extract HSL values and convert to RGB
      const parts = currentValue.match(/hsla\((\d+),\s*(\d+)%,\s*(\d+)%/);
      if (parts) {
        const h = parseInt(parts[1]);
        const s = parseInt(parts[2]);
        const l = parseInt(parts[3]);
        rgb = hslToRgb({ h, s, l });
      } else {
        rgb = hexToRgb("#000000");
      }
    } else {
      // Hex or named color
      rgb = hexToRgb(currentValue);
    }

    setHsv(rgbToHsv(rgb));
  }, [currentValue]);

  // Function to calculate proper popup position
  const calculatePopupPosition = () => {
    if (!pickerRef.current) return;

    // Try to get the active toolbar popup position
    const toolbarPopupElement = popupRef?.current;
    const pickerRect = pickerRef.current.getBoundingClientRect();

    let left = pickerRect.left;
    let top = pickerRect.top - 360; // Default position above the trigger

    // If we have the toolbar popup reference, position relative to it
    if (toolbarPopupElement) {
      const toolbarRect = toolbarPopupElement.getBoundingClientRect();

      // Calculate the position to center the color picker above the toolbar popup
      left = toolbarRect.left + toolbarRect.width / 2 - 132; // 264/2 = 132 (half the width of color picker)
      top = toolbarRect.top - 370; // Position above the toolbar popup with some margin

      // Make sure the popup doesn't go off screen at the top
      if (top < 10) {
        // If there's not enough space at the top, place it below the toolbar popup
        top = toolbarRect.bottom + 10;
      }

      // Make sure the popup doesn't go off screen at the left
      if (left < 10) {
        left = 10;
      }

      // Make sure the popup doesn't go off screen at the right
      const viewportWidth = window.innerWidth;
      if (left + 264 > viewportWidth - 10) {
        left = viewportWidth - 274; // 264 + 10 margin
      }
    }

    setPopupPosition({ left, top });
  };

  // Calculate position when opening popup
  useEffect(() => {
    if (isOpen) {
      calculatePopupPosition();

      // Recalculate on window resize
      window.addEventListener("resize", calculatePopupPosition);
      return () => {
        window.removeEventListener("resize", calculatePopupPosition);
      };
    }
  }, [isOpen]);

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

  const handleAlphaMouseDown = (e: React.MouseEvent) => {
    setIsDraggingAlpha(true);
    sessionIdRef.current = startRecording();
    handleAlphaMove(e);
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

    // Include alpha if it's less than 1
    if (alpha < 1) {
      handleColorChange(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
    } else {
      handleColorChange(rgbToHex(rgb));
    }
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

    // Include alpha if it's less than 1
    if (alpha < 1) {
      handleColorChange(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
    } else {
      handleColorChange(rgbToHex(rgb));
    }
  };

  const handleAlphaMove = (e: MouseEvent | React.MouseEvent) => {
    if (!alphaRef.current) return;

    const rect = alphaRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    setAlpha(x);
    const rgb = hsvToRgb(hsv);

    // Always use rgba when alpha slider has been used
    handleColorChange(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${x})`);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isDraggingColor) handleSaturationMove(e);
      if (isDraggingHue) handleHueMove(e);
      if (isDraggingAlpha) handleAlphaMove(e);
    };

    const handleMouseUp = () => {
      stopRecording(sessionIdRef.current!);
      setIsDraggingColor(false);
      setIsDraggingHue(false);
      setIsDraggingAlpha(false);
    };

    if (isDraggingColor || isDraggingHue || isDraggingAlpha) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingColor, isDraggingHue, isDraggingAlpha]);

  // Click outside handler to close the popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        colorPickerPopupRef.current &&
        !colorPickerPopupRef.current.contains(event.target as Node) &&
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // In direct mode, render the color picker content directly without a trigger button
  if (displayMode === "direct") {
    return (
      <div className={`${containerClassName}`}>
        {label && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-[var(--text-secondary)]">
              {label}
            </span>
            <ColorPreview color={currentValue} />
            <span className="text-xs text-[var(--text-secondary)]">
              {alpha < 1
                ? `rgba(${hsvToRgb(hsv).r}, ${hsvToRgb(hsv).g}, ${
                    hsvToRgb(hsv).b
                  }, ${alpha.toFixed(2)})`
                : currentValue.toUpperCase()}
            </span>
          </div>
        )}

        <ColorPickerContent
          colorMode={colorMode}
          setColorMode={setColorMode}
          hsv={hsv}
          setHsv={setHsv}
          alpha={alpha}
          setAlpha={setAlpha}
          currentValue={currentValue}
          handleColorChange={handleColorChange}
          handleSaturationMouseDown={handleSaturationMouseDown}
          handleHueMouseDown={handleHueMouseDown}
          handleAlphaMouseDown={handleAlphaMouseDown}
          saturationRef={saturationRef}
          hueRef={hueRef}
          alphaRef={alphaRef}
          onClose={null}
          showHeader={false}
          contentPadding={contentPadding}
        />
      </div>
    );
  }

  // In trigger mode, show the trigger button that opens the popup
  return (
    <div
      className={`relative ${containerClassName}`}
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
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(calculatePopupPosition, 0);
            }
          }}
          className="flex items-center gap-2 h-7 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors"
        >
          <ColorPreview color={currentValue} />
          <span>
            {alpha < 1
              ? `${Math.round(alpha * 100)}%`
              : currentValue.toUpperCase()}
          </span>
          <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
        </button>
      </div>

      {isOpen && (
        <div
          ref={colorPickerPopupRef}
          data-is-color-picker="true"
          className="fixed bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 w-64"
          style={{
            left: popupPosition.left,
            top: popupPosition.top,
          }}
        >
          <ColorPickerContent
            colorMode={colorMode}
            setColorMode={setColorMode}
            hsv={hsv}
            setHsv={setHsv}
            alpha={alpha}
            setAlpha={setAlpha}
            currentValue={currentValue}
            handleColorChange={handleColorChange}
            handleSaturationMouseDown={handleSaturationMouseDown}
            handleHueMouseDown={handleHueMouseDown}
            handleAlphaMouseDown={handleAlphaMouseDown}
            saturationRef={saturationRef}
            hueRef={hueRef}
            alphaRef={alphaRef}
            onClose={() => setIsOpen(false)}
            showHeader={true}
            contentPadding={contentPadding}
          />
        </div>
      )}
    </div>
  );
};
