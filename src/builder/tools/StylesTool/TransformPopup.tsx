import React, { useState, useEffect } from "react";
import { ToolInput } from "../_components/ToolInput";
import { useBuilder, useBuilderDynamic } from "@/builder/context/builderState";
import { useGetSelectedIds } from "@/builder/context/atoms/select-store";

export const TransformPopup = ({ selectedNode, onClose }) => {
  const { setNodeStyle } = useBuilderDynamic();
  const currentSelectedIds = useGetSelectedIds();
  // Transform states
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [perspective, setPerspective] = useState(0);
  const [translateZ, setTranslateZ] = useState(0);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [skewX, setSkewX] = useState(0);
  const [skewY, setSkewY] = useState(0);

  // Parse transform string on component mount
  useEffect(() => {
    const selectedIds = currentSelectedIds();

    if (!selectedIds.length) return;

    // Get the selected node's style
    const element = document.querySelector(
      `[data-node-id="${selectedIds[0]}"]`
    );
    if (!element) return;

    // Get transform style
    const transformStyle = element.style.transform || "";

    // Parse scale
    const scaleMatch = transformStyle.match(
      /scale\(([^,\)]+)(?:,\s*([^)]+))?\)/
    );
    if (scaleMatch) {
      if (scaleMatch[1]) {
        setScaleX(parseFloat(scaleMatch[1]));
        // If only one value is provided, scaleY = scaleX
        setScaleY(
          scaleMatch[2] ? parseFloat(scaleMatch[2]) : parseFloat(scaleMatch[1])
        );
      }
    }

    // Parse perspective
    const perspectiveMatch = transformStyle.match(/perspective\(([^)]+)px\)/);
    if (perspectiveMatch) {
      setPerspective(parseFloat(perspectiveMatch[1]));
    }

    // Parse translateZ
    const translateZMatch = transformStyle.match(/translateZ\(([^)]+)px\)/);
    if (translateZMatch) {
      setTranslateZ(parseFloat(translateZMatch[1]));
    }

    // Parse rotateX
    const rotateXMatch = transformStyle.match(/rotateX\(([^)]+)deg\)/);
    if (rotateXMatch) {
      setRotateX(parseFloat(rotateXMatch[1]));
    }

    // Parse rotateY
    const rotateYMatch = transformStyle.match(/rotateY\(([^)]+)deg\)/);
    if (rotateYMatch) {
      setRotateY(parseFloat(rotateYMatch[1]));
    }

    // Parse skewX
    const skewXMatch = transformStyle.match(/skewX\(([^)]+)deg\)/);
    if (skewXMatch) {
      setSkewX(parseFloat(skewXMatch[1]));
    }

    // Parse skewY
    const skewYMatch = transformStyle.match(/skewY\(([^)]+)deg\)/);
    if (skewYMatch) {
      setSkewY(parseFloat(skewYMatch[1]));
    }
  }, [currentSelectedIds]);

  // Apply transforms
  const applyTransforms = () => {
    let transformValue = "";

    // Only add transforms with non-default values
    if (perspective !== 0) {
      transformValue += `perspective(${perspective}px) `;
    }

    if (translateZ !== 0) {
      transformValue += `translateZ(${translateZ}px) `;
    }

    // Handle scale - combine X and Y if they're the same
    if (scaleX !== 1 || scaleY !== 1) {
      if (scaleX === scaleY) {
        transformValue += `scale(${scaleX}) `;
      } else {
        transformValue += `scale(${scaleX}, ${scaleY}) `;
      }
    }

    if (rotateX !== 0) {
      transformValue += `rotateX(${rotateX}deg) `;
    }

    if (rotateY !== 0) {
      transformValue += `rotateY(${rotateY}deg) `;
    }

    if (skewX !== 0) {
      transformValue += `skewX(${skewX}deg) `;
    }

    if (skewY !== 0) {
      transformValue += `skewY(${skewY}deg) `;
    }

    // Trim trailing space and apply the transform
    transformValue = transformValue.trim();
    setNodeStyle({ transform: transformValue }, undefined, true);
  };

  // Update transforms when any property changes
  useEffect(() => {
    applyTransforms();
  }, [scaleX, scaleY, perspective, translateZ, rotateX, rotateY, skewX, skewY]);

  return (
    <div className="space-y-4 p-1" style={{ height: "380px" }}>
      <ToolInput
        type="number"
        label="Rotate"
        name="rotate"
        unit="deg"
        showSlider
        sliderMin={0}
        sliderMax={360}
        sliderStep={0.1}
      />

      <ToolInput
        type="number"
        label="Scale X"
        name="transform.scaleX"
        min={0}
        step={0.1}
        customValue={scaleX}
        onCustomChange={(value) => setScaleX(parseFloat(value))}
        showSlider
        sliderMin={0}
        sliderMax={3}
        sliderStep={0.1}
      />

      <ToolInput
        type="number"
        label="Scale Y"
        name="transform.scaleY"
        min={0}
        step={0.1}
        customValue={scaleY}
        onCustomChange={(value) => setScaleY(parseFloat(value))}
        showSlider
        sliderMin={0}
        sliderMax={3}
        sliderStep={0.1}
      />

      <ToolInput
        type="number"
        label="Perspective"
        name="transform.perspective"
        min={0}
        customValue={perspective}
        onCustomChange={(value) => setPerspective(parseFloat(value))}
        unit="px"
        showSlider
        sliderMin={0}
        sliderMax={1000}
        sliderStep={10}
      />

      <ToolInput
        type="number"
        label="Translate Z"
        name="transform.translateZ"
        customValue={translateZ}
        onCustomChange={(value) => setTranslateZ(parseFloat(value))}
        unit="px"
        showSlider
        sliderMin={-500}
        sliderMax={500}
        sliderStep={10}
      />

      <ToolInput
        type="number"
        label="Rotate X"
        name="transform.rotateX"
        customValue={rotateX}
        onCustomChange={(value) => setRotateX(parseFloat(value))}
        unit="deg"
        showSlider
        sliderMin={-180}
        sliderMax={180}
        sliderStep={1}
      />

      <ToolInput
        type="number"
        label="Rotate Y"
        name="transform.rotateY"
        customValue={rotateY}
        onCustomChange={(value) => setRotateY(parseFloat(value))}
        unit="deg"
        showSlider
        sliderMin={-180}
        sliderMax={180}
        sliderStep={1}
      />

      <ToolInput
        type="number"
        label="Skew X"
        name="transform.skewX"
        customValue={skewX}
        onCustomChange={(value) => setSkewX(parseFloat(value))}
        unit="deg"
        showSlider
        sliderMin={-89}
        sliderMax={89}
        sliderStep={1}
      />

      <ToolInput
        type="number"
        label="Skew Y"
        name="transform.skewY"
        customValue={skewY}
        onCustomChange={(value) => setSkewY(parseFloat(value))}
        unit="deg"
        showSlider
        sliderMin={-89}
        sliderMax={89}
        sliderStep={1}
      />
    </div>
  );
};

export default TransformPopup;
