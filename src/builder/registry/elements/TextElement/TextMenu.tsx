import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Italic,
  LetterText,
  LineChart,
  MoveHorizontal,
  MoveVertical,
  Search,
  Space,
  UnderlineIcon,
  UnfoldVertical,
} from "lucide-react";
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ToolInput } from "../../../tools/_components/ToolInput";
import { useBuilder } from "@/builder/context/builderState";
import { Editor } from "@tiptap/react";
import { FixedSizeList as List } from "react-window";
import SimpleColorPicker from "./SimpleColorPicker";
import { findParentViewport } from "@/builder/context/utils";
import { canvasOps } from "@/builder/context/atoms/canvas-interaction-store";
import { useDynamicModeNodeId } from "@/builder/context/atoms/dynamic-store";

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
  handleFontSizeChange: (value: string | number, unit?: string) => void;
  directUpdateFontSize: (value: string | number, unit: string) => void;
  handleLineHeightChange: (value: string | number) => void;
  handleLetterSpacingChange: (value: string | number) => void;
  lineHeight?: string;
  setLineHeight?: Dispatch<SetStateAction<string>>;
  letterSpacing?: string;
  setLetterSpacing?: Dispatch<SetStateAction<string>>;
  node: any;
}

const TextMenu = ({
  BubbleMenuPortal,
  menuPosition,
  editor,
  fontSize,
  setFontSize,
  fontUnit = "px",
  setFontUnit = () => {},
  onToolbarInteractionStart,
  onToolbarInteractionEnd,
  handleFontSizeChange,
  directUpdateFontSize,
  lineHeight = "normal",
  setLineHeight = () => {},
  letterSpacing = "normal",
  setLetterSpacing = () => {},
  handleLineHeightChange = () => {},
  handleLetterSpacingChange = () => {},

  node,
}: TextMenuProps) => {
  const { nodeState, setNodeStyle } = useBuilder();
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

  const dynamicModeNodeId = useDynamicModeNodeId();

  // Helper function to get the correct viewport width
  const getViewportWidth = useCallback(() => {
    if (node && node.parentId) {
      const parentViewportId = findParentViewport(
        node.parentId,
        nodeState.nodes
      );
      const viewportNode = nodeState.nodes.find(
        (n) => n.id === parentViewportId
      );
      if (viewportNode && viewportNode.viewportWidth) {
        return viewportNode.viewportWidth;
      }
    }
    return window.innerWidth;
  }, [node, nodeState.nodes]);

  // Improved convertBetweenUnits function
  const convertBetweenUnits = useCallback(
    (value: number, fromUnit: string, toUnit: string): number => {
      if (fromUnit === toUnit) return value;
      const viewportWidth = getViewportWidth();
      if (fromUnit === "px" && toUnit === "vw") {
        return (value / viewportWidth) * 100;
      } else if (fromUnit === "vw" && toUnit === "px") {
        return (value * viewportWidth) / 100;
      }
      return value;
    },
    [getViewportWidth]
  );

  useEffect(() => {
    canvasOps.setIsTextMenuOpen(true);

    return () => {
      canvasOps.setIsTextMenuOpen(false);
    };
  }, []);

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

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Enhanced tool click handler that preserves selection
  const handleToolClick = (e: React.MouseEvent, callback: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    onToolbarInteractionStart();
    if (editor) {
      selectionBeforeFocus.current = editor.state.selection;
    }
    callback();
    if (editor) {
      editor.view.focus();
      if (selectionBeforeFocus.current && editor.state.selection.empty) {
        editor.view.dispatch(
          editor.state.tr.setSelection(selectionBeforeFocus.current)
        );
      }
    }
    onToolbarInteractionEnd();
  };

  const handlePartialSelection = (value, unit) => {
    if (!editor) return;

    // Get current selection
    const { from, to } = editor.state.selection;

    // Only process non-empty selections that don't start at the beginning
    if (editor.state.selection.empty || from <= 1) return false;

    try {
      // Parse value
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) return false;

      // Format value
      const formattedValue =
        unit === "vw"
          ? numericValue.toFixed(2)
          : Math.round(numericValue).toString();

      // Create font size value with unit
      const fontSizeValue = `${formattedValue}${unit}`;

      // KEY FIX: Get current attributes to preserve styles
      const currentAttrs = editor.getAttributes("textStyle");

      // Create direct transaction
      const tr = editor.state.tr;

      // Create a mark that combines current attributes with new fontSize
      const mark = editor.schema.marks.textStyle.create({
        ...currentAttrs, // Preserve all current styles (color, etc.)
        fontSize: fontSizeValue, // Only update fontSize
      });

      // Apply the mark (no need to remove first)
      tr.addMark(from, to, mark);

      // Execute the transaction
      editor.view.dispatch(tr);

      return true;
    } catch (error) {
      console.error("Error in handlePartialSelection:", error);
      return false;
    }
  };

  const getParentViewportWidth = useCallback(() => {
    const parentViewportId = findParentViewport(node.parentId, nodeState.nodes);
    const viewportNode = nodeState.nodes.find((n) => n.id === parentViewportId);
    return viewportNode?.viewportWidth || window.innerWidth;
  }, [node.parentId, nodeState.nodes]);

  // Helper function to create presets for line height

  // Helper function to create presets for font size
  const fontSizePresets = [
    "12",
    "14",
    "16",
    "18",
    "20",
    "24",
    "32",
    "48",
    "64",
    "96",
  ];

  // Helper function to create presets for line height
  const lineHeightPresets = ["1", "1.2", "1.5", "1.8", "2", "normal"];

  // Helper function to create presets for letter spacing
  const letterSpacingPresets = [
    "normal",
    "0.05em",
    "0.1em",
    "0.15em",
    "0.2em",
    "-0.05em",
  ];

  return (
    <BubbleMenuPortal>
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: dynamicModeNodeId ? "130px" : "76px",
          transform: "translateX(-50%)",
          zIndex: 50,
        }}
        className="flex text-toolbar bubble-menu-container items-center gap-2 p-1.5 bg-[var(--bg-surface)] rounded-lg shadow-lg border border-[var(--border-light)]"
        onMouseDown={(e) => {
          e.stopPropagation();
          onToolbarInteractionStart();
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {/* SECTION 1: Font Family */}
        <div className="flex items-center ">
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
              className="h-7 px-3 min-w-[120px] text-left truncate bg-[var(--grid-line)] rounded-md flex items-center justify-between gap-2"
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
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-[var(--border-light)]"></div>

        {/* SECTION 2: Font Size */}
        <div className="flex items-center px-1">
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onToolbarInteractionStart();
            }}
            className="relative"
          >
            <ToolInput
              type="number"
              customValue={fontSize}
              min={1}
              max={100000}
              step={0.1}
              showUnit
              unit={fontUnit}
              label="Size"
              onCustomChange={(value, unit) => {
                const currentUnit = unit || fontUnit;
                if (
                  editor.getHTML().includes("</p><p") &&
                  currentUnit === "vw"
                ) {
                  directUpdateFontSize(value, currentUnit);
                  return;
                }

                const { from } = editor.state.selection;
                const isPartialSelection =
                  !editor.state.selection.empty && from > 1;

                if (isPartialSelection) {
                  const handled = handlePartialSelection(value, currentUnit);
                  if (handled) return;
                }

                handleFontSizeChange(value, currentUnit);
              }}
              onUnitChange={(newUnit) => {
                onToolbarInteractionStart();
                const numericValue = parseFloat(fontSize);
                if (isNaN(numericValue)) {
                  directUpdateFontSize("16", newUnit);
                  return;
                }

                if (fontUnit === "vw" && newUnit === "px") {
                  const viewportWidth = getParentViewportWidth();
                  const pxValue = Math.min(
                    Math.round((numericValue * viewportWidth) / 100),
                    300
                  );
                  const isMultiLine = editor.getHTML().includes("</p><p");
                  setFontUnit(newUnit);
                  setFontSize(pxValue.toString());

                  if (isMultiLine) {
                    try {
                      const currentHTML = editor.getHTML();
                      const newHTML = currentHTML.replace(
                        /font-size:\s*([0-9.]+)vw/g,
                        (match, vwValue) => {
                          const vw = parseFloat(vwValue);
                          let px = 16;
                          if (vw <= 1) px = 12;
                          else if (vw <= 2) px = 16;
                          else if (vw <= 3) px = 20;
                          else if (vw <= 5) px = 24;
                          else if (vw <= 8) px = 32;
                          else if (vw <= 12) px = 48;
                          else if (vw <= 18) px = 64;
                          else if (vw <= 24) px = 96;
                          else px = 120;
                          return `font-size: ${px}px`;
                        }
                      );
                      setNodeStyle(
                        { text: newHTML },
                        undefined,
                        true,
                        false,
                        false
                      );
                      editor.commands.setContent(newHTML);
                    } catch (error) {
                      console.error(
                        "Error converting VW to PX for multi-line:",
                        error
                      );
                      directUpdateFontSize(pxValue.toString(), newUnit);
                    }
                  } else {
                    editor.chain().focus().setFontSize(`${pxValue}px`).run();
                    const updatedHtml = editor.getHTML();
                    setNodeStyle(
                      { text: updatedHtml },
                      undefined,
                      true,
                      false,
                      false
                    );
                  }
                  onToolbarInteractionEnd();
                  return;
                }

                if (fontUnit === "px" && newUnit === "vw") {
                  const viewportWidth = getParentViewportWidth();
                  const convertedValue = (numericValue / viewportWidth) * 100;
                  const vwValue = Math.round(convertedValue * 100) / 100;
                  directUpdateFontSize(vwValue.toString(), newUnit);
                  return;
                }

                directUpdateFontSize(fontSize, newUnit);
              }}
            />
          </div>
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-[var(--border-light)]"></div>

        {/* SECTION 5: Color */}
        <div className="flex items-center">
          <div
            className="relative p-1 rounded hover:bg-[var(--bg-hover)]"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToolbarInteractionStart();
            }}
          >
            <SimpleColorPicker
              onChange={(color) => {
                if (editor) {
                  selectionBeforeFocus.current = editor.state.selection;
                  editor.chain().focus().setColor(color).run();
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

        {/* Separator */}
        <div className="h-8 w-px bg-[var(--border-light)]"></div>

        {/* SECTION 3: Line Height & Letter Spacing */}

        {/* SECTION 4: Text Formatting */}
        <div className="flex items-center gap-1 px-1">
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

        {/* Separator */}

        {/* Separator */}
        <div className="h-8 w-px bg-[var(--border-light)]"></div>

        {/* SECTION 6: Text Alignment */}
        <div className="flex items-center gap-1 px-1">
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

        <div className="h-8 w-px bg-[var(--border-light)]"></div>

        <div className="flex items-center gap-3 px-1">
          {/* Line Height Control */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onToolbarInteractionStart();
            }}
            className="relative"
          >
            <div className="flex items-center gap-1">
              <UnfoldVertical size={16} />
              <ToolInput
                type="number"
                customValue={lineHeight}
                // label="Height"
                placeholder="1.5"
                className="w-12"
                onCustomChange={(value) => {
                  handleLineHeightChange(value);
                }}
              />
              {/* <div className="relative">
                <button
                  className="p-1 rounded hover:bg-[var(--bg-hover)]"
                  onClick={(e) => {
                    e.preventDefault();
                    const presetMenu = document.getElementById(
                      "line-height-presets"
                    );
                    if (presetMenu) {
                      presetMenu.style.display =
                        presetMenu.style.display === "none" ? "block" : "none";
                    }
                  }}
                >
                  <ChevronDown size={14} />
                </button>
                <div
                  id="line-height-presets"
                  className="absolute top-full left-0 mt-1 min-w-[120px] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)] rounded-[var(--radius-md)] py-2 z-50 border border-[var(--border-light)]"
                  style={{ display: "none" }}
                >
                  {lineHeightPresets.map((preset) => (
                    <div
                      key={preset}
                      className="group flex items-center gap-3 mx-1.5 px-2 py-2 cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--accent)] transition-colors duration-150"
                      onClick={(e) => {
                        e.preventDefault();
                        handleLineHeightChange(preset);
                        document.getElementById(
                          "line-height-presets"
                        ).style.display = "none";
                      }}
                    >
                      <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-white">
                        {preset}
                      </span>
                    </div>
                  ))}
                </div>
              </div> */}
            </div>
          </div>

          <div className="h-8 w-px bg-[var(--border-light)]"></div>

          {/* Letter Spacing Control */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onToolbarInteractionStart();
            }}
            className="relative"
          >
            <div className="flex items-center gap-1">
              <Space size={16} />

              <ToolInput
                type="number"
                customValue={letterSpacing}
                // label="Spacing"
                placeholder="normal"
                className="w-16"
                onCustomChange={(value) => {
                  handleLetterSpacingChange(value);
                }}
              />
              {/* <div className="relative">
                <button
                  className="p-1 rounded hover:bg-[var(--bg-hover)]"
                  onClick={(e) => {
                    e.preventDefault();
                    const presetMenu = document.getElementById(
                      "letter-spacing-presets"
                    );
                    if (presetMenu) {
                      presetMenu.style.display =
                        presetMenu.style.display === "none" ? "block" : "none";
                    }
                  }}
                >
                  <ChevronDown size={14} />
                </button>
                <div
                  id="letter-spacing-presets"
                  className="absolute top-full left-0 mt-1 min-w-[120px] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)] rounded-[var(--radius-md)] py-2 z-50 border border-[var(--border-light)]"
                  style={{ display: "none" }}
                >
                  {letterSpacingPresets.map((preset) => (
                    <div
                      key={preset}
                      className="group flex items-center gap-3 mx-1.5 px-2 py-2 cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--accent)] transition-colors duration-150"
                      onClick={(e) => {
                        e.preventDefault();
                        handleLetterSpacingChange(preset);
                        document.getElementById(
                          "letter-spacing-presets"
                        ).style.display = "none";
                      }}
                    >
                      <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-white">
                        {preset}
                      </span>
                    </div>
                  ))}
                </div>
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </BubbleMenuPortal>
  );
};

export default TextMenu;
