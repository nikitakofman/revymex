import React from "react";
import { Editor } from "@tiptap/react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette,
} from "lucide-react";

interface BubbleMenuProps {
  editor: Editor | null;
  position: {
    x: number;
    y: number;
    show: boolean;
  };
  contentRef: React.RefObject<HTMLDivElement>;
  transform: {
    x: number;
    y: number;
    scale: number;
  };
}

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter" },
  { label: "Arial", value: "Arial" },
  { label: "Helvetica", value: "Helvetica" },
];

const WEIGHT_OPTIONS = [
  { label: "400", value: "400" },
  { label: "500", value: "500" },
  { label: "600", value: "600" },
];

const COLORS = [
  "#000000",
  "#666666",
  "#0047FF",
  "#00BA88",
  "#F5A623",
  "#F44771",
];

export const BubbleMenuPortal = React.memo(
  ({ editor, position, contentRef, transform }: BubbleMenuProps) => {
    const [mounted, setMounted] = React.useState(false);
    const [showColorPicker, setShowColorPicker] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
      return () => setMounted(false);
    }, []);

    if (!mounted || !editor || !position.show) return null;

    const handleToolClick = (e: React.MouseEvent, callback: () => void) => {
      e.preventDefault();
      e.stopPropagation();
      callback();
    };

    const handleInputChange = (
      e: React.ChangeEvent<HTMLInputElement>,
      type: string
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const value = e.target.value;
      if (value && !isNaN(parseFloat(value))) {
        editor
          .chain()
          .focus()
          .setMark(type, value + (type === "fontSize" ? "px" : ""))
          .run();
      }
    };

    const handleSelectChange = (
      e: React.ChangeEvent<HTMLSelectElement>,
      type: string
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const value = e.target.value;
      if (type === "fontFamily") {
        editor.chain().focus().setFontFamily(value).run();
      } else if (type === "fontWeight") {
        editor.chain().focus().setFontWeight(value).run();
      }
    };

    return createPortal(
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left:
            position.x * transform.scale +
            transform.x +
            contentRef.current?.getBoundingClientRect().left,
          top:
            position.y * transform.scale +
            transform.y +
            contentRef.current?.getBoundingClientRect().top,
          transform: "translate(-50%, -100%)",
          zIndex: 50,
        }}
        className="flex items-center gap-0.5 p-1 bg-[var(--bg-surface)] rounded-md shadow-lg border border-[var(--border-light)]"
      >
        <select
          className="h-5 w-14 text-xs px-0.5 rounded border border-[var(--border-light)] bg-transparent"
          value={editor.getAttributes("textStyle").fontFamily}
          onChange={(e) => handleSelectChange(e, "fontFamily")}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <option value="">Font</option>
          {FONT_OPTIONS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        <select
          className="h-5 w-12 text-xs px-0.5 rounded border border-[var(--border-light)] bg-transparent"
          value={editor.getAttributes("textStyle").fontWeight}
          onChange={(e) => handleSelectChange(e, "fontWeight")}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {WEIGHT_OPTIONS.map((weight) => (
            <option key={weight.value} value={weight.value}>
              {weight.label}
            </option>
          ))}
        </select>

        <input
          type="number"
          className="h-5 w-10 text-xs px-0.5 rounded border border-[var(--border-light)] bg-transparent"
          placeholder="px"
          onChange={(e) => handleInputChange(e, "fontSize")}
          defaultValue={editor
            .getAttributes("textStyle")
            .fontSize?.replace("px", "")}
          onMouseDown={(e) => e.stopPropagation()}
        />

        <div className="w-px h-3 mx-0.5 bg-[var(--border-light)]" />

        <button
          onMouseDown={(e) =>
            handleToolClick(e, () => editor.chain().focus().toggleBold().run())
          }
          className={`p-0.5 rounded hover:bg-[var(--bg-hover)] ${
            editor.isActive("bold") ? "bg-[var(--bg-hover)]" : ""
          }`}
          type="button"
        >
          <Bold size={13} />
        </button>

        <button
          onMouseDown={(e) =>
            handleToolClick(e, () =>
              editor.chain().focus().toggleItalic().run()
            )
          }
          className={`p-0.5 rounded hover:bg-[var(--bg-hover)] ${
            editor.isActive("italic") ? "bg-[var(--bg-hover)]" : ""
          }`}
          type="button"
        >
          <Italic size={13} />
        </button>

        <button
          onMouseDown={(e) =>
            handleToolClick(e, () =>
              editor.chain().focus().toggleUnderline().run()
            )
          }
          className={`p-0.5 rounded hover:bg-[var(--bg-hover)] ${
            editor.isActive("underline") ? "bg-[var(--bg-hover)]" : ""
          }`}
          type="button"
        >
          <UnderlineIcon size={13} />
        </button>

        <div className="w-px h-3 mx-0.5 bg-[var(--border-light)]" />

        <div className="relative">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowColorPicker(!showColorPicker);
            }}
            className="p-0.5 rounded hover:bg-[var(--bg-hover)]"
            type="button"
          >
            <Palette size={13} />
          </button>
          {showColorPicker && (
            <div
              className="absolute top-full left-0 mt-1 p-1 bg-[var(--bg-surface)] rounded shadow-lg border border-[var(--border-light)] grid grid-cols-3 gap-1"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {COLORS.map((color) => (
                <button
                  key={color}
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: color }}
                  onMouseDown={(e) =>
                    handleToolClick(e, () => {
                      editor.chain().focus().setColor(color).run();
                      setShowColorPicker(false);
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-3 mx-0.5 bg-[var(--border-light)]" />

        <button
          onMouseDown={(e) =>
            handleToolClick(e, () =>
              editor.chain().focus().setTextAlign("left").run()
            )
          }
          className={`p-0.5 rounded hover:bg-[var(--bg-hover)] ${
            editor.isActive({ textAlign: "left" }) ? "bg-[var(--bg-hover)]" : ""
          }`}
          type="button"
        >
          <AlignLeft size={13} />
        </button>

        <button
          onMouseDown={(e) =>
            handleToolClick(e, () =>
              editor.chain().focus().setTextAlign("center").run()
            )
          }
          className={`p-0.5 rounded hover:bg-[var(--bg-hover)] ${
            editor.isActive({ textAlign: "center" })
              ? "bg-[var(--bg-hover)]"
              : ""
          }`}
          type="button"
        >
          <AlignCenter size={13} />
        </button>

        <button
          onMouseDown={(e) =>
            handleToolClick(e, () =>
              editor.chain().focus().setTextAlign("right").run()
            )
          }
          className={`p-0.5 rounded hover:bg-[var(--bg-hover)] ${
            editor.isActive({ textAlign: "right" })
              ? "bg-[var(--bg-hover)]"
              : ""
          }`}
          type="button"
        >
          <AlignRight size={13} />
        </button>

        <button
          onMouseDown={(e) =>
            handleToolClick(e, () =>
              editor.chain().focus().setTextAlign("justify").run()
            )
          }
          className={`p-0.5 rounded hover:bg-[var(--bg-hover)] ${
            editor.isActive({ textAlign: "justify" })
              ? "bg-[var(--bg-hover)]"
              : ""
          }`}
          type="button"
        >
          <AlignJustify size={13} />
        </button>
      </div>,
      document.body
    );
  }
);

BubbleMenuPortal.displayName = "BubbleMenuPortal";
