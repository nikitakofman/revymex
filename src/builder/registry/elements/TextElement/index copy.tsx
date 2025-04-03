import React, {
  useState,
  useEffect,
  useCallback,
  CSSProperties,
  useRef,
} from "react";
import { createPortal } from "react-dom";
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
import { Plugin, PluginKey } from "prosemirror-state";
import TextMenu from "./TextMenu";
import { findParentViewport } from "@/builder/context/utils";

// -----------------------
// PreserveFormattingExtension
// -----------------------
const PreserveFormattingExtension = Extension.create({
  name: "preserveFormatting",
  addKeyboardShortcuts() {
    const handler = ({ editor }) => {
      const { from, to } = editor.state.selection;
      const fullSelection =
        (from <= 1 && to >= editor.state.doc.content.size - 1) ||
        (from === 0 && to === editor.state.doc.nodeSize);
      if (fullSelection) {
        const currentMarks = editor.state.selection.$from.marks();
        editor.commands.clearContent();
        editor.view.dispatch(editor.state.tr.setStoredMarks(currentMarks));
        return true;
      }
      return false;
    };

    return {
      Backspace: handler,
      Delete: handler,
    };
  },
});

// -----------------------
// PasteHandler Extension
// -----------------------
const PasteHandler = Extension.create({
  name: "pasteHandler",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("pasteHandler"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain");
            if (text) {
              const { selection, storedMarks } = view.state;
              const marks =
                storedMarks ||
                (selection.$from.marks && selection.$from.marks());
              const tr = view.state.tr;
              if (!selection.empty) {
                tr.deleteSelection();
              }
              if (marks && marks.length > 0) {
                const insertPosition = selection.from;
                tr.insertText(text, insertPosition);
                marks.forEach((mark) => {
                  tr.addMark(
                    insertPosition,
                    insertPosition + text.length,
                    mark
                  );
                });
              } else {
                tr.insertText(text);
              }
              view.dispatch(tr);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

// -----------------------
// FontFamily Extension
// -----------------------
const FontFamilyExtension = Extension.create({
  name: "fontFamily",
  addOptions() {
    return { types: ["textStyle"] };
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
              return { style: `font-family: ${attributes.fontFamily}` };
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
        ({ chain }) =>
          chain().setMark("textStyle", { fontFamily }).run(),
    };
  },
});

// -----------------------
// FontSize Extension
// -----------------------
const FontSizeExtension = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
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
              return { style: `font-size: ${attributes.fontSize}` };
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
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
    };
  },
});

// -----------------------
// BubbleMenu Portal for rendering into document.body
// -----------------------
const BubbleMenuPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted) return null;
  return document.body ? createPortal(children, document.body) : null;
};

