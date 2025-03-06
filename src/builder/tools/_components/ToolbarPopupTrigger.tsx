import React, { useRef } from "react";
import { Label } from "../_components/ToolbarAtoms";

/**
 * ToolPopupTrigger - A reusable component for toolbar popup triggers
 *
 * @param {Object} props
 * @param {string} props.title - The label text for the tool
 * @param {function} props.onTriggerPopup - Callback function when trigger is clicked
 * @param {React.ReactNode} props.children - The preview component/icon to display
 * @param {string} [props.className] - Additional classes for the container
 */
export const ToolPopupTrigger = ({
  title,
  onTriggerPopup,
  children,
  className = "",
}) => {
  const triggerRef = useRef(null);

  const handleClick = (e) => {
    if (triggerRef.current) {
      onTriggerPopup(triggerRef.current, e);
    }
  };

  return (
    <div
      className={`flex items-center  justify-between bg-[var(--bg-default)]  rounded-md transition-colors ${className}`}
    >
      <div className="w-full">
        <Label>{title}</Label>
      </div>
      <div
        ref={triggerRef}
        onClick={handleClick}
        className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-black/5 rounded-md"
      >
        {children}
      </div>
    </div>
  );
};

export default ToolPopupTrigger;
