// ToolPopupTrigger.tsx
import React, { useRef } from "react";
import { Label } from "../_components/ToolbarAtoms";

/**
 * ToolPopupTrigger - A reusable component for toolbar popup triggers
 *
 * @param {Object} props
 * @param {string} props.title - The label text for the tool
 * @param {function} props.onTriggerPopup - Callback function when trigger is clicked
 * @param {function} [props.onMouseDown] - Optional mousedown handler from parent
 * @param {React.ReactNode} props.children - The preview component/icon to display
 * @param {string} [props.className] - Additional classes for the container
 * @param {boolean} [props.noTitle] - Whether to hide the title
 */
export const ToolPopupTrigger = ({
  title,
  onTriggerPopup,
  onMouseDown,
  children,
  className = "",
  noTitle = false,
}) => {
  const triggerRef = useRef(null);

  const handleClick = (e) => {
    if (triggerRef.current) {
      onTriggerPopup(triggerRef.current, e);
    }
  };

  // Ensure we always prevent default to maintain editor selection
  const handleMouseDown = (e) => {
    e.preventDefault(); // Critical line: prevents losing editor focus
    console.log("Preventing default in ToolPopupTrigger");
    if (onMouseDown) onMouseDown(e); // Call parent handler if provided
  };

  return (
    <div
      className={`flex items-center justify-between bg-[var(--bg-default)] rounded-md transition-colors ${className}`}
      onMouseDown={handleMouseDown} // Apply to the entire component
    >
      {!noTitle && (
        <div className="w-full">
          <Label>{title}</Label>
        </div>
      )}

      <div
        ref={triggerRef}
        onClick={handleClick}
        // No need to add onMouseDown here as it's already on the parent
        // and will bubble up through event propagation
        className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-black/5 rounded-md"
      >
        {children}
      </div>
    </div>
  );
};

export default ToolPopupTrigger;
