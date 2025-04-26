import React, { useState, useEffect } from "react";
import { ToolbarSection } from "../_components/ToolbarAtoms";
import { useBuilder } from "@/builder/context/builderState";
import { ToolbarPopup } from "@/builder/view/toolbars/rightToolbar/toolbar-popup";
import { BorderToolPopup } from "./BorderToolPopup";
import { TransformPopup } from "./TransformPopup";
import { ShadowToolPopup } from "./ShadowTool";
import { FilterToolPopup } from "./FilterToolPopup";
import { ToolInput } from "../_components/ToolInput";
import { ToolPopupTrigger } from "../_components/ToolbarPopupTrigger";
import ToolbarButton from "../_components/ToolbarButton";
import {
  useselectedIds,
  useSelectedIds,
} from "@/builder/context/atoms/select-store";

export const StylesTool = () => {
  const { nodeState, setNodeStyle } = useBuilder();

  // Replace subscription with imperative getter
  const selectedIds = useSelectedIds();
  const [selectedNode, setSelectedNode] = useState(null);

  const [activeTool, setActiveTool] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [opacityValue, setOpacityValue] = useState(1);

  // Update the selected node when needed
  useEffect(() => {
    // Get the current selected IDs
    if (selectedIds.length === 0) {
      setSelectedNode(null);
      return;
    }

    const node = nodeState.nodes.find((n) => n.id === selectedIds[0]);
    setSelectedNode(node);

    // Update opacity value from the node's style if available
    if (node && node.style && node.style.opacity) {
      setOpacityValue(parseFloat(node.style.opacity));
    } else {
      setOpacityValue(1); // Default opacity
    }
  }, [nodeState.nodes, selectedIds]);

  // Set up an observer for selection changes
  useEffect(() => {
    const selectionObserver = new MutationObserver(() => {
      // When selection changes, re-run our node finding logic
      if (selectedIds.length === 0) {
        setSelectedNode(null);
        return;
      }

      const node = nodeState.nodes.find((n) => n.id === selectedIds[0]);
      setSelectedNode(node);

      // Update opacity value from the node's style if available
      if (node && node.style && node.style.opacity) {
        setOpacityValue(parseFloat(node.style.opacity));
      } else {
        setOpacityValue(1); // Default opacity
      }
    });

    // Observe changes to data-selected attribute
    selectionObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-selected"],
      subtree: true,
    });

    return () => {
      selectionObserver.disconnect();
    };
  }, [nodeState.nodes, selectedIds]);

  if (!selectedNode) return null;

  const handleTriggerPopup = (tool) => (triggerElement, e) => {
    e.stopPropagation();

    if (triggerElement) {
      const rect = triggerElement.getBoundingClientRect();
      setPopupPosition({ x: rect.right + 10, y: rect.top });
      setActiveTool(tool);
    }
  };

  const handleOpacityChange = (value) => {
    const formattedValue = parseFloat(value.toFixed(1));
    setOpacityValue(formattedValue);

    setNodeStyle(
      {
        opacity: formattedValue.toString(),
      },
      undefined,
      true
    );
  };

  const handleZindexChange = (value) => {
    setNodeStyle(
      {
        zIndex: value,
      },
      undefined,
      true
    );
  };

  return (
    <>
      <ToolbarSection title="Styles">
        <ToolInput
          type="number"
          name="opacity"
          label="Opacity"
          min={0}
          max={1}
          step={0.1}
          value={opacityValue}
          customValue={opacityValue}
          onCustomChange={handleOpacityChange}
          showSlider
          sliderMin={0}
          sliderMax={1}
          sliderStep={0.1}
        />
        <ToolInput
          type="number"
          name="zIndex"
          label="Z Index"
          onCustomChange={handleZindexChange}
          min={0}
          max={9999}
          step={1}
        />
        <div className="flex flex-col gap-4">
          <ToolPopupTrigger
            title="Border"
            onTriggerPopup={handleTriggerPopup("border")}
          >
            <ToolbarButton>Edit</ToolbarButton>
          </ToolPopupTrigger>

          <ToolPopupTrigger
            title="Shadow"
            onTriggerPopup={handleTriggerPopup("shadow")}
          >
            <ToolbarButton>Edit</ToolbarButton>
          </ToolPopupTrigger>

          <ToolPopupTrigger
            title="Filter"
            onTriggerPopup={handleTriggerPopup("filter")}
          >
            <ToolbarButton>Edit</ToolbarButton>
          </ToolPopupTrigger>

          <ToolPopupTrigger
            title="Transform"
            onTriggerPopup={handleTriggerPopup("transform")}
          >
            <ToolbarButton>Edit</ToolbarButton>
          </ToolPopupTrigger>
        </div>
      </ToolbarSection>

      <ToolbarPopup
        isOpen={activeTool === "border"}
        onClose={() => setActiveTool(null)}
        triggerPosition={popupPosition}
        title="Border"
        leftPadding
      >
        <BorderToolPopup
          selectedNode={selectedNode}
          onClose={() => setActiveTool(null)}
        />
      </ToolbarPopup>

      <ToolbarPopup
        isOpen={activeTool === "shadow"}
        onClose={() => setActiveTool(null)}
        triggerPosition={popupPosition}
        leftPadding
        title="Shadow"
      >
        <ShadowToolPopup
          selectedNode={selectedNode}
          onClose={() => setActiveTool(null)}
        />
      </ToolbarPopup>

      <ToolbarPopup
        isOpen={activeTool === "filter"}
        onClose={() => setActiveTool(null)}
        triggerPosition={popupPosition}
        leftPadding
        title="Filter"
      >
        <FilterToolPopup
          selectedNode={selectedNode}
          onClose={() => setActiveTool(null)}
        />
      </ToolbarPopup>

      <ToolbarPopup
        isOpen={activeTool === "transform"}
        onClose={() => setActiveTool(null)}
        triggerPosition={popupPosition}
        title="Transform"
        leftPadding
      >
        <TransformPopup
          selectedNode={selectedNode}
          onClose={() => setActiveTool(null)}
        />
      </ToolbarPopup>
    </>
  );
};

export default StylesTool;
