import React, { useState } from "react";
import {
  Hand,
  Search,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  MousePointer2,
  Keyboard,
  CircleChevronRight,
  CircleChevronLeft,
} from "lucide-react";
import {
  DropdownRoot,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "../../../../../ultimatednd copy 3/src/components/ui/dropdown";
import ToggleGroup from "@/components/ui/toggle-group";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import { ThemeToggle } from "@/providers/ThemeToggle";

interface ViewportBarProps {
  onGrabToggle: (isGrabbing: boolean) => void;
  isGrabbing: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onZoomFit?: () => void;
}

const ViewportBar = ({
  onGrabToggle,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
}: ViewportBarProps) => {
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [mode, setMode] = useState("send");
  const [areButtonsHidden, setAreButtonsHidden] = useState(false);
  const [shouldReduceWidth, setShouldReduceWidth] = useState(false);
  const [shouldShowButtons, setShouldShowButtons] = useState(true);

  // Toggle function for Eye button
  const handleEyeToggle = () => {
    if (!areButtonsHidden) {
      // Step 1: Hide buttons
      setShouldShowButtons(false);
      // Step 2: After buttons are hidden, reduce the bar's width
      setTimeout(() => {
        setShouldReduceWidth(true);
        setAreButtonsHidden(true);
      }, 300); // Duration matches the CSS transition
    } else {
      // Step 1: Expand the bar's width
      setShouldReduceWidth(false);
      // Step 2: After the bar is expanded, show the buttons
      setTimeout(() => {
        setShouldShowButtons(true);
        setAreButtonsHidden(false);
      }, 300); // Duration matches the CSS transition
    }
  };

  return (
    <div
      className={`fixed bottom-6  z-[9998] bg-[var(--bg-surface)] flex items-center p-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] shadow-elevation-medium transition-all duration-300 flex-row-reverse`}
      style={{
        width: shouldReduceWidth ? "55px" : "445px",
        transition: "width 300ms ease",
        // right: !selectedViewportId ? "20px" : "280px",
        right: "280px",
      }}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={handleEyeToggle}
        className="transition-transform duration-300"
        aria-label={areButtonsHidden ? "Show buttons" : "Hide buttons"}
      >
        {areButtonsHidden ? (
          <CircleChevronLeft size={18} />
        ) : (
          <CircleChevronRight size={18} />
        )}
      </Button>
      <div
        className={`flex items-center gap-2 transition-all duration-300 ${
          shouldShowButtons
            ? "opacity-100 scale-100 translate-x-0"
            : "opacity-0 scale-0 -translate-x-4 pointer-events-none"
        }`}
      >
        <ToggleGroup
          type="icons"
          options={[
            { label: <MousePointer2 size={18} />, value: "send" },
            { label: <Hand size={18} />, value: "hand" },
          ]}
          value={mode}
          onChange={(value) => {
            setMode(value);
            onGrabToggle(value === "hand");
          }}
        />

        <LineSeparator orientation="vertical" height="26px" />

        <DropdownRoot>
          <DropdownTrigger onClick={() => setIsZoomOpen(!isZoomOpen)}>
            <Button
              className={`${isZoomOpen && "!bg-primary"}`}
              size="sm"
              variant="ghost"
            >
              <Search size={18} />
            </Button>
          </DropdownTrigger>

          <DropdownContent
            isOpen={isZoomOpen}
            onClose={() => setIsZoomOpen(false)}
          >
            <DropdownItem shortcut="Z">
              <Search size={16} />
              <span>Zoom</span>
            </DropdownItem>
            <DropdownItem onClick={onZoomIn} shortcut="⌘ +">
              <ZoomIn size={16} />
              <span>Zoom In</span>
            </DropdownItem>
            <DropdownItem onClick={onZoomOut} shortcut="⌘ -">
              <ZoomOut size={16} />
              <span>Zoom Out</span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onClick={onZoomReset} shortcut="⌘ 0">
              Zoom to 100%
            </DropdownItem>
            <DropdownItem onClick={onZoomFit} shortcut="⌘ 1">
              Zoom to Fit
            </DropdownItem>
            <DropdownItem shortcut="⌘ 2">Zoom to Selection</DropdownItem>
            <DropdownSeparator />
            <DropdownItem>
              <span className="text-lg leading-none">✓</span>
              <span>Fast Zoom</span>
            </DropdownItem>
            <DropdownItem>Nudge Amount</DropdownItem>
          </DropdownContent>
        </DropdownRoot>

        <LineSeparator orientation="vertical" height="26px" />

        <Button size="sm" variant="ghost">
          <HelpCircle size={18} />
        </Button>
        <Button size="sm" variant="ghost">
          <Keyboard size={18} />
        </Button>
        <LineSeparator orientation="vertical" height="26px" />
        <ThemeToggle />
        <LineSeparator orientation="vertical" height="26px" />
        <Button className="text-[#b0bfed]" size="sm" variant="ghost">
          Pro
        </Button>
        <LineSeparator orientation="vertical" height="26px" />
      </div>
    </div>
  );
};

export default ViewportBar;
