import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ToolbarSection,
  ToolbarButtonGroup,
  Label,
} from "./_components/ToolbarAtoms";
import { ToolInput } from "./_components/ToolInput";
import { ToolbarSegmentedControl } from "./_components/ToolbarSegmentedControl";
import ToolbarButton from "./_components/ToolbarButton";
import { ToolPopupTrigger } from "./_components/ToolbarPopupTrigger";
import { ToolbarPopup } from "@/builder/view/toolbars/rightToolbar/toolbar-popup";
import { useSelectedIds } from "@/builder/context/atoms/select-store";
import {
  useGetNode,
  useNodeStyle,
  useNodeBasics,
} from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  ChevronDown,
  UnderlineIcon,
  Search,
  GripVertical,
  Paintbrush,
} from "lucide-react";
import {
  useIsEditingText,
  useEditingTextNodeId,
} from "@/builder/context/atoms/canvas-interaction-store";
import { FixedSizeList as List } from "react-window";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorPicker } from "./_components/ColorPicker";
import { ToolbarSwitch } from "./_components/ToolbarSwitch";

/**
 * TypographyTool for right toolbar
 * - Controls text styling
 * - Includes gradient text support
 */
const TypographyTool = () => {
  // Selected node info
  const selectedIds = useSelectedIds();
  const getNode = useGetNode();

  // Check editing status
  const isEditingText = useIsEditingText();
  const editingNodeId = useEditingTextNodeId();

  // Font picker state
  const [showFontPopup, setShowFontPopup] = useState(false);
  const [fontPopupPosition, setFontPopupPosition] = useState({ x: 0, y: 0 });

  // Color picker state
  const [showColorPopup, setShowColorPopup] = useState(false);
  const [colorPopupPosition, setColorPopupPosition] = useState({ x: 0, y: 0 });

  // States for the UI controls
  const [fontSize, setFontSize] = useState("16");
  const [fontUnit, setFontUnit] = useState("px");
  const [lineHeight, setLineHeight] = useState("normal");
  const [letterSpacing, setLetterSpacing] = useState("normal");
  const [textAlign, setTextAlign] = useState("left");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderlined, setIsUnderlined] = useState(false);
  const [fontFamily, setFontFamily] = useState("inherit");
  const [textColor, setTextColor] = useState("#000000");

  // Gradient support
  const [isGradientEnabled, setIsGradientEnabled] = useState(false);
  const [gradientType, setGradientType] = useState("linear");
  const [gradientDirection, setGradientDirection] = useState("to right");
  const [gradientStops, setGradientStops] = useState([
    { color: "#4c00ff", position: 0 },
    { color: "#ff00aa", position: 100 },
  ]);

  // Get the global editor reference if we're editing
  const tiptapEditor =
    typeof window !== "undefined" ? window.tiptapEditor : null;

  // Get selected node or editing node
  const selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
  const targetId = isEditingText ? editingNodeId : selectedId;

  // Fonts data
  const [fonts, setFonts] = useState([]);
  const [filteredFonts, setFilteredFonts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const loadedFonts = useRef(new Set());

  // Format letter spacing value for display
  const getLetterSpacingDisplay = useCallback((value) => {
    if (!value || value === "normal") return "0";
    if (typeof value === "string" && value.endsWith("em")) {
      return value.replace("em", "");
    }
    return value.toString();
  }, []);

  // Create a computed value for the displayed color or gradient
  const displayedColorStyle = useCallback(() => {
    if (isGradientEnabled) {
      // Create CSS gradient string
      const stops = gradientStops
        .map((stop) => `${stop.color} ${stop.position}%`)
        .join(", ");

      return {
        background: `${gradientType}-gradient(${gradientDirection}, ${stops})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    } else {
      // Regular color
      return { backgroundColor: textColor };
    }
  }, [
    isGradientEnabled,
    gradientType,
    gradientDirection,
    gradientStops,
    textColor,
  ]);

  // Load the fonts when component mounts
  useEffect(() => {
    const fetchGoogleFonts = async () => {
      try {
        const response = await fetch(
          `https://www.googleapis.com/webfonts/v1/webfonts?key=${process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY}&sort=popularity`
        );
        const data = await response.json();
        setFonts(data.items);
        setFilteredFonts(data.items);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching Google Fonts:", error);
        setLoading(false);
      }
    };
    fetchGoogleFonts();
  }, []);

  // Filter fonts based on search
  useEffect(() => {
    if (fonts.length > 0) {
      const filtered = fonts.filter((font) =>
        font.family.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFonts(filtered);
    }
  }, [searchQuery, fonts]);

  // Helper to load a font
  const loadFont = (fontFamily) => {
    if (!loadedFonts.current.has(fontFamily)) {
      const link = document.createElement("link");
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(
        /\s+/g,
        "+"
      )}:wght@400;500;600;700&display=swap`;
      link.rel = "stylesheet";
      document.head.appendChild(link);
      loadedFonts.current.add(fontFamily);
    }
  };

  // Helper to parse gradient from CSS
  const parseGradientFromCSS = (cssText) => {
    if (!cssText) return false;

    // Check if this is a gradient
    if (cssText.includes("gradient(")) {
      try {
        // Extract gradient type (linear/radial)
        const type = cssText.includes("linear-gradient") ? "linear" : "radial";

        // Extract direction (for linear gradient)
        let direction = "to right";
        if (type === "linear") {
          const dirMatch = cssText.match(/linear-gradient\(([^,]+),/);
          if (dirMatch && dirMatch[1]) {
            direction = dirMatch[1].trim();
          }
        }

        // Extract color stops
        const stopsRegex = /(?:rgba?\([^)]+\)|#[0-9a-f]{3,8}|\w+)\s+(\d+)%/gi;
        const stops = [];
        let stopMatch;

        const colorRegex = /(rgba?\([^)]+\)|#[0-9a-f]{3,8}|\w+)\s+(\d+)%/i;

        const parts = cssText.split(",");
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i].trim();
          const match = part.match(colorRegex);
          if (match) {
            stops.push({
              color: match[1],
              position: parseInt(match[2], 10),
            });
          }
        }

        // If we found at least two stops, we have a gradient
        if (stops.length >= 2) {
          setIsGradientEnabled(true);
          setGradientType(type);
          setGradientDirection(direction);
          setGradientStops(stops);
          return true;
        }
      } catch (error) {
        console.error("Error parsing gradient:", error);
      }
    }

    return false;
  };

  // Initialize tool state based on the selected/editing node
  useEffect(() => {
    if (!targetId) return;

    // Get node info
    const node = getNode(targetId);
    if (!node) return;

    // Reset gradient state
    setIsGradientEnabled(false);

    // If we're editing and have tiptapEditor, get values from it
    if (isEditingText && tiptapEditor) {
      try {
        // Get attributes from the editor
        const textStyleAttrs = tiptapEditor.getAttributes("textStyle");
        const alignAttrs = tiptapEditor.getAttributes("paragraph");

        // Set font size
        if (textStyleAttrs.fontSize) {
          const sizeStr = textStyleAttrs.fontSize;
          const numericPart = sizeStr.replace(/[^\d.]/g, "");
          if (numericPart) {
            setFontSize(numericPart);
          }

          if (sizeStr.includes("vw")) {
            setFontUnit("vw");
          } else {
            setFontUnit("px");
          }
        }

        // Set line height
        if (textStyleAttrs.lineHeight) {
          setLineHeight(textStyleAttrs.lineHeight);
        }

        // Set letter spacing
        if (textStyleAttrs.letterSpacing) {
          setLetterSpacing(textStyleAttrs.letterSpacing);
        }

        // Set font family
        if (textStyleAttrs.fontFamily) {
          setFontFamily(textStyleAttrs.fontFamily);
          loadFont(textStyleAttrs.fontFamily);
        }

        // Set text color or gradient
        if (
          textStyleAttrs.background &&
          textStyleAttrs.backgroundClip === "text"
        ) {
          // This is a gradient text
          const isGradient = parseGradientFromCSS(textStyleAttrs.background);
          if (!isGradient && textStyleAttrs.color) {
            setTextColor(textStyleAttrs.color);
          }
        } else if (textStyleAttrs.color) {
          setTextColor(textStyleAttrs.color);
        }

        // Set text alignment
        if (alignAttrs.textAlign) {
          setTextAlign(alignAttrs.textAlign);
        }

        // Set formatting
        setIsBold(tiptapEditor.isActive("bold"));
        setIsItalic(tiptapEditor.isActive("italic"));
        setIsUnderlined(tiptapEditor.isActive("underline"));
      } catch (error) {
        console.error("Error getting editor state:", error);
      }
    }
    // If not editing, parse from node.style.text
    else if (node.style && node.style.text) {
      try {
        // Parse the HTML to extract styles
        const parser = new DOMParser();
        const doc = parser.parseFromString(node.style.text, "text/html");

        // Find paragraph for alignment
        const paragraph = doc.querySelector("p");
        if (paragraph) {
          const align = paragraph.style.textAlign;
          if (align) {
            setTextAlign(align);
          }
        }

        // Find span for other styles
        const span = doc.querySelector("span");
        if (span) {
          // Font size
          if (span.style.fontSize) {
            const size = span.style.fontSize;
            const numericPart = size.replace(/[^\d.]/g, "");
            if (numericPart) {
              setFontSize(numericPart);
            }

            if (size.includes("vw")) {
              setFontUnit("vw");
            } else {
              setFontUnit("px");
            }
          }

          // Font family
          if (span.style.fontFamily) {
            setFontFamily(span.style.fontFamily);
            loadFont(span.style.fontFamily);
          }

          // Text color or gradient
          if (
            span.style.background &&
            span.style.webkitBackgroundClip === "text"
          ) {
            // This is a gradient text
            const isGradient = parseGradientFromCSS(span.style.background);
            if (!isGradient && span.style.color) {
              setTextColor(span.style.color);
            }
          } else if (span.style.color) {
            setTextColor(span.style.color);
          }

          // Line height
          if (span.style.lineHeight) {
            setLineHeight(span.style.lineHeight);
          }

          // Letter spacing
          if (span.style.letterSpacing) {
            setLetterSpacing(span.style.letterSpacing);
          }

          // Formatting
          setIsBold(
            window.getComputedStyle(span).fontWeight === "bold" ||
              parseInt(span.style.fontWeight) >= 700
          );
          setIsItalic(span.style.fontStyle === "italic");
          setIsUnderlined(
            span.style.textDecoration?.includes("underline") || false
          );
        }
      } catch (error) {
        console.error("Error parsing text styles:", error);
      }
    }
  }, [targetId, getNode, isEditingText, tiptapEditor]);

  // Return null if no text element is selected
  if (!targetId) return null;

  const nodeBasics = useNodeBasics(targetId);
  if (nodeBasics.type !== "text") return null;

  // Helper function to process HTML with style updates
  const updateTextStyles = (updateFunction) => {
    // If we're editing and have access to the editor, use it
    if (isEditingText && tiptapEditor) {
      updateFunction(tiptapEditor);
      return;
    }

    // Otherwise, we need to manually modify the HTML
    const node = getNode(targetId);
    if (!node || !node.style || !node.style.text) return;

    try {
      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(node.style.text, "text/html");

      // Apply the style update
      updateFunction(doc);

      // Serialize back to HTML
      const serializer = new XMLSerializer();
      const updatedHtml = serializer.serializeToString(doc);

      // Update the node style
      updateNodeStyle(targetId, { text: updatedHtml });
    } catch (error) {
      console.error("Error updating text styles:", error);
    }
  };

  // Handler for font size changes
  const handleFontSizeChange = (value, unit) => {
    // Ensure we have a number
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    // Update internal state
    setFontSize(value);
    if (unit) setFontUnit(unit);

    // Format the value with unit
    const unitToUse = unit || fontUnit;
    const formattedValue = `${numValue}${unitToUse}`;

    // Update text styles
    updateTextStyles((target) => {
      if (target.commands) {
        // TipTap editor
        target.commands.updateAttributes("textStyle", {
          fontSize: formattedValue,
        });
      } else {
        // DOM document
        const spans = target.querySelectorAll("span");
        spans.forEach((span) => {
          span.style.fontSize = formattedValue;
        });
      }
    });
  };

  // Handler for font family changes
  const handleFontFamilyChange = (family) => {
    // Load the font
    loadFont(family);

    // Update internal state
    setFontFamily(family);
    setShowFontPopup(false);

    // Update text styles
    updateTextStyles((target) => {
      if (target.commands) {
        // TipTap editor
        target.commands.updateAttributes("textStyle", { fontFamily: family });
      } else {
        // DOM document
        const spans = target.querySelectorAll("span");
        spans.forEach((span) => {
          span.style.fontFamily = family;
        });
      }
    });
  };

  // Handler for text color changes
  const handleTextColorChange = (color) => {
    setTextColor(color);

    updateTextStyles((target) => {
      if (target.commands) {
        // TipTap editor
        if (isGradientEnabled) {
          // Apply gradient text
          const stops = gradientStops
            .map((stop) => `${stop.color} ${stop.position}%`)
            .join(", ");

          const gradientValue = `${gradientType}-gradient(${gradientDirection}, ${stops})`;

          target.commands.updateAttributes("textStyle", {
            background: gradientValue,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: color, // Fallback color
          });
        } else {
          // Apply solid color
          target.commands.updateAttributes("textStyle", {
            color,
            background: null,
            backgroundClip: null,
            WebkitBackgroundClip: null,
            WebkitTextFillColor: null,
          });
        }
      } else {
        // DOM document
        const spans = target.querySelectorAll("span");
        spans.forEach((span) => {
          if (isGradientEnabled) {
            // Apply gradient text
            const stops = gradientStops
              .map((stop) => `${stop.color} ${stop.position}%`)
              .join(", ");

            const gradientValue = `${gradientType}-gradient(${gradientDirection}, ${stops})`;

            span.style.background = gradientValue;
            span.style.webkitBackgroundClip = "text";
            span.style.backgroundClip = "text";
            span.style.webkitTextFillColor = "transparent";
            span.style.color = color; // Fallback color
          } else {
            // Apply solid color
            span.style.color = color;
            span.style.background = "";
            span.style.webkitBackgroundClip = "";
            span.style.backgroundClip = "";
            span.style.webkitTextFillColor = "";
          }
        });
      }
    });
  };

  // Handler for gradient toggle
  const handleGradientToggle = () => {
    const newGradientState = !isGradientEnabled;
    setIsGradientEnabled(newGradientState);

    // Apply the changes
    if (newGradientState) {
      // Switching to gradient
      handleTextColorChange(textColor);
    } else {
      // Switching to solid color
      handleTextColorChange(textColor);
    }
  };

  // Handler for gradient type change
  const handleGradientTypeChange = (type) => {
    setGradientType(type);
    handleTextColorChange(textColor);
  };

  // Handler for gradient direction change
  const handleGradientDirectionChange = (direction) => {
    setGradientDirection(direction);
    handleTextColorChange(textColor);
  };

  // Handler for gradient stop color change
  const handleGradientStopColorChange = (index, color) => {
    const newStops = [...gradientStops];
    newStops[index].color = color;
    setGradientStops(newStops);
    handleTextColorChange(textColor);
  };

  // Handler for gradient stop position change
  const handleGradientStopPositionChange = (index, position) => {
    const newStops = [...gradientStops];
    newStops[index].position = position;
    setGradientStops(newStops);
    handleTextColorChange(textColor);
  };

  // Add a new gradient stop
  const addGradientStop = () => {
    // Calculate a middle position
    const newStops = [...gradientStops];
    const lastPos = newStops[newStops.length - 1].position;
    const secondLastPos =
      newStops.length > 1 ? newStops[newStops.length - 2].position : 0;
    const newPos = Math.min(100, lastPos + (lastPos - secondLastPos) / 2);

    newStops.push({
      color: textColor,
      position: newPos,
    });

    setGradientStops(newStops);
    handleTextColorChange(textColor);
  };

  // Remove a gradient stop
  const removeGradientStop = (index) => {
    if (gradientStops.length <= 2) return; // Keep at least 2 stops

    const newStops = [...gradientStops];
    newStops.splice(index, 1);
    setGradientStops(newStops);
    handleTextColorChange(textColor);
  };

  // Handler for line height changes
  const handleLineHeightChange = (value) => {
    setLineHeight(value);

    updateTextStyles((target) => {
      if (target.commands) {
        // TipTap editor
        target.commands.updateAttributes("textStyle", { lineHeight: value });
      } else {
        // DOM document
        const spans = target.querySelectorAll("span");
        spans.forEach((span) => {
          span.style.lineHeight = value;
        });
      }
    });
  };

  // Handler for letter spacing changes
  const handleLetterSpacingChange = (value) => {
    // Convert value to string and fix formatting
    const formattedValue =
      typeof value === "number" || !isNaN(parseFloat(value.toString()))
        ? `${value}em`
        : value.toString();

    setLetterSpacing(formattedValue);

    updateTextStyles((target) => {
      if (target.commands) {
        // TipTap editor
        target.commands.updateAttributes("textStyle", {
          letterSpacing: formattedValue,
        });
      } else {
        // DOM document
        const spans = target.querySelectorAll("span");
        spans.forEach((span) => {
          span.style.letterSpacing = formattedValue;
        });
      }
    });
  };

  // Handler for text alignment
  const handleTextAlignChange = (align) => {
    setTextAlign(align);

    updateTextStyles((target) => {
      if (target.commands) {
        // TipTap editor
        target.commands.setTextAlign(align);
      } else {
        // DOM document
        const paragraphs = target.querySelectorAll("p");
        paragraphs.forEach((p) => {
          p.style.textAlign = align;
        });
      }
    });
  };

  // Handler for toggling bold
  const handleToggleBold = () => {
    const newValue = !isBold;
    setIsBold(newValue);

    updateTextStyles((target) => {
      if (target.commands) {
        // TipTap editor
        if (newValue) {
          target.commands.setBold();
        } else {
          target.commands.unsetBold();
        }
      } else {
        // DOM document
        const spans = target.querySelectorAll("span");
        spans.forEach((span) => {
          span.style.fontWeight = newValue ? "bold" : "normal";
        });
      }
    });
  };

  // Handler for toggling italic
  const handleToggleItalic = () => {
    const newValue = !isItalic;
    setIsItalic(newValue);

    updateTextStyles((target) => {
      if (target.commands) {
        // TipTap editor
        if (newValue) {
          target.commands.setItalic();
        } else {
          target.commands.unsetItalic();
        }
      } else {
        // DOM document
        const spans = target.querySelectorAll("span");
        spans.forEach((span) => {
          span.style.fontStyle = newValue ? "italic" : "normal";
        });
      }
    });
  };

  // Handler for toggling underline
  const handleToggleUnderline = () => {
    const newValue = !isUnderlined;
    setIsUnderlined(newValue);

    updateTextStyles((target) => {
      if (target.commands) {
        // TipTap editor
        if (newValue) {
          target.commands.setUnderline();
        } else {
          target.commands.unsetUnderline();
        }
      } else {
        // DOM document
        const spans = target.querySelectorAll("span");
        spans.forEach((span) => {
          span.style.textDecoration = newValue ? "underline" : "none";
        });
      }
    });
  };

  // Handler for unit changes
  const handleUnitChange = (newUnit) => {
    if (newUnit === fontUnit) return;

    // Calculate viewport width for conversion
    const viewportWidth = window.innerWidth;

    // Convert between units
    const numericValue = parseFloat(fontSize);
    if (isNaN(numericValue)) return;

    let convertedValue;
    if (fontUnit === "px" && newUnit === "vw") {
      convertedValue = (numericValue / viewportWidth) * 100;
    } else if (fontUnit === "vw" && newUnit === "px") {
      convertedValue = (numericValue * viewportWidth) / 100;
    } else {
      convertedValue = numericValue;
    }

    // Format for display
    const formattedValue =
      newUnit === "vw"
        ? convertedValue.toFixed(2)
        : Math.round(convertedValue).toString();

    // Update using the font size handler
    handleFontSizeChange(formattedValue, newUnit);
  };

  // Font picker popup trigger handler
  const handleFontPickerTrigger = (triggerElement, e) => {
    if (triggerElement) {
      const rect = triggerElement.getBoundingClientRect();
      setFontPopupPosition({ x: rect.right + 10, y: rect.top });
      setShowFontPopup(true);
    }
  };

  // Color picker popup trigger handler
  const handleColorPickerTrigger = (triggerElement, e) => {
    if (triggerElement) {
      const rect = triggerElement.getBoundingClientRect();
      setColorPopupPosition({ x: rect.right + 10, y: rect.top });
      setShowColorPopup(true);
    }
  };

  // Create alignment options for the segmented control
  const alignmentOptions = [
    { value: "left", icon: <AlignLeft size={16} /> },
    { value: "center", icon: <AlignCenter size={16} /> },
    { value: "right", icon: <AlignRight size={16} /> },
  ];

  // Create gradient direction options
  const directionOptions = [
    { value: "to right", label: "→" },
    { value: "to bottom", label: "↓" },
    { value: "to left", label: "←" },
    { value: "to top", label: "↑" },
    { value: "to bottom right", label: "↘" },
    { value: "to bottom left", label: "↙" },
    { value: "to top right", label: "↗" },
    { value: "to top left", label: "↖" },
  ];

  // Create gradient type options
  const gradientTypeOptions = [
    { value: "linear", label: "Linear" },
    { value: "radial", label: "Radial" },
  ];

  // Get the proper letter spacing display value
  const letterSpacingDisplay = getLetterSpacingDisplay(letterSpacing);

  return (
    <>
      <ToolbarSection title="Typography">
        {/* FONT FAMILY */}
        <ToolPopupTrigger title="Font" onTriggerPopup={handleFontPickerTrigger}>
          <ToolbarButton>
            <span style={{ fontFamily }}>{fontFamily || "Font"}</span>
          </ToolbarButton>
        </ToolPopupTrigger>

        {/* FONT SIZE */}
        <ToolInput
          type="number"
          customValue={fontSize}
          min={1}
          max={500}
          step={1}
          showUnit
          unit={fontUnit}
          label="Size"
          onCustomChange={handleFontSizeChange}
          onUnitChange={handleUnitChange}
        />

        {/* TEXT COLOR - Now with just a color swatch */}
        <ToolPopupTrigger
          title="Color"
          onTriggerPopup={handleColorPickerTrigger}
        >
          <ToolbarButton>
            <div className="w-full h-6 rounded-sm border border-[var(--border-light)] overflow-hidden">
              <div
                className="w-full h-full"
                style={displayedColorStyle()}
              ></div>
            </div>
          </ToolbarButton>
        </ToolPopupTrigger>

        {/* FORMATTING AND ALIGNMENT - ALL ON ONE LINE */}
        <div className="flex items-center space-x-2">
          {/* Formatting Controls */}
          <div className="flex-shrink-0">
            <ToggleGroup type="multiple" size="sm" className="flex">
              <ToggleGroupItem
                value="bold"
                aria-label="Toggle bold"
                data-state={isBold ? "on" : "off"}
                onClick={handleToggleBold}
              >
                <Bold className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="italic"
                aria-label="Toggle italic"
                data-state={isItalic ? "on" : "off"}
                onClick={handleToggleItalic}
              >
                <Italic className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="underline"
                aria-label="Toggle underline"
                data-state={isUnderlined ? "on" : "off"}
                onClick={handleToggleUnderline}
              >
                <UnderlineIcon className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Alignment Controls */}
          <div className="flex-grow">
            <ToolbarSegmentedControl
              cssProperty="textAlign"
              options={alignmentOptions}
              currentValue={textAlign}
              size="sm"
              onChange={handleTextAlignChange}
              noPadding
            />
          </div>
        </div>

        {/* LINE HEIGHT */}
        <ToolInput
          type="number"
          customValue={lineHeight === "normal" ? "1.5" : lineHeight}
          min={0.5}
          max={3}
          step={0.1}
          placeholder="1.5"
          label="Line Height"
          className="w-full"
          onCustomChange={handleLineHeightChange}
        />

        {/* LETTER SPACING */}
        <ToolInput
          type="number"
          customValue={letterSpacingDisplay}
          min={-0.1}
          max={2}
          step={0.01}
          placeholder="0"
          label="Letter Spacing"
          className="w-full"
          onCustomChange={handleLetterSpacingChange}
        />
      </ToolbarSection>

      {/* Font Picker Popup */}
      <ToolbarPopup
        isOpen={showFontPopup}
        onClose={() => setShowFontPopup(false)}
        triggerPosition={fontPopupPosition}
        title="Font Family"
      >
        <div className="p-2 border-b border-[var(--border-light)]">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-hover)] rounded-md px-8 py-1.5 text-sm focus:outline-none"
              placeholder="Search fonts..."
            />
            <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </div>
        </div>

        <div className="font-list" style={{ height: "320px" }}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--text-primary)]"></div>
            </div>
          ) : filteredFonts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[var(--text-secondary)] text-sm">
              No fonts found
            </div>
          ) : (
            <List
              height={320}
              itemCount={filteredFonts.length}
              itemSize={40}
              width="100%"
            >
              {({ index, style }) => {
                const font = filteredFonts[index];
                loadFont(font.family);
                return (
                  <div
                    style={{ ...style, fontFamily: font.family }}
                    className="px-3 py-2 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    onClick={() => handleFontFamilyChange(font.family)}
                  >
                    <div className="flex items-center justify-between">
                      <span>{font.family}</span>
                      <span className="text-[var(--text-secondary)]">Aa</span>
                    </div>
                  </div>
                );
              }}
            </List>
          )}
        </div>
      </ToolbarPopup>

      {/* Color Picker Popup with Gradient Options */}
      <ToolbarPopup
        isOpen={showColorPopup}
        onClose={() => setShowColorPopup(false)}
        triggerPosition={colorPopupPosition}
        title="Text Color"
      >
        <div className="p-3 space-y-4">
          {/* Gradient Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paintbrush className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="text-sm">Gradient Text</span>
            </div>
            <ToolbarSwitch
              cssProperty="gradient-enabled-custom"
              onValue="true"
              offValue="false"
              currentValue={isGradientEnabled ? "true" : "false"}
              onChange={(val) => handleGradientToggle()}
            />
          </div>

          {isGradientEnabled ? (
            <>
              {/* Gradient Type */}
              <div>
                <Label>Gradient Type</Label>
                <ToolbarSegmentedControl
                  cssProperty="gradient-type-custom"
                  options={gradientTypeOptions}
                  currentValue={gradientType}
                  onChange={handleGradientTypeChange}
                  size="sm"
                />
              </div>

              {/* Gradient Direction (only for linear) */}
              {gradientType === "linear" && (
                <div>
                  <Label>Direction</Label>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    {directionOptions.map((option) => (
                      <button
                        key={option.value}
                        className={`p-1 h-8 border ${
                          gradientDirection === option.value
                            ? "bg-[var(--control-bg-active)] border-[var(--border-focus)]"
                            : "bg-[var(--control-bg)] border-[var(--control-border)]"
                        } rounded-md text-center text-sm`}
                        onClick={() =>
                          handleGradientDirectionChange(option.value)
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Gradient Stops */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Color Stops</Label>
                  <button
                    className="text-xs bg-[var(--control-bg)] px-2 py-1 rounded-md border border-[var(--control-border)]"
                    onClick={addGradientStop}
                  >
                    Add Stop
                  </button>
                </div>

                <div className="space-y-2">
                  {gradientStops.map((stop, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-shrink-0">
                        <GripVertical className="h-4 w-4 text-[var(--text-secondary)]" />
                      </div>
                      <div
                        className="w-6 h-6 rounded-sm border border-[var(--border-light)] cursor-pointer"
                        style={{ backgroundColor: stop.color }}
                        onClick={() => {
                          // Open a standard color picker for this stop
                          // For simplicity, we're directly updating the color here
                          const newColor = prompt(
                            "Enter color (hex, rgb, etc)",
                            stop.color
                          );
                          if (newColor) {
                            handleGradientStopColorChange(index, newColor);
                          }
                        }}
                      ></div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={stop.position}
                        className="flex-grow"
                        onChange={(e) =>
                          handleGradientStopPositionChange(
                            index,
                            parseInt(e.target.value, 10)
                          )
                        }
                      />
                      <span className="text-xs w-8">{stop.position}%</span>
                      {gradientStops.length > 2 && (
                        <button
                          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          onClick={() => removeGradientStop(index)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <Label>Preview</Label>
                <div className="p-3 bg-[var(--control-bg)] rounded-md mt-1">
                  <div
                    className="text-2xl font-bold text-center"
                    style={displayedColorStyle()}
                  >
                    Text Preview
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Regular color picker */
            <ColorPicker
              displayMode="direct"
              value={textColor}
              onChange={handleTextColorChange}
              contentPadding="p-0"
            />
          )}
        </div>
      </ToolbarPopup>
    </>
  );
};

export default TypographyTool;
