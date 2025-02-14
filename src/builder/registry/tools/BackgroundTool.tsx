import React, { useState, useRef, useEffect } from "react";
import { ToolbarSection, ToolbarSegmentedControl } from "./_components/test-ui";
import { ColorPicker } from "./_components/ColorPicker";
import { Plus, Trash2 } from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";

type BackgroundType = "solid" | "linear" | "radial";

interface GradientStop {
  color: string;
  position: number;
  id: string;
}

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
  const { startRecording, stopRecording } = useBuilder();

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
    const sessionId = startRecording();

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        updatePosition(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      stopRecording(sessionId);
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
  const { setNodeStyle } = useBuilder();

  const computedBackground = useComputedStyle({
    property: "background",
    parseValue: false,
    defaultValue: "#FFFFFF",
  });

  const [gradientStops, setGradientStops] = useState<GradientStop[]>([
    { color: "#FFFFFF", position: 0, id: "1" },
    { color: "#000000", position: 100, id: "2" },
  ]);
  const [selectedStopId, setSelectedStopId] = useState(gradientStops[0].id);

  const updateBackground = (value: string) => {
    setNodeStyle({ background: value }, undefined, true);
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

  const updateGradientBackground = (stops: GradientStop[]) => {
    const gradientStopsString = stops
      .map((stop) => `${stop.color} ${stop.position}%`)
      .join(", ");

    const gradientValue =
      backgroundType === "linear"
        ? `linear-gradient(90deg, ${gradientStopsString})`
        : `radial-gradient(circle at center, ${gradientStopsString})`;

    updateBackground(gradientValue);
  };

  const handleBackgroundTypeChange = (value: BackgroundType) => {
    setBackgroundType(value);
    if (value === "solid") {
      setNodeStyle({
        background: computedBackground.mixed
          ? "#FFFFFF"
          : (computedBackground.value as string),
      });
    } else {
      updateGradientBackground(gradientStops);
    }
  };

  const selectedStop = gradientStops.find((stop) => stop.id === selectedStopId);

  return (
    <ToolbarSection title="Background">
      <div className="flex flex-col space-y-4">
        <div
          className="h-16 w-full rounded-lg border border-[var(--control-border)] relative"
          style={{
            background: computedBackground.mixed
              ? "var(--control-bg)"
              : backgroundType === "solid"
              ? computedBackground.value
              : backgroundType === "linear"
              ? `linear-gradient(90deg, ${gradientStops
                  .map((stop) => `${stop.color} ${stop.position}%`)
                  .join(", ")})`
              : `radial-gradient(circle at center, ${gradientStops
                  .map((stop) => `${stop.color} ${stop.position}%`)
                  .join(", ")})`,
          }}
        >
          {computedBackground.mixed && (
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
          <ColorPicker label="Color" name="background" />
        ) : (
          <div className="space-y-4">
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
          </div>
        )}
      </div>
    </ToolbarSection>
  );
};
