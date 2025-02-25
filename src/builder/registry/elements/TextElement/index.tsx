import React, { useState, useEffect, useCallback, CSSProperties } from "react";
import { ResizableWrapper } from "@/builder/context/resizable";
import { useConnect } from "@/builder/context/hooks/useConnect";
import { ElementProps } from "@/builder/types";
import { useBuilder } from "@/builder/context/builderState";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import { createPortal } from "react-dom";
import TextMenu from "./TextMenu";

const FontFamilyExtension = Extension.create({
  name: "fontFamily",
  addOptions() {
    return {
      types: ["textStyle"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) =>
              element.style.fontFamily?.replace(/['"]/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontFamily) return {};
              return {
                style: `font-family: ${attributes.fontFamily}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontFamily:
        (fontFamily) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontFamily }).run();
        },
    };
  },
});

const FontSizeExtension = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
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
        (fontSize) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
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
  const [hasSelection, setHasSelection] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
    show: boolean;
  }>({
    x: 0,
    y: 0,
    show: false,
  });

  const [fontSize, setFontSize] = useState<string>("16");
  const connect = useConnect();
  const {
    setNodeStyle,
    transform,
    contentRef,
    isMovingCanvas,
    isResizing,
    dragState,
  } = useBuilder();
  const isNodeSelected = dragState.selectedIds.includes(node.id);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: "text-inherit",
          },
        },
      }),
      TextStyle.configure({ types: ["textStyle"] }),
      Underline,
      Color,
      FontSizeExtension,
      FontFamilyExtension,
      TextAlign.configure({
        types: ["paragraph", "heading"],
      }),
    ],
    content: node.style.text || "<p>Text</p>",
    editable: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== node.style.text) {
        setNodeStyle({ text: html }, undefined, true);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      if (isEditing && isNodeSelected) {
        setHasSelection(!editor.state.selection.empty);

        // Update fontSize state based on current selection
        const attrs = editor.getAttributes("textStyle");
        const size = attrs.fontSize?.replace(/[^\d.]/g, "") || "16";
        setFontSize(size);
      }
    },
  });

  useEffect(() => {
    if (editor && node.style.text && node.style.text !== editor.getHTML()) {
      editor.commands.setContent(node.style.text);
    }
  }, [editor, node.style.text]);

  useEffect(() => {
    if (!isNodeSelected) {
      setIsEditing(false);
      setHasSelection(false);
      if (editor) {
        window.getSelection()?.removeAllRanges();
        editor.setEditable(false);
      }
    }
  }, [isNodeSelected, editor]);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isClickInside = target.closest(`[data-node-id="${node.id}"]`);
      const isClickOnToolbar = target.closest(".text-toolbar");

      if (!isClickInside && !isClickOnToolbar && editor) {
        window.getSelection()?.removeAllRanges();
        setHasSelection(false);
        setIsEditing(false);
        editor.setEditable(false);

        const currentHtml = editor.getHTML();
        if (currentHtml !== node.style.text) {
          setNodeStyle({ text: currentHtml }, undefined, true);
        }
      }
    },
    [editor, node.id, node.style.text, setNodeStyle]
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  const shouldShowMenu = useCallback(() => {
    const isTextNode = node.type === "text";
    return (
      isNodeSelected &&
      isTextNode &&
      !isMovingCanvas &&
      !isResizing &&
      !dragState.isDragging &&
      (hasSelection || isEditing)
    );
  }, [
    isNodeSelected,
    node.type,
    isMovingCanvas,
    isResizing,
    dragState.isDragging,
    hasSelection,
    isEditing,
  ]);

  const getToolbarPosition = useCallback(() => {
    if (!contentRef.current) return { x: 0, y: 0, show: false };

    const elementNode = document.querySelector(`[data-node-id="${node.id}"]`);
    if (!elementNode) return { x: 0, y: 0, show: false };

    const elementRect = elementNode.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();

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

  useEffect(() => {
    if (shouldShowMenu()) {
      setMenuPosition(getToolbarPosition());
    } else {
      setMenuPosition((prev) => ({ ...prev, show: false }));
    }
  }, [shouldShowMenu, getToolbarPosition]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing && isNodeSelected);
    }
  }, [editor, isEditing, isNodeSelected]);

  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isNodeSelected) {
      e.stopPropagation();
      e.preventDefault();
      setIsEditing(true);
    }
  };

  const handleBlur = useCallback(() => {
    if (!editor?.view.hasFocus()) {
      const currentHtml = editor?.getHTML();
      if (currentHtml !== node.style.text) {
        setNodeStyle({ text: currentHtml }, undefined, true);
      }
    }
  }, [editor, node.style.text, setNodeStyle]);

  const style = {
    position: "relative",
    outline: "none",
    borderRadius: "var(--radius-sm)",
    backgroundColor:
      isEditing && isNodeSelected ? "var(--bg-hover)" : "transparent",
    cursor: isEditing && isNodeSelected ? "text" : "default",
    minWidth: "1px",
    minHeight: "1em",
    ...node.style,
  };

  return (
    <ResizableWrapper node={node}>
      <div
        {...connect(node)}
        style={style as Partial<CSSProperties>}
        onDoubleClick={handleDoubleClick}
      >
        {editor && menuPosition.show && shouldShowMenu() && (
          <TextMenu
            BubbleMenuPortal={BubbleMenuPortal}
            menuPosition={menuPosition}
            editor={editor}
            fontSize={fontSize}
            setFontSize={setFontSize}
          />
        )}
        <div
          onBlur={handleBlur}
          onMouseDown={(e) => {
            if (isEditing && isNodeSelected) {
              e.stopPropagation();
            }
          }}
          onMouseUp={(e) => {
            if (isEditing && isNodeSelected) {
              e.stopPropagation();
            }
          }}
          className="tiptap-editor"
          style={{ pointerEvents: isEditing ? "auto" : "none" }} // Add this line
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </ResizableWrapper>
  );
};

export default TextElement;
