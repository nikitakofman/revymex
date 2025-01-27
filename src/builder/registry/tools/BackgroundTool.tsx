import React, {
  useState,
  useRef,
  useEffect,
  CSSProperties,
  useCallback,
} from "react";
import {
  ToolbarContainer,
  ToolbarSection,
  ToolbarSegmentedControl,
} from "./_components/test-ui";
import { ColorPicker } from "./_components/ColorPicker";
import { Plus, Trash2 } from "lucide-react";
import { ToolbarSlider } from "./_components/ToolbarSlider";
import { useBuilder } from "@/builder/context/builderState";
import { rgbToHex } from "@/builder/context/dnd/utils";

interface GradientStop {
  color: string;
  position: number;
  id: string;
}

type BackgroundType = "solid" | "linear" | "radial";

interface GradientStopButtonProps {
  color: string;
  isSelected: boolean;
  position: number;
  onClick: () => void;
  onDrag: (position: number) => void;
}

const GradientStopButton = ({
  color,
  isSelected,
  position,
  onClick,
  onDrag,
}: GradientStopButtonProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  const updatePosition = (clientX: number) => {
    if (!buttonRef.current?.parentElement) return;
    const rect = buttonRef.current.parentElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onDrag(Math.round(x * 100));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        updatePosition(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onDrag]);

  return (
    <div
      ref={buttonRef}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging) onClick();
      }}
      onMouseDown={handleMouseDown}
      className={`absolute -translate-x-1/2 cursor-move transition-shadow
        ${isSelected ? "z-10" : "z-0"}
      `}
      style={{ left: `${position}%`, top: "-4px" }}
    >
      <div
        className={`w-4 h-4 rounded-full border-2 
          ${
            isSelected
              ? "border-[var(--accent)] shadow-lg"
              : "border-white shadow-sm"
          }
        `}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

