import React, { useState, useRef, useEffect } from "react";
import {
  hexToRgb,
  hsvToRgb,
  rgbToHex,
  rgbToHsv,
} from "../../../tools/_components/ColorPicker/utils";

// A simplified color picker just for the text menu
const SimpleColorPicker = ({ onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hsv, setHsv] = useState({ h: 0, s: 100, v: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeControl, setActiveControl] = useState(null);

  const pickerRef = useRef(null);
  const saturationRef = useRef(null);
  const hueRef = useRef(null);

  const currentRgb = hsvToRgb(hsv);
  const currentHex = rgbToHex(currentRgb);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
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

  // Custom dragging handler that uses window events
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      if (activeControl === "saturation") {
        const rect = saturationRef.current.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(1, (e.clientX - rect.left) / rect.width)
        );
        const y = Math.max(
          0,
          Math.min(1, (e.clientY - rect.top) / rect.height)
        );

        const newHsv = {
          ...hsv,
          s: x * 100,
          v: 100 - y * 100,
        };

        setHsv(newHsv);
        const rgb = hsvToRgb(newHsv);
        onChange(rgbToHex(rgb));
      } else if (activeControl === "hue") {
        const rect = hueRef.current.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(1, (e.clientX - rect.left) / rect.width)
        );

        const newHsv = {
          ...hsv,
          h: x * 360,
        };

        setHsv(newHsv);
        const rgb = hsvToRgb(newHsv);
        onChange(rgbToHex(rgb));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setActiveControl(null);
    };

    if (isDragging) {
      // Use capture phase to ensure we get events first
      window.addEventListener("mousemove", handleMouseMove, { capture: true });
      window.addEventListener("mouseup", handleMouseUp, { capture: true });
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove, {
        capture: true,
      });
      window.removeEventListener("mouseup", handleMouseUp, { capture: true });
    };
  }, [isDragging, activeControl, hsv, onChange]);

  const startDrag = (control) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActiveControl(control);

    // Immediately update position
    if (control === "saturation") {
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
      onChange(rgbToHex(rgb));
    } else if (control === "hue") {
      const rect = hueRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

      const newHsv = {
        ...hsv,
        h: x * 360,
      };

      setHsv(newHsv);
      const rgb = hsvToRgb(newHsv);
      onChange(rgbToHex(rgb));
    }
  };

  // Color preview component
  const ColorPreview = ({ color, size = 16 }) => (
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

  // Predetermined color swatches
  const colorSwatches = [
    "#FF0000",
    "#FF8000",
    "#FFFF00",
    "#80FF00",
    "#00FF00",
    "#00FF80",
    "#00FFFF",
    "#0080FF",
    "#0000FF",
    "#8000FF",
    "#FF00FF",
    "#FF0080",
    "#000000",
    "#808080",
    "#FFFFFF",
  ];

  return (
    <div className="relative" ref={pickerRef}>
      <button
        className="flex items-center justify-center w-5 h-5"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ColorPreview color={currentHex} />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-lg shadow-lg z-50 p-3 w-60"
          style={{ marginTop: "8px" }}
        >
          {/* Saturation/Value area */}
          <div
            ref={saturationRef}
            className="relative w-full h-32 mb-2 cursor-crosshair rounded-md"
            style={{
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            }}
            onMouseDown={startDrag("saturation")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent rounded-md" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black rounded-md" />
            <div
              className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full shadow-sm"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
              }}
            />
          </div>

          {/* Hue slider */}
          <div
            ref={hueRef}
            className="relative h-4 mb-3 rounded-md cursor-pointer"
            style={{
              background:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
            }}
            onMouseDown={startDrag("hue")}
          >
            <div
              className="absolute w-2 h-full -translate-x-1/2 border-2 border-white rounded-sm shadow-sm"
              style={{
                left: `${(hsv.h / 360) * 100}%`,
              }}
            />
          </div>

          {/* Color swatches */}
          <div className="flex flex-wrap gap-1 pt-1">
            {colorSwatches.map((color) => (
              <button
                key={color}
                className="w-5 h-5 rounded-sm border border-[var(--border-light)] cursor-pointer"
                style={{ backgroundColor: color }}
                onClick={() => {
                  const rgb = hexToRgb(color);
                  setHsv(rgbToHsv(rgb));
                  onChange(color);
                }}
              />
            ))}
          </div>

          {/* Current color and hex value */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border border-[var(--border-light)]"
                style={{ backgroundColor: currentHex }}
              />
              <span className="text-xs uppercase">{currentHex}</span>
            </div>
            <button
              className="text-xs px-2 py-1 rounded bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)]"
              onClick={() => setIsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleColorPicker;
