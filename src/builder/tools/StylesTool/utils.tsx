// shadowUtils.js - Create this file to help handle shadow transformations

/**
 * Parses a CSS box-shadow value into its components
 * @param {string} shadowValue - The CSS box-shadow string
 * @returns {Object} The parsed shadow components
 */
export function parseShadow(shadowValue) {
  // Default values
  const result = {
    x: 0,
    y: 4,
    blur: 8,
    spread: 0,
    color: "rgba(0, 0, 0, 0.2)",
    inset: false,
  };

  if (!shadowValue || shadowValue === "none") {
    return result;
  }

  // Check for inset
  result.inset = shadowValue.includes("inset");

  // Parse with a regex
  const regex =
    /(?:inset\s+)?(-?\d+(?:\.\d+)?)(px)?\s+(-?\d+(?:\.\d+)?)(px)?\s+(-?\d+(?:\.\d+)?)(px)?\s+(-?\d+(?:\.\d+)?)(px)?\s+(rgba?\([^)]+\)|#[0-9A-Fa-f]+|[a-z]+)/i;
  const match = shadowValue.match(regex);

  if (match) {
    result.x = parseInt(match[1], 10);
    result.y = parseInt(match[3], 10);
    result.blur = parseInt(match[5], 10);
    result.spread = parseInt(match[7], 10);
    result.color = match[9];
  }

  return result;
}

/**
 * Creates a CSS box-shadow string from components
 * @param {Object} components - The shadow components
 * @returns {string} The CSS box-shadow value
 */
export function createShadow(components) {
  const { x, y, blur, spread, color, inset } = components;
  const insetText = inset ? "inset " : "";
  return `${insetText}${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

/**
 * Adds shadow handling to the ToolInput component when using properties like boxShadowX
 * @param {string} propertyName - The CSS property name
 * @param {any} value - The new value to set
 * @param {Function} setNodeStyle - Function to update node styles
 */
export function handleShadowPropertyChange(propertyName, value, setNodeStyle) {
  // Extract current shadow from DOM
  const elements = document.querySelectorAll("[data-node-id]");
  if (!elements.length) return;

  const element = elements[0];
  const style = window.getComputedStyle(element);
  const currentShadow = style.boxShadow;

  // Parse current shadow
  const shadowParts = parseShadow(currentShadow);

  // Update the relevant part
  switch (propertyName) {
    case "boxShadowX":
      shadowParts.x = parseInt(value, 10);
      break;
    case "boxShadowY":
      shadowParts.y = parseInt(value, 10);
      break;
    case "boxShadowBlur":
      shadowParts.blur = parseInt(value, 10);
      break;
    case "boxShadowSpread":
      shadowParts.spread = parseInt(value, 10);
      break;
    case "boxShadowColor":
      shadowParts.color = value;
      break;
    case "boxShadowInset":
      shadowParts.inset = Boolean(value);
      break;
  }

  // Create new shadow string
  const newShadow = createShadow(shadowParts);

  // Apply the new shadow
  setNodeStyle({ boxShadow: newShadow }, undefined, true);
}