export const BackgroundTool = () => {
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("solid");
  const [solidColor, setSolidColor] = useState("#FFFFFF");
  const [gradientStops, setGradientStops] = useState<GradientStop[]>([
    { color: "#FFFFFF", position: 0, id: "1" },
    { color: "#000000", position: 100, id: "2" },
  ]);
  const [selectedStopId, setSelectedStopId] = useState(gradientStops[0].id);
  const [gradientAngle, setGradientAngle] = useState(90);
  const [gradientRadius, setGradientRadius] = useState(100);
  const { setNodeStyle, dragState } = useBuilder();

  useEffect(() => {
    const computed = getComputedBackground();
    if (computed && computed.type !== "mixed") {
      if (computed.type === "solid") {
        setBackgroundType("solid");
        setSolidColor(computed.value);
      } else if (computed.type === "linear" || computed.type === "radial") {
        setBackgroundType(computed.type);
      }
    }
  }, [dragState.selectedIds]);

  const getComputedBackground = useCallback(() => {
    if (!dragState.selectedIds.length) return null;

    const computedValues = dragState.selectedIds
      .map((id) => {
        const element = document.querySelector(
          `[data-node-id="${id}"]`
        ) as HTMLElement;
        if (!element) return null;

        const computedStyle = window.getComputedStyle(element);

        let background = computedStyle.backgroundColor;

        if (computedStyle.background.includes("gradient")) {
          background = computedStyle.background;
        }

        if (
          !background ||
          background === "none" ||
          background === "transparent"
        ) {
          return { type: "solid", value: "#FFFFFF" };
        }

        if (background.includes("linear-gradient")) {
          return { type: "linear", value: background };
        } else if (background.includes("radial-gradient")) {
          return { type: "radial", value: background };
        } else {
          return { type: "solid", value: rgbToHex(background) };
        }
      })
      .filter(Boolean);

    if (!computedValues.length) return null;

    const firstValue = computedValues[0];
    const allSameType = computedValues.every(
      (v) => v?.type === firstValue?.type
    );
    const allSameValue = computedValues.every(
      (v) => v?.value === firstValue?.value
    );

    if (!allSameType || !allSameValue) {
      return { type: "mixed", value: "mixed" };
    }

    return firstValue;
  }, [dragState.selectedIds]);

  const updateBackground = (value: string) => {
    setNodeStyle({ background: value }, undefined, true);
  };

  const handleSolidColorChange = (color: string) => {
    setSolidColor(color);
    updateBackground(color);
  };

  const handleStopColorChange = (color: string) => {
    const newStops = gradientStops.map((stop) =>
      stop.id === selectedStopId ? { ...stop, color } : stop
    );
    setGradientStops(newStops);
    updateGradientBackground(newStops);
  };

  const handleStopPositionChange = (position: number, stopId: string) => {
    const newStops = gradientStops
      .map((stop) => (stop.id === stopId ? { ...stop, position } : stop))
      .sort((a, b) => a.position - b.position);
    setGradientStops(newStops);
    updateGradientBackground(newStops);
  };

  const addGradientStop = () => {
    const newStop = {
      color: "#808080",
      position: 50,
      id: Math.random().toString(36).substr(2, 9),
    };
    const newStops = [...gradientStops, newStop].sort(
      (a, b) => a.position - b.position
    );
    setGradientStops(newStops);
    setSelectedStopId(newStop.id);
    updateGradientBackground(newStops);
  };

  const removeGradientStop = () => {
    if (gradientStops.length <= 2) return;
    const newStops = gradientStops.filter((stop) => stop.id !== selectedStopId);
    setGradientStops(newStops);
    setSelectedStopId(newStops[0].id);
    updateGradientBackground(newStops);
  };

  const handleGradientAngleChange = (angle: number) => {
    setGradientAngle(angle);
    updateGradientBackground(gradientStops, angle);
  };

  const handleGradientRadiusChange = (radius: number) => {
    setGradientRadius(radius);
    updateGradientBackground(gradientStops, gradientAngle, radius);
  };

  const updateGradientBackground = (
    stops: GradientStop[],
    angle = gradientAngle,
    radius = gradientRadius
  ) => {
    const gradientStopsString = stops
      .map((stop) => `${stop.color} ${stop.position}%`)
      .join(", ");

    const gradientValue =
      backgroundType === "linear"
        ? `linear-gradient(${angle}deg, ${gradientStopsString})`
        : `radial-gradient(circle at center, ${gradientStopsString})`;

    updateBackground(gradientValue);
  };

  const handleBackgroundTypeChange = (value: BackgroundType) => {
    setBackgroundType(value);
    if (value === "solid") {
      updateBackground(solidColor);
    } else {
      updateGradientBackground(gradientStops);
    }
  };

  const selectedStop = gradientStops.find((stop) => stop.id === selectedStopId);

  const computedBackground = getComputedBackground();
  const isMixed = computedBackground?.type === "mixed";

  return (
    <ToolbarContainer>
      <ToolbarSection title="Background">
        <div className="flex flex-col space-y-4">
          {/* Preview */}
          <div
            className="h-16 w-full rounded-lg border border-[var(--control-border)] relative"
            style={{
              background: isMixed
                ? "var(--control-bg)"
                : backgroundType === "solid"
                ? solidColor
                : backgroundType === "linear"
                ? `linear-gradient(${gradientAngle}deg, ${gradientStops
                    .map((stop) => `${stop.color} ${stop.position}%`)
                    .join(", ")})`
                : `radial-gradient(circle at center, ${gradientStops
                    .map((stop) => `${stop.color} ${stop.position}%`)
                    .join(", ")})`,
            }}
          >
            {isMixed && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-[var(--text-secondary)]">
                  Mixed
                </span>
              </div>
            )}
          </div>
          <ToolbarSegmentedControl
            value={backgroundType}
            size="sm"
            onChange={handleBackgroundTypeChange}
            options={[
              { label: "Solid", value: "solid" },
              { label: "Linear", value: "linear" },
              { label: "Radial", value: "radial" },
            ]}
          />

          {backgroundType === "solid" ? (
            <ColorPicker
              label="Color"
              value={solidColor}
              onChange={handleSolidColorChange}
            />
          ) : (
            <div className="space-y-4">
              {/* Gradient Bar */}
              <div className="relative h-[9.8px] bg-[var(--control-bg)] rounded">
                <div
                  className="absolute inset-x-0 h-full rounded"
                  style={{
                    background: `linear-gradient(to right, ${gradientStops
                      .map((stop) => `${stop.color} ${stop.position}%`)
                      .join(", ")})`,
                  }}
                />
                {gradientStops.map((stop) => (
                  <GradientStopButton
                    key={stop.id}
                    color={stop.color}
                    position={stop.position}
                    isSelected={stop.id === selectedStopId}
                    onClick={() => setSelectedStopId(stop.id)}
                    onDrag={(position) =>
                      handleStopPositionChange(position, stop.id)
                    }
                  />
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={addGradientStop}
                    className="p-1.5 hover:bg-[var(--control-bg-hover)] rounded"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </button>
                  <button
                    onClick={removeGradientStop}
                    className="p-1.5 hover:bg-[var(--control-bg-hover)] rounded"
                    disabled={gradientStops.length <= 2}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </button>
                </div>
                {selectedStop && (
                  <ColorPicker
                    value={selectedStop.color}
                    onChange={handleStopColorChange}
                  />
                )}
              </div>

              {/* Gradient Settings */}
              {backgroundType === "linear" && (
                <ToolbarSlider
                  label="Angle"
                  unit="°"
                  value={gradientAngle}
                  min={0}
                  max={360}
                  onChange={handleGradientAngleChange}
                />
              )}

              {backgroundType === "radial" && (
                <ToolbarSlider
                  label="Size"
                  unit="%"
                  value={gradientRadius}
                  min={0}
                  max={100}
                  onChange={handleGradientRadiusChange}
                />
              )}
            </div>
          )}
        </div>
      </ToolbarSection>
    </ToolbarContainer>
  );
};

export default BackgroundTool;
