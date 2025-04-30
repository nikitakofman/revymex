import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useBuilderDynamic } from "@/builder/context/builderState";
import { ColorPicker } from "../_components/ColorPicker";
import { transformNodeToFrame } from "./fill-popup";
import {
  useGetSelectedIds,
  useSelectedIds,
} from "@/builder/context/atoms/select-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";

// Types
export interface GradientStop {
  color: string;
  position: number;
  id: string;
}

interface GradientEditorProps {
  fillType: "linear" | "radial";
  selectedNode: any;
  nodeDisp: any;
  // Removed setNodeStyle prop
}

// Gradient Stop Button Component
const GradientStopButton = ({
  color,
  isSelected,
  position,
  onClick,
  onDrag,
}) => {
  const { startRecording, stopRecording } = useBuilderDynamic();
  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef(null);

  const updatePosition = (clientX) => {
    if (!buttonRef.current?.parentElement) return;
    const rect = buttonRef.current.parentElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onDrag(Math.round(x * 100));
  };

  useEffect(() => {
    const sessionId = startRecording();

    const handleMouseMove = (e) => {
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
  }, [isDragging, onDrag, startRecording, stopRecording]);

  return (
    <div
      ref={buttonRef}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging) onClick();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      className={`absolute -translate-x-1/2 cursor-move transition-shadow ${
        isSelected ? "z-10" : "z-0"
      }`}
      style={{ left: `${position}%`, top: "-4px" }}
    >
      <div
        className={`w-4 h-4 rounded-full border-2 ${
          isSelected
            ? "border-[var(--accent)] shadow-md"
            : "border-white shadow-sm"
        }`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

export const GradientEditor = ({
  fillType,
  selectedNode,
  nodeDisp,
}: GradientEditorProps) => {
  // Use both reactive and imperative hooks for selected IDs
  const selectedIds = useSelectedIds();
  const getSelectedIds = useGetSelectedIds();

  // Initialize gradient stops based on current background if available
  const [gradientStops, setGradientStops] = useState(() => {
    // Parse gradient stops from the current background if available
    const bg = selectedNode?.style.background || "";
    if (bg.includes("gradient")) {
      try {
        // Extract colors and positions from gradient
        const stopsString = bg.match(/gradient\(([^)]+)\)/)?.[1] || "";
        const colorStops = stopsString
          .split(",")
          .filter((part) => part.includes("%"))
          .map((part) => part.trim());

        if (colorStops.length >= 2) {
          return colorStops.map((stop, index) => {
            const [color, positionStr] = stop.split(/\s+(?=\d+%)/);
            const position = parseInt(positionStr);
            return {
              color: color.trim(),
              position: isNaN(position)
                ? (index * 100) / (colorStops.length - 1)
                : position,
              id: `stop-${index}`,
            };
          });
        }
      } catch (e) {
        console.error("Error parsing gradient:", e);
      }
    }

    return [
      { color: "#FFFFFF", position: 0, id: "1" },
      { color: "#000000", position: 100, id: "2" },
    ];
  });

  const [selectedStopId, setSelectedStopId] = useState(
    () => gradientStops[0]?.id
  );

  // Helper function to update style for all selected nodes
  const updateStyleForSelectedNodes = (styles) => {
    const ids = getSelectedIds();
    ids.forEach((id) => {
      updateNodeStyle(id, styles);
    });
  };

  const updateGradientBackground = (stops) => {
    const gradientStopsString = stops
      .map((stop) => `${stop.color} ${stop.position}%`)
      .join(", ");

    const gradientValue =
      fillType === "linear"
        ? `linear-gradient(90deg, ${gradientStopsString})`
        : `radial-gradient(circle at center, ${gradientStopsString})`;

    if (selectedNode.type !== "frame") {
      transformNodeToFrame(
        selectedNode,
        { background: gradientValue },
        nodeDisp
      );
    } else {
      // Use updateNodeStyle instead of setNodeStyle
      updateStyleForSelectedNodes({ background: gradientValue });
    }
  };

  const handleStopColorChange = (color) => {
    const newStops = gradientStops.map((stop) =>
      stop.id === selectedStopId ? { ...stop, color } : stop
    );
    setGradientStops(newStops);
    updateGradientBackground(newStops);
  };

  return (
    <div className="space-y-3">
      {selectedStopId && (
        <ColorPicker
          value={
            gradientStops.find((stop) => stop.id === selectedStopId)?.color ||
            "#000000"
          }
          onChange={handleStopColorChange}
          displayMode="direct"
          containerClassName="w-full"
        />
      )}
      <div className="relative h-2 bg-[var(--control-bg)] rounded-full overflow-hidden">
        <div
          className="absolute inset-0 h-full"
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
            onDrag={(position) => {
              const newStops = gradientStops
                .map((s) => (s.id === stop.id ? { ...s, position } : s))
                .sort((a, b) => a.position - b.position);
              setGradientStops(newStops);
              updateGradientBackground(newStops);
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => {
            const newStop = {
              color: "#808080",
              position: 50,
              id: Math.random().toString(36).substring(2, 9),
            };
            const newStops = [...gradientStops, newStop].sort(
              (a, b) => a.position - b.position
            );
            setGradientStops(newStops);
            setSelectedStopId(newStop.id);
            updateGradientBackground(newStops);
          }}
          className="p-1.5 hover:bg-[var(--control-bg-hover)] rounded-md transition-colors"
        >
          <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        <button
          onClick={() => {
            if (gradientStops.length <= 2) return;
            const newStops = gradientStops.filter(
              (stop) => stop.id !== selectedStopId
            );
            setGradientStops(newStops);
            setSelectedStopId(newStops[0].id);
            updateGradientBackground(newStops);
          }}
          className="p-1.5 hover:bg-[var(--control-bg-hover)] rounded-md transition-colors disabled:opacity-50"
          disabled={gradientStops.length <= 2}
        >
          <Trash2 className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>

        <div className="flex items-center ml-2 gap-2">
          <span className="text-xs text-[var(--text-secondary)]">
            Selected Stop:
          </span>
          <div
            className="w-4 h-4 rounded-full border border-[var(--border-default)]"
            style={{
              backgroundColor:
                gradientStops.find((stop) => stop.id === selectedStopId)
                  ?.color || "#000000",
            }}
          />
        </div>
      </div>
    </div>
  );
};
