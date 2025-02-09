import React, { useState, useEffect, useCallback, CSSProperties } from "react";
import { ResizableWrapper } from "@/builder/context/dnd/resizable";
import { useConnect } from "@/builder/context/dnd/useConnect";
import { ElementProps } from "@/builder/types";
import { useBuilder } from "@/builder/context/builderState";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import { Color } from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import { BubbleMenuPortal } from "./BubbleMenu";

// Custom Text Transform Extension
const TextTransform = Extension.create({
  name: "textTransform",

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
          textTransform: {
            default: "none",
            parseHTML: (element) => element.style.textTransform || "none",
            renderHTML: (attributes) => {
              if (
                !attributes.textTransform ||
                attributes.textTransform === "none"
              ) {
                return {};
              }

              return {
                style: `text-transform: ${attributes.textTransform}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextTransform:
        (value: string) =>
        ({ commands }) => {
          return this.options.types.every((type) =>
            commands.updateAttributes(type, { textTransform: value })
          );
        },
    };
  },
});

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
      TextAlign.configure({
        types: ["paragraph", "heading"],
      }),
      FontFamily,
      Color,
      TextTransform,
    ],
    content: node.style.text || "Text",
    editable: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setNodeStyle({ text: html }, undefined, true);
    },
  });

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
      (elementRect.top - containerRect.top - transform.y) / transform.scale;

    return {
      x: canvasX,
      y: canvasY - 120, // Increased offset for the larger menu
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
    dragState.isDragging,
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
        {editor && shouldShowMenu() && (
          <BubbleMenuPortal
            editor={editor}
            position={menuPosition}
            contentRef={contentRef}
            transform={transform}
          />
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
