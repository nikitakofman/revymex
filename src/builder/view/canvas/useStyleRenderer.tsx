// useStyleRenderer.js
// A custom hook to register DOM elements with the StyleManager

import { useRef, useEffect } from "react";
import StyleManager from "./style-manager";

/**
 * Custom hook that registers a DOM element with StyleManager for direct style updates
 *
 * @param {string|number} nodeId - The unique identifier for the node
 * @returns {React.RefObject} A ref to attach to the DOM element
 */
const useStyleRenderer = (nodeId) => {
  const nodeRef = useRef(null);

  // Register the node element when it mounts
  useEffect(() => {
    if (nodeRef.current) {
      StyleManager.registerNode(nodeId, nodeRef.current);
    }

    // Clean up when unmounting
    return () => {
      StyleManager.unregisterNode(nodeId);
    };
  }, [nodeId]);

  return nodeRef;
};

export default useStyleRenderer;
