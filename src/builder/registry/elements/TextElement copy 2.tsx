import React, { useState, useEffect, useCallback, CSSProperties } from "react";
import { ResizableWrapper } from "@/builder/context/dnd/resizable";
import { useConnect } from "@/builder/context/dnd/useConnect";
import { ElementProps } from "@/builder/types";
import { useBuilder } from "@/builder/context/builderState";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { createPortal } from "react-dom";
import { ColorPicker } from "../tools/_components/ColorPicker";
import { CustomToolInput } from "../tools/_components/customToolInput";

const FontSizeExtension = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: "16px", // Default font size
            parseHTML: (element) => element.style.fontSize || "16px",
            renderHTML: (attributes) => {
              if (!attributes.fontSize || attributes.fontSize === "16px") {
                return {};
              }

              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (value: string) =>
        ({ commands }) => {
          return this.options.types.every((type) =>
            commands.updateAttributes(type, { fontSize: value })
          );
        },
    };
  },
});

const BubbleMenuPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return document.body ? createPortal(children, document.body) : null;
};

const TextElement = ({ node }: ElementProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
    show: boolean;
  }>({
    x: 0,
    y: 0,
    show: false,
  });

  const connect = useConnect();
  const {
    setNodeStyle,
    transform,
    contentRef,
    isMovingCanvas,
    isResizing,
    dragState,
  } = useBuilder();

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Underline,
      Color,
      FontSizeExtension,
      TextAlign.configure({
        types: ["paragraph", "heading"],
      }),
    ],
    content: node.style.text || "Text",
    editable: false,
    onUpdate: ({ editor }) => {
      // Always update node style with the new HTML content
      const html = editor.getHTML();
      setNodeStyle({ text: html }, undefined, true);
    },
  });

  const [fontSize, setFontSize] = useState<string>("16");

  // Add this effect to update fontSize state when editor changes
  useEffect(() => {
    if (editor) {
      const size = (
        editor.getAttributes("fontSize") ||
        editor.getAttributes("textStyle").fontSize ||
        "16px"
      ).toString();

      const numericValue = size.replace(/[^\d.]/g, "");
      setFontSize(numericValue || "16");
    }
  }, [editor]);

  const getToolbarPosition = useCallback(() => {
    if (!contentRef.current) return { x: 0, y: 0, show: false };

    const elementNode = document.querySelector(`[data-node-id="${node.id}"]`);
    if (!elementNode) return { x: 0, y: 0, show: false };

    const elementRect = elementNode.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();

    // Convert viewport coordinates to canvas coordinates
    const canvasX =
      (elementRect.left +
        elementRect.width / 2 -
        containerRect.left -
        transform.x) /
      transform.scale;
    const canvasY =
      (elementRect.top - 100 - containerRect.top - transform.y) /
      transform.scale;

    return {
      x: canvasX,
      y: canvasY - 10,
      show: true,
    };
  }, [node.id, transform, contentRef]);

  // Show menu when text node is selected or being edited
  const shouldShowMenu = useCallback(() => {
    const isNodeSelected = dragState.selectedIds.includes(node.id);
    const isTextNode = node.type === "text";
    return (
      (isNodeSelected &&
        isTextNode &&
        !isMovingCanvas &&
        !isResizing &&
        !dragState.isDragging) ||
      isEditing
    );
  }, [
    dragState.selectedIds,
    node.id,
    node.type,
    isMovingCanvas,
    isResizing,
    isEditing,
  ]);

  useEffect(() => {
    if (shouldShowMenu()) {
      setMenuPosition(getToolbarPosition());
    } else {
      setMenuPosition((prev) => ({ ...prev, show: false }));
    }
  }, [shouldShowMenu, getToolbarPosition]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [editor, isEditing]);

  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditing(true);
  };

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const style = {
    position: "relative",
    outline: "none",
    borderRadius: "var(--radius-sm)",
    backgroundColor: isEditing ? "var(--bg-hover)" : "transparent",
    cursor: isEditing ? "text" : "default",
    minWidth: "1px",
    minHeight: "1em",
    ...node.style,
  };

  const connectProps = connect(node);

  return (
    <ResizableWrapper node={node}>
      <div
        {...connectProps}
        style={{ position: "relative" }}
        onDoubleClick={handleDoubleClick}
      >
        {editor && menuPosition.show && (
          <BubbleMenuPortal>
            <div
              style={{
                position: "fixed",
                left: `${
                  menuPosition.x * transform.scale +
                  transform.x +
                  contentRef.current?.getBoundingClientRect().left
                }px`,
                top: `${
                  menuPosition.y * transform.scale +
                  transform.y +
                  contentRef.current?.getBoundingClientRect().top
                }px`,
                transform: "translateX(-50%)",
                zIndex: 50,
              }}
              className="flex items-center gap-1 p-1 bg-[var(--bg-surface)] rounded-lg shadow-lg border border-[var(--border-light)]"
            >
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
              <div className="flex items-center gap-0.5 px-1">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  className={`p-1.5 rounded ${
                    editor.isActive("color") ? "bg-[var(--bg-hover)]" : ""
                  }`}
                  type="button"
                >
                  <ColorPicker
                    onChange={(color) =>
                      editor.chain().focus().setColor(color).run()
                    }
                  />
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  className={`p-1.5 rounded ${
                    editor.isActive("color") ? "bg-[var(--bg-hover)]" : ""
                  }`}
                  type="button"
                >
                  <CustomToolInput
                    type="number"
                    customValue={fontSize}
                    min={8}
                    max={100}
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
                </button>
              </div>

              <div className="flex items-center gap-0.5 px-1 border-l border-[var(--border-light)]">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("left").run()
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("center").run()
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("right").run()
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
        )}
        <div
          style={style as Partial<CSSProperties>}
          onBlur={handleBlur}
          onMouseDown={(e) => {
            if (isEditing) {
              e.stopPropagation();
            }
          }}
          onMouseUp={(e) => {
            if (isEditing) {
              e.stopPropagation();
            }
          }}
          className="tiptap-editor"
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </ResizableWrapper>
  );
};

export default TextElement;
