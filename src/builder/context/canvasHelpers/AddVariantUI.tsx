import React, { useEffect, useRef, useState } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Plus } from "lucide-react";
import { Node } from "@/builder/reducer/nodeDispatcher";

interface AddVariantsUIProps {
  node: Node;
  transform: { x: number; y: number; scale: number };
}

export const AddVariantsUI: React.FC<AddVariantsUIProps> = ({
  node,
  transform,
}) => {
  const { dragState, nodeDisp, dragDisp } = useBuilder();

  const [elementSize, setElementSize] = useState({ width: 0, height: 0 });
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Function to get the actual element dimensions
  useEffect(() => {
    const updateElementSize = () => {
      // Find the DOM element for this node
      const element = document.querySelector(`[data-node-id="${node.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        setElementSize({
          width: rect.width / transform.scale,
          height: rect.height / transform.scale,
        });
      }
    };

    updateElementSize();

    // Set up an observer to watch for size changes
    if (typeof ResizeObserver !== "undefined") {
      const element = document.querySelector(`[data-node-id="${node.id}"]`);
      if (element) {
        const observer = new ResizeObserver(updateElementSize);
        observer.observe(element);
        return () => observer.disconnect();
      }
    }
  }, [node.id, transform.scale]);

  // Function to handle adding a variant
  const handleAddVariant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Call the NodeDispatcher method to duplicate the element
    const newVariantId = nodeDisp.duplicateDynamicElement(
      node.id,
      elementSize.width
    );

    // Select the newly created variant node
    if (newVariantId) {
      // Use setTimeout to ensure the node is fully created before selecting
      dragDisp.selectNode(newVariantId);
    }
  };

  // Check if this node should show the variant button
  const shouldShowVariantButton = () => {
    if (!dragState.dynamicModeNodeId) return false;

    // Show for any element in the dynamic editor
    return (
      node.id === dragState.dynamicModeNodeId ||
      node.dynamicParentId === dragState.dynamicModeNodeId
    );
  };

  if (!shouldShowVariantButton()) return null;

  return (
    <div
      ref={elementRef}
      className="absolute pointer-events-auto"
      style={{
        position: "absolute",
        left: `${elementSize.width + 200}px`, // Position to the right of the element with 200px gap
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: node.style.borderRadius,
        zIndex: 2001, // Higher than selection borders
      }}
    >
      <button
        onClick={handleAddVariant}
        className="bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-white shadow-md"
        style={{
          width: `${elementSize.width}px`,
          height: `${elementSize.height}px`,
          border: `${2 / transform.scale}px solid rgba(255, 255, 255, 0.2)`,
          borderRadius:
            typeof node.style.borderRadius === "string"
              ? node.style.borderRadius
              : undefined,
        }}
        title="Add Variant"
      >
        <Plus size={80} />
      </button>
    </div>
  );
};

export default AddVariantsUI;
