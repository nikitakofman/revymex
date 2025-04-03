import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Italic,
  Search,
  UnderlineIcon,
} from "lucide-react";
import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { ToolInput } from "../../../tools/_components/ToolInput";
import { useBuilder } from "@/builder/context/builderState";
import { Editor } from "@tiptap/react";
import { FixedSizeList as List } from "react-window";
import SimpleColorPicker from "./SimpleColorPicker";

interface TextMenuProps {
  BubbleMenuPortal: ({
    children,
  }: {
    children: React.ReactNode;
  }) => React.ReactPortal | null;
  menuPosition: {
    x: number;
    y: number;
    show: boolean;
  };
  editor: Editor;
  fontSize: string;
  setFontSize: Dispatch<SetStateAction<string>>;
  fontUnit?: string;
  setFontUnit?: Dispatch<SetStateAction<string>>;
  onToolbarInteractionStart: () => void;
  onToolbarInteractionEnd: () => void;
}

const TextMenu = ({
  BubbleMenuPortal,
  menuPosition,
  editor,
  fontSize,
  setFontSize,
  fontUnit = "px", // Default to px if not provided
  setFontUnit = () => {}, // No-op default function
  onToolbarInteractionStart,
  onToolbarInteractionEnd,
}: TextMenuProps) => {
  const { transform, contentRef } = useBuilder();
  const [fonts, setFonts] = useState<Array<{ family: string }>>([]);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFonts, setFilteredFonts] = useState<Array<{ family: string }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const fontPickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadedFonts = useRef(new Set<string>());
  const selectionBeforeFocus = useRef(null);

  // Detect font size unit on mount
  useEffect(() => {
    if (editor) {
      const attrs = editor.getAttributes("textStyle");
      if (attrs.fontSize) {
        // Extract unit from fontSize attribute (e.g., "16px" -> "px", "2.5vw" -> "vw")
        const unitMatch = attrs.fontSize.match(/[a-z%]+$/i);
        if (unitMatch && unitMatch[0]) {
          // Set the unit if it's one we support
          const detectedUnit = unitMatch[0];
          if (detectedUnit === "px" || detectedUnit === "vw") {
            setFontUnit(detectedUnit);
          }
        }
      }
    }
  }, [editor, setFontUnit]);

  // Fetch Google fonts
  useEffect(() => {
    const fetchGoogleFonts = async () => {
      try {
        const response = await fetch(
          `https://www.googleapis.com/webfonts/v1/webfonts?key=${process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY}&sort=popularity`
        );
        const data = await response.json();
        setFonts(data.items);
        setFilteredFonts(data.items);
      } catch (error) {
        console.error("Error fetching Google Fonts:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGoogleFonts();
  }, []);

  // Filter fonts based on search query
  useEffect(() => {
    const filtered = fonts.filter((font) =>
      font.family.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredFonts(filtered);
  }, [searchQuery, fonts]);

  // Focus search input when font picker opens
  useEffect(() => {
    if (showFontPicker && searchInputRef.current) {
      onToolbarInteractionStart();
      searchInputRef.current.focus();
    }
  }, [showFontPicker, onToolbarInteractionStart]);

  // Load font
  const loadFont = (fontFamily: string) => {
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

  // Handle font selection
  const handleFontSelect = (fontFamily: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToolbarInteractionStart();

    loadFont(fontFamily);

    setTimeout(() => {
      editor.chain().focus().setMark("textStyle", { fontFamily }).run();
      setShowFontPicker(false);
      onToolbarInteractionEnd();
    }, 50);
  };

  // Handle clicks outside the font picker
  const handleClickOutside = (event: MouseEvent) => {
    if (
      fontPickerRef.current &&
      !fontPickerRef.current.contains(event.target as Node)
    ) {
      setShowFontPicker(false);
      onToolbarInteractionEnd();
    }
  };

  // Set up and clean up click outside listener
  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Enhanced tool click handler that preserves selection
  const handleToolClick = (e: React.MouseEvent, callback: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    onToolbarInteractionStart();

    // Save current selection
    if (editor) {
      selectionBeforeFocus.current = editor.state.selection;
    }

    // Apply the style change
    callback();

    // Return focus to editor
    if (editor) {
      editor.view.focus();
      // Restore selection if it was lost
      if (selectionBeforeFocus.current && editor.state.selection.empty) {
        editor.view.dispatch(
          editor.state.tr.setSelection(selectionBeforeFocus.current)
        );
      }
    }

    onToolbarInteractionEnd();
  };

  // Handler for font size change
  const convertBetweenUnits = (
    value: number,
    fromUnit: string,
    toUnit: string
  ): number => {
    if (fromUnit === toUnit) return value;

    // Get the actual window width for accurate conversion
    const viewportWidth = window.innerWidth;

    if (fromUnit === "px" && toUnit === "vw") {
      // Convert px to vw - size relative to viewport width
      return (value / viewportWidth) * 100;
    } else if (fromUnit === "vw" && toUnit === "px") {
      // Convert vw to px - absolute pixel size
      return (value * viewportWidth) / 100;
    }

    return value; // Default fallback
  };

  // Replace the handleFontSizeChange function in TextMenu with this fixed version
  const handleFontSizeChange = (value: string | number, unit?: string) => {
    if (!editor) return;

    // Save selection before applying style
    selectionBeforeFocus.current = editor.state.selection;

    // Use the provided unit or fallback to current fontUnit
    const actualUnit = unit || fontUnit;
    let newValue = value;

    // If there's a unit change, we need to convert the value to maintain visual size
    if (unit && unit !== fontUnit) {
      // Convert value to maintain visual size
      const numericValue = parseFloat(String(value));

      // Only do conversion if we have a valid number
      if (!isNaN(numericValue)) {
        const convertedValue = convertBetweenUnits(
          numericValue,
          fontUnit,
          unit
        );

        // Format based on unit type
        if (unit === "vw") {
          newValue = parseFloat(convertedValue.toFixed(2)); // 2 decimal places for vw
        } else {
          newValue = Math.round(convertedValue); // Integer for px
        }
      }

      // Update unit state
      setFontUnit(unit);
    }

    // Apply the new font size with the appropriate unit
    const newSize = `${newValue}${actualUnit}`;
    editor.chain().focus().setFontSize(newSize).run();

    // Update font size state with proper formatting
    setFontSize(
      typeof newValue === "number"
        ? actualUnit === "vw"
          ? newValue.toFixed(2)
          : Math.round(newValue).toString()
        : newValue.toString()
    );

    // Refocus and restore selection if needed
    if (editor.state.selection.empty && selectionBeforeFocus.current) {
      editor.view.dispatch(
        editor.state.tr.setSelection(selectionBeforeFocus.current)
      );
    }

    onToolbarInteractionEnd();
  };

  // Render toolbar with fixed position at the top of the screen
  return (
    <BubbleMenuPortal>
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "76px", // Position below header
          transform: "translateX(-50%)",
          zIndex: 50,
        }}
        className="flex text-toolbar bubble-menu-container items-center gap-3 p-1 bg-[var(--bg-surface)] rounded-lg shadow-lg border border-[var(--border-light)]"
        onMouseDown={(e) => {
          e.stopPropagation();
          onToolbarInteractionStart();
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-center gap-2 px-1 border-r border-[var(--border-light)]">
          <div className="relative" ref={fontPickerRef}>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToolbarInteractionStart();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowFontPicker(!showFontPicker);
              }}
              className="h-7 px-2 min-w-[100px] text-left truncate bg-[var(--grid-line)] rounded-md flex items-center justify-between gap-2"
              style={{
                fontFamily:
                  editor.getAttributes("textStyle").fontFamily || "inherit",
              }}
            >
              <span className="text-xs">
                {editor.getAttributes("textStyle").fontFamily || "Font"}
              </span>
              <ChevronDown size={14} />
            </button>

            {showFontPicker && (
              <div
                className="absolute top-full left-0 mt-1 w-80 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-lg shadow-lg z-50"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onToolbarInteractionStart();
                }}
              >
                <div className="p-2 border-b border-[var(--border-light)]">
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[var(--bg-hover)] rounded-md px-4 py-1.5 pl-8 text-sm focus:outline-none"
                      placeholder="Search fonts..."
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onToolbarInteractionStart();
                      }}
                      onBlur={() => {
                        // Don't end interaction on blur - we'll handle it when font picker closes
                      }}
                    />
                    <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </div>
                </div>

                <div className="h-64">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--text-primary)]"></div>
                    </div>
                  ) : filteredFonts.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                      No fonts found
                    </div>
                  ) : (
                    <List
                      height={256}
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
                            onMouseDown={(e) =>
                              handleFontSelect(font.family, e)
                            }
                          >
                            <div className="flex items-center justify-between">
                              <span>{font.family}</span>
                              <span className="text-[var(--text-secondary)]">
                                Aa
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    </List>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Custom ToolInput wrapper that maintains selection */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onToolbarInteractionStart();
            }}
          >
            <ToolInput
              type="number"
              customValue={fontSize}
              min={8}
              max={100000}
              step={1}
              showUnit
              unit={fontUnit} // Pass the current font unit
              label="Size"
              onCustomChange={handleFontSizeChange}
              onUnitChange={(newUnit) => {
                setFontUnit(newUnit);
                // When changing unit, update the font size with the new unit
                handleFontSizeChange(fontSize, newUnit);
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5 px-1">
          <button
            onMouseDown={(e) =>
              handleToolClick(e, () =>
                editor.chain().focus().toggleBold().run()
              )
            }
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
              editor.isActive("bold") ? "bg-[var(--bg-hover)]" : ""
            }`}
            type="button"
          >
            <Bold size={16} />
          </button>
          <button
            onMouseDown={(e) =>
              handleToolClick(e, () =>
                editor.chain().focus().toggleItalic().run()
              )
            }
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
              editor.isActive("italic") ? "bg-[var(--bg-hover)]" : ""
            }`}
            type="button"
          >
            <Italic size={16} />
          </button>
          <button
            onMouseDown={(e) =>
              handleToolClick(e, () =>
                editor.chain().focus().toggleUnderline().run()
              )
            }
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
              editor.isActive("underline") ? "bg-[var(--bg-hover)]" : ""
            }`}
            type="button"
          >
            <UnderlineIcon size={16} />
          </button>
        </div>

        <div className="flex items-center gap-0.5 px-1 border-l border-[var(--border-light)]">
          <div
            className="relative p-1.5 rounded hover:bg-[var(--bg-hover)]"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToolbarInteractionStart();
            }}
          >
            <SimpleColorPicker
              onChange={(color) => {
                if (editor) {
                  // Save selection
                  selectionBeforeFocus.current = editor.state.selection;

                  // Apply color
                  editor.chain().focus().setColor(color).run();

                  // Restore selection if needed
                  if (
                    editor.state.selection.empty &&
                    selectionBeforeFocus.current
                  ) {
                    editor.view.dispatch(
                      editor.state.tr.setSelection(selectionBeforeFocus.current)
                    );
                  }

                  onToolbarInteractionEnd();
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5 px-1 border-l border-[var(--border-light)]">
          <button
            onMouseDown={(e) =>
              handleToolClick(e, () =>
                editor.chain().focus().setTextAlign("left").run()
              )
            }
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
              editor.isActive({ textAlign: "left" })
                ? "bg-[var(--bg-hover)]"
                : ""
            }`}
            type="button"
          >
            <AlignLeft size={16} />
          </button>
          <button
            onMouseDown={(e) =>
              handleToolClick(e, () =>
                editor.chain().focus().setTextAlign("center").run()
              )
            }
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
              editor.isActive({ textAlign: "center" })
                ? "bg-[var(--bg-hover)]"
                : ""
            }`}
            type="button"
          >
            <AlignCenter size={16} />
          </button>
          <button
            onMouseDown={(e) =>
              handleToolClick(e, () =>
                editor.chain().focus().setTextAlign("right").run()
              )
            }
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
              editor.isActive({ textAlign: "right" })
                ? "bg-[var(--bg-hover)]"
                : ""
            }`}
            type="button"
          >
            <AlignRight size={16} />
          </button>
        </div>
      </div>
    </BubbleMenuPortal>
  );
};

export default TextMenu;
