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
import { ColorPicker } from "../../tools/_components/ColorPicker";
import { ToolInput } from "../../tools/_components/ToolInput";
import { useBuilder } from "@/builder/context/builderState";
import { Editor } from "@tiptap/react";
import { FixedSizeList as List } from "react-window";

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
}

const TextMenu = ({
  BubbleMenuPortal,
  menuPosition,
  editor,
  fontSize,
  setFontSize,
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

  useEffect(() => {
    const filtered = fonts.filter((font) =>
      font.family.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredFonts(filtered);
  }, [searchQuery, fonts]);

  useEffect(() => {
    if (showFontPicker && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showFontPicker]);

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

  const handleFontSelect = (fontFamily: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    loadFont(fontFamily);

    setTimeout(() => {
      editor.chain().focus().setMark("textStyle", { fontFamily }).run();
      setShowFontPicker(false);
    }, 50);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      fontPickerRef.current &&
      !fontPickerRef.current.contains(event.target as Node)
    ) {
      setShowFontPicker(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <BubbleMenuPortal>
      <div
        style={{
          position: "fixed",
          left: `${
            menuPosition.x * transform.scale +
            transform.x +
            contentRef.current!.getBoundingClientRect().left
          }px`,
          top: `${
            menuPosition.y * transform.scale +
            transform.y +
            contentRef.current!.getBoundingClientRect().top
          }px`,
          transform: "translateX(-50%)",
          zIndex: 50,
        }}
        className="flex text-toolbar items-center gap-1 p-1 bg-[var(--bg-surface)] rounded-lg shadow-lg border border-[var(--border-light)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5 px-1 border-r border-[var(--border-light)]">
          <div className="relative" ref={fontPickerRef}>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
              <span>
                {editor.getAttributes("textStyle").fontFamily || "Font"}
              </span>
              <ChevronDown size={14} />
            </button>

            {showFontPicker && (
              <div
                className="absolute top-full left-0 mt-1 w-80 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-lg shadow-lg z-50"
                onMouseDown={(e) => e.stopPropagation()}
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
                      onMouseDown={(e) => e.stopPropagation()}
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

          <ToolInput
            type="number"
            customValue={fontSize}
            min={8}
            max={100000}
            step={1}
            showUnit
            label="Size"
            onCustomChange={(value, unit) => {
              if (!editor) return;
              const newSize = `${value}${unit || "px"}`;
              editor.chain().focus().setFontSize(newSize).run();
              setFontSize(value.toString());
            }}
          />
        </div>

        <div className="flex items-center gap-0.5 px-1">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
              editor.isActive("bold") ? "bg-[var(--bg-hover)]" : ""
            }`}
            type="button"
          >
            <Bold size={16} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
              editor.isActive("italic") ? "bg-[var(--bg-hover)]" : ""
            }`}
            type="button"
          >
            <Italic size={16} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
              editor.isActive("underline") ? "bg-[var(--bg-hover)]" : ""
            }`}
            type="button"
          >
            <UnderlineIcon size={16} />
          </button>
        </div>

        <div className="flex items-center gap-0.5 px-1 border-l border-[var(--border-light)]">
          <button
            onMouseDown={(e) => e.preventDefault()}
            className={`p-1.5 rounded ${
              editor.isActive("color") ? "bg-[var(--bg-hover)]" : ""
            }`}
            type="button"
          >
            <ColorPicker
              onChange={(color) => editor.chain().focus().setColor(color).run()}
            />
          </button>
        </div>

        <div className="flex items-center gap-0.5 px-1 border-l border-[var(--border-light)]">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
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