// -----------------------
// TextElement Component
// -----------------------
const TextElement = ({ node }: ElementProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [initialEditComplete, setInitialEditComplete] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
    show: boolean;
  }>({
    x: 0,
    y: 0,
    show: false,
  });
  const lastSelectionRef = useRef(null);
  const toolbarInteractionRef = useRef(false);
  const [fontSize, setFontSize] = useState<string>("16");
  const selectionBeforeFocus = useRef(null);

  const connect = useConnect();
  const {
    setNodeStyle,
    transform,
    contentRef,
    isMovingCanvas,
    isResizing,
    dragState,
    dragDisp,
    isEditingText,
    setIsEditingText,
    nodeState,
  } = useBuilder();
  const isNodeSelected = dragState.selectedIds.includes(node.id);
  const [fontUnit, setFontUnit] = useState<string>("px");

  // Get simulated parent viewport width.
  const getParentViewportWidth = useCallback(() => {
    const parentViewportId = findParentViewport(node.parentId, nodeState.nodes);
    const viewportNode = nodeState.nodes.find((n) => n.id === parentViewportId);
    return viewportNode?.viewportWidth || window.innerWidth;
  }, [node.parentId, nodeState.nodes]);

  // Initialize the editor.
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: { HTMLAttributes: { class: "text-inherit" } },
      }),
      TextStyle.configure({ types: ["textStyle"] }),
      Underline,
      Color,
      FontSizeExtension,
      FontFamilyExtension,
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      PreserveFormattingExtension,
      PasteHandler,
    ],
    content:
      node.style.text && node.style.text.trim() !== ""
        ? node.style.text
        : '<p class="text-inherit"><span>Text</span></p>',
    editable: false,
    editorProps: {
      handleTextInput: (view, from, to, text) => false,
      transformPasted: (slice) => slice,
    },
    onUpdate: ({ editor }) => {
      let html = editor.getHTML();
      const originalHadVw = node.style.text && node.style.text.includes("vw");
      // If original content used VW but new content is in PX, reapply VW.
      if (originalHadVw && html.includes("px") && !html.includes("vw")) {
        html = preserveVwUnits(html);
      }
      if (html !== node.style.text && node.type === "text" && isEditing) {
        setNodeStyle({ text: html }, undefined, true, false, false);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      if (isEditing && isNodeSelected) {
        const isEmpty = editor.state.selection.empty;
        if (!isEmpty) lastSelectionRef.current = editor.state.selection;
        if (isEmpty !== !hasSelection) setHasSelection(!isEmpty);
        const attrs = editor.getAttributes("textStyle");
        if (attrs.fontSize) {
          const vwMatch = attrs.fontSize.match(/data-vw-size:\s*([0-9.]+)vw/);
          if (vwMatch && vwMatch[1]) {
            setFontSize(vwMatch[1]);
            setFontUnit("vw");
          } else {
            const sizeValue = attrs.fontSize.replace(/[^\d.]/g, "") || "16";
            setFontSize(sizeValue);
            const unitMatch = attrs.fontSize.match(/[a-z%]+$/i);
            if (unitMatch && unitMatch[0]) {
              const detectedUnit = unitMatch[0];
              if (detectedUnit === "px" || detectedUnit === "vw") {
                setFontUnit(detectedUnit);
              }
            }
          }
        }
      }
    },
  });

  // When not editing, update content (convert VW -> PX) using the simulated viewport.
  useEffect(() => {
    if (
      editor &&
      node.style.text &&
      !isEditing &&
      node.style.text.includes("vw")
    ) {
      const parentViewportId = findParentViewport(
        node.parentId,
        nodeState.nodes
      );
      const viewportNode = nodeState.nodes.find(
        (n) => n.id === parentViewportId
      );
      if (viewportNode?.viewportWidth) {
        const updatedHTML = updateVwUnitsForEditor(
          node.style.text,
          viewportNode.viewportWidth
        );
        if (updatedHTML !== editor.getHTML()) {
          editor.commands.setContent(updatedHTML);
        }
      }
    }
  }, [editor, node.style.text, nodeState.nodes, isEditing, node.parentId]);

  // Double-click to enter edit mode.
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (node.isDynamic && dragState.dynamicModeNodeId === null) {
      dragDisp.setDynamicModeNodeId(node.id);
      return;
    }
    if (isNodeSelected) {
      e.stopPropagation();
      e.preventDefault();
      if (isEditing && initialEditComplete) {
        editor?.view.focus();
        return;
      }
      if (!isEditing) {
        if (editor) {
          const currentNodeText = node.style.text;
          if (currentNodeText && currentNodeText.trim() !== "") {
            if (currentNodeText.includes("vw")) {
              editor.commands.setContent(currentNodeText);
              const vwMatch = currentNodeText.match(/font-size:\s*([0-9.]+)vw/);
              if (vwMatch && vwMatch[1]) {
                setFontSize(vwMatch[1]);
                setFontUnit("vw");
              }
            } else {
              editor.commands.setContent(currentNodeText);
            }
          } else {
            editor.commands.setContent(
              '<p class="text-inherit"><span>Text</span></p>'
            );
          }
        }
        setIsEditing(true);
        setIsEditingText(true);
        setInitialEditComplete(false);
      }
    }
  };

  // Exit edit mode when node is deselected.
  useEffect(() => {
    if (!isNodeSelected) {
      setIsEditing(false);
      setIsEditingText(false);
      setHasSelection(false);
      setInitialEditComplete(false);
      if (editor) {
        window.getSelection()?.removeAllRanges();
        editor.setEditable(false);
      }
    }
  }, [isNodeSelected, editor, setIsEditingText]);

  // Preserve selection.
  const safeSimulateSelection = useCallback((editor) => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    editor.commands.focus("start");
    const docSize = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: 1, to: docSize - 1 });
    if (editor.getHTML() !== currentHTML && currentHTML.trim() !== "") {
      editor.commands.setContent(currentHTML);
    }
    setHasSelection(true);
  }, []);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing && isNodeSelected);
      if (isEditing && isNodeSelected) {
        editor.view.focus();
        if (!initialEditComplete) {
          setTimeout(() => safeSimulateSelection(editor), 1);
        }
      }
    }
  }, [
    editor,
    isEditing,
    isNodeSelected,
    initialEditComplete,
    safeSimulateSelection,
  ]);

  // Handle CMD/CTRL+A without wiping marks.
  useEffect(() => {
    if (!editor || !isEditing) return;
    const handleCmdA = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const docSize = editor.state.doc.content.size;
        editor.commands.setTextSelection({ from: 1, to: docSize - 1 });
        return false;
      }
    };
    document.addEventListener("keydown", handleCmdA);
    return () => document.removeEventListener("keydown", handleCmdA);
  }, [editor, isEditing]);

  // Handle font size changes.
  const handleFontSizeChange = (value, unit) => {
    if (!editor) return;
    selectionBeforeFocus.current = editor.state.selection;
    const actualUnit = unit || fontUnit;
    let newValue = parseFloat(value);
    if (isNaN(newValue)) return;
    const viewportWidth = getParentViewportWidth();
    if (unit && unit !== fontUnit) {
      const convertedValue = convertUnits(
        newValue,
        fontUnit,
        unit,
        viewportWidth
      );
      newValue =
        unit === "vw"
          ? parseFloat(convertedValue.toFixed(2))
          : Math.round(convertedValue);
      setFontUnit(unit);
    }
    setFontSize(
      actualUnit === "vw"
        ? newValue.toFixed(2)
        : Math.round(newValue).toString()
    );
    if (actualUnit === "vw") {
      const pixelSize = (newValue * viewportWidth) / 100;
      editor
        .chain()
        .focus()
        .setFontSize(
          `${pixelSize.toFixed(2)}px; data-vw-size: ${newValue.toFixed(2)}vw`
        )
        .run();
    } else {
      editor.chain().focus().setFontSize(`${newValue}${actualUnit}`).run();
    }
    if (editor.state.selection.empty && selectionBeforeFocus.current) {
      editor.view.dispatch(
        editor.state.tr.setSelection(selectionBeforeFocus.current)
      );
    }
  };

  // On blur, finalize text changes.
  const handleBlur = useCallback(
    (e) => {
      if (toolbarInteractionRef.current) {
        e.preventDefault();
        return;
      }
      if (
        !editor?.view.hasFocus() &&
        !toolbarInteractionRef.current &&
        isEditing
      ) {
        const currentHtml = editor?.getHTML();
        if (currentHtml !== node.style.text) {
          setNodeStyle({ text: currentHtml }, undefined, true, false, false);
        }
      }
    },
    [editor, node.style.text, setNodeStyle, isEditing]
  );

  // Toolbar interactions.
  const handleToolbarInteractionStart = useCallback(() => {
    toolbarInteractionRef.current = true;
  }, []);

  const handleToolbarInteractionEnd = useCallback(() => {
    setTimeout(() => {
      toolbarInteractionRef.current = false;
      if (editor && isEditing) editor.view.focus();
    }, 10);
  }, [editor, isEditing]);

  // Conversion helpers.
  const convertUnits = (value, fromUnit, toUnit, referenceWidth) => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === "px" && toUnit === "vw")
      return (value / referenceWidth) * 100;
    if (fromUnit === "vw" && toUnit === "px")
      return (value * referenceWidth) / 100;
    return value;
  };

  const updateVwUnitsForEditor = (html, viewportWidth) => {
    if (!html || !html.includes("vw") || !viewportWidth) return html;
    return html.replace(/font-size:\s*([0-9.]+)vw/g, (match, vwValue) => {
      const pixelValue = (parseFloat(vwValue) * viewportWidth) / 100;
      return `font-size: ${pixelValue.toFixed(
        2
      )}px; data-vw-size: ${vwValue}vw`;
    });
  };

  const preserveVwUnits = (html) => {
    if (!html) return html;
    if (node.style.text && node.style.text.includes("vw")) {
      const vwMatches = [
        ...node.style.text.matchAll(/font-size:\s*([0-9.]+)vw/g),
      ];
      if (vwMatches.length > 0) {
        let updatedHtml = html;
        vwMatches.forEach((match) => {
          const vwValue = match[1];
          updatedHtml = updatedHtml.replace(
            /font-size:\s*([0-9.]+)px(?:;\s*data-vw-size:\s*[0-9.]+vw)?/,
            `font-size: ${vwValue}vw`
          );
        });
        return updatedHtml;
      }
    }
    if (html.includes("data-vw-size")) {
      return html.replace(
        /(font-size:\s*)([0-9.]+)px;\s*data-vw-size:\s*([0-9.]+)vw/g,
        (match, prefix, px, vw) => `${prefix}${vw}vw`
      );
    }
    return html;
  };

  // Calculate toolbar position.
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
    return { x: canvasX, y: canvasY - 10, show: true };
  }, [node.id, transform, contentRef]);

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

  useEffect(() => {
    if (shouldShowMenu()) {
      setMenuPosition(getToolbarPosition());
    } else {
      setMenuPosition((prev) => ({ ...prev, show: false }));
    }
  }, [shouldShowMenu, getToolbarPosition]);

  // Scale factor to adjust the editor when in edit mode with VW.
  const simulatedViewportWidth = getParentViewportWidth();
  const scaleFactor = simulatedViewportWidth / window.innerWidth;

  // The regular editor content.
  const editorContent = <EditorContent editor={editor} />;

  const adjustTextForViewport = useCallback(() => {
    if (!editor || !isEditing || !node.style.text.includes("vw")) return;

    try {
      const viewportWidth = getParentViewportWidth();
      const editorElement = document.querySelector(
        `[data-node-id="${node.id}"] .ProseMirror`
      );
      if (!editorElement) return;

      // Find spans with vw units
      const spans = editorElement.querySelectorAll('span[style*="vw"]');
      spans.forEach((span) => {
        const style = span.getAttribute("style") || "";
        const vwMatch = style.match(/font-size:\s*([0-9.]+)vw/);

        if (vwMatch && vwMatch[1]) {
          const vwValue = parseFloat(vwMatch[1]);
          const pxValue = (vwValue * viewportWidth) / 100;

          // Apply computed pixel value directly
          span.style.fontSize = `${pxValue}px`;
          // Store original vw value as data attribute
          span.dataset.vwSize = vwValue;
        }
      });
    } catch (err) {
      console.error("Error adjusting text for viewport:", err);
    }
  }, [editor, isEditing, node.id, node.style.text, getParentViewportWidth]);

  // Add this effect to call the function when needed
  useEffect(() => {
    if (isEditing && node.style.text?.includes("vw")) {
      // Initial adjustment
      adjustTextForViewport();

      // Set up observer to handle dynamic changes
      const observer = new MutationObserver(adjustTextForViewport);
      const editorElement = document.querySelector(
        `[data-node-id="${node.id}"] .ProseMirror`
      );

      if (editorElement) {
        observer.observe(editorElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      return () => observer.disconnect();
    }
  }, [isEditing, node.style.text, adjustTextForViewport]);

  return (
    <ResizableWrapper node={node}>
      <div
        {...connect(node)}
        style={{
          position: "relative",
          outline: "none",
          borderRadius: "var(--radius-sm)",
          cursor: isEditing && isNodeSelected ? "text" : "default",
          minWidth: "1px",
          minHeight: "1em",
          ...node.style,
        }}
        onDoubleClick={handleDoubleClick}
      >
        {editor && menuPosition.show && shouldShowMenu() && (
          <TextMenu
            BubbleMenuPortal={BubbleMenuPortal}
            menuPosition={menuPosition}
            editor={editor}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fontUnit={fontUnit}
            setFontUnit={setFontUnit}
            onToolbarInteractionStart={handleToolbarInteractionStart}
            onToolbarInteractionEnd={handleToolbarInteractionEnd}
            handleFontSizeChange={handleFontSizeChange}
            node={node}
          />
        )}
        <div
          onBlur={handleBlur}
          className="tiptap-editor"
          style={{
            pointerEvents: isEditing ? "auto" : "none",
            WebkitUserDrag: "none",
            userDrag: "none",
            WebkitUserSelect: isEditing ? "text" : "none",
            userSelect: isEditing ? "text" : "none",
          }}
          draggable={false}
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }}
          onClick={(e) => {
            if (isEditing && isNodeSelected) {
              e.stopPropagation();
              setIsEditingText(true);
            }
          }}
          onMouseDown={(e) => {
            if (isEditing && isNodeSelected) {
              setIsEditingText(true);
              e.stopPropagation();
            }
          }}
          onMouseUp={(e) => {
            if (isEditing && isNodeSelected) {
              e.stopPropagation();
            }
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </ResizableWrapper>
  );
};

export default TextElement;
