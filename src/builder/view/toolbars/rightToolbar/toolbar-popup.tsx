import React, {
  useRef,
  useLayoutEffect,
  useState,
  useEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";

/**
 * A reusable popup component for toolbar elements that renders to document.body
 * with proper alignment to the right toolbar
 * @param {Object} props
 * @param {React.ReactNode} props.children - The content to display in the popup
 * @param {boolean} props.isOpen - Whether the popup is open
 * @param {Function} props.onClose - Function to call when closing the popup
 * @param {Object} props.triggerPosition - Position of the trigger element {x, y}
 * @param {string} props.title - Title of the popup
 * @param {boolean} props.leftPadding - Whether to add left padding to the content
 */
export const ToolbarPopup = ({
  children,
  isOpen,
  onClose,
  triggerPosition,
  title,
  leftPadding = false,
}) => {
  const { popupRef } = useBuilder();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasExpandableContent, setHasExpandableContent] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef(null);
  const expandableContentDetectionRef = useRef(null);
  const initialRenderRef = useRef(true);

  // Handle SSR - only mount after component mounts on client
  useLayoutEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Helper function to adjust popup position - defined with useCallback to avoid dependency issues
  const adjustPopupPosition = useCallback(() => {
    if (!popupRef.current || !triggerPosition) return;

    // Get current dimensions
    const popupRect = popupRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // For right toolbar, position the popup to the left of the toolbar
    // This assumes the toolbar is on the right side of the screen with width 262px
    let x = viewportWidth - 262 - popupRect.width;
    let y = triggerPosition.y;

    // Ensure the popup doesn't go beyond the top of the screen
    if (y < 20) {
      y = 20;
    }

    // Get the appropriate content height
    let contentHeight = popupRect.height;
    if (contentRef.current) {
      // Add a small buffer to ensure we don't cut off any content
      contentHeight =
        Math.max(
          contentRef.current.scrollHeight || 0,
          contentRef.current.clientHeight || 0
        ) + 30; // Add 20px buffer
    }

    // Ensure the popup doesn't go beyond the bottom of the screen
    if (y + contentHeight > viewportHeight - 20) {
      y = Math.max(20, viewportHeight - contentHeight - 20);
    }

    // Update position
    setPosition({ x, y });

    // If this is the initial render, make the popup visible after positioning
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      setIsVisible(true);
    }
  }, [triggerPosition]);

  // Check for expandable content like color pickers
  const checkForExpandableContent = useCallback(() => {
    if (!contentRef.current) return;

    // Check for color picker or other expandable content
    const colorPicker = contentRef.current.querySelector(
      '[data-is-color-picker="true"]'
    );
    const expandableContent = contentRef.current.querySelector(
      '[data-is-expandable="true"]'
    );

    const hasExpandableContentNow = !!colorPicker || !!expandableContent;

    // Only update if the state has changed
    if (hasExpandableContentNow !== hasExpandableContent) {
      setHasExpandableContent(hasExpandableContentNow);

      // Adjust position to account for the expandable content
      if (expandableContentDetectionRef.current) {
        clearTimeout(expandableContentDetectionRef.current);
      }

      expandableContentDetectionRef.current = setTimeout(() => {
        adjustPopupPosition();
      }, 50);
    }
  }, [hasExpandableContent, adjustPopupPosition]);

  // Set up mutation observer to detect content changes
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    // Create a mutation observer to watch for DOM changes
    const observer = new MutationObserver(() => {
      checkForExpandableContent();
    });

    // Start observing
    observer.observe(contentRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-is-color-picker", "data-is-expandable"],
    });

    // Initial check
    checkForExpandableContent();

    return () => {
      observer.disconnect();
      if (expandableContentDetectionRef.current) {
        clearTimeout(expandableContentDetectionRef.current);
      }
    };
  }, [isOpen, checkForExpandableContent]);

  // Use ResizeObserver to track content size changes
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      adjustPopupPosition();
    });

    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isOpen, adjustPopupPosition]);

  // Position calculation and adjustment
  useLayoutEffect(() => {
    if (!isOpen || !triggerPosition || !popupRef.current) return;

    // Reset visibility and initial render state when popup opens
    initialRenderRef.current = true;
    setIsVisible(false);

    // Calculate position on next frame to ensure DOM is ready
    requestAnimationFrame(() => {
      adjustPopupPosition();
    });
  }, [isOpen, triggerPosition, adjustPopupPosition]);

  // Handle window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      adjustPopupPosition();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, adjustPopupPosition]);

  // Handle clicks outside the popup
  useLayoutEffect(() => {
    if (!isOpen) return;

    const handleGlobalClick = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleGlobalClick);

    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
    };
  }, [isOpen, onClose]);

  // Reset state when popup closes
  useEffect(() => {
    if (!isOpen) {
      setHasExpandableContent(false);
      setIsVisible(false);
      initialRenderRef.current = true;
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  // Style for the popup
  const popupStyle = {
    visibility: isVisible ? "visible" : "hidden",
    left: `${position.x}px`,
    top: `${position.y}px`,
    opacity: isVisible ? 1 : 0,
    transition: "opacity 0.15s ease-out",
    height: "auto",
  };

  const popupContent = (
    <div
      ref={popupRef}
      className="fixed z-50 w-72 bg-[var(--bg-surface)] rounded-lg shadow-lg border border-[var(--border-light)]"
      style={popupStyle}
    >
      {title && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-light)]">
          <h3 className="text-xs font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--bg-hover)] rounded-md transition-colors"
          >
            <X className="w-3 h-3 text-[var(--text-secondary)]" />
          </button>
        </div>
      )}

      <div
        ref={contentRef}
        className={`${
          leftPadding && !hasExpandableContent ? "pl-5 pr-3 py-2" : "p-2"
        }`}
        style={{
          overflow: "visible",
          height: "auto",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "16px", // Add extra padding at the bottom
        }}
      >
        {children}
      </div>
    </div>
  );

  // Use createPortal to render to document body
  return createPortal(popupContent, document.body);
};
