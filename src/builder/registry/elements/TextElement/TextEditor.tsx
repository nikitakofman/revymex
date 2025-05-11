import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useBuilderRefs } from "@/builder/context/builderState";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { NodeId, useNodeStyle } from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import {
  canvasOps,
  useTransform,
  useIsEditingText,
  useEditingTextNodeId,
} from "@/builder/context/atoms/canvas-interaction-store";
import { SelectionDecoration } from "@fourwaves/tiptap-extension-selection-decoration";

// Default text content when none exists
const DEFAULT_TEXT = '<p class="text-inherit"><span>Text</span></p>';

// SOLUTION A: Extended Rich Text Style to handle multiple inline styles in one mark
const RichTextStyle = TextStyle.extend({
  name: "textStyle", // Keep the original name so Color extension works

  addAttributes() {
    return {
      // Add all inline styles we want to support
      color: {
        default: null,
        parseHTML: (element) => element.style.color,
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return { style: `color: ${attributes.color}` };
        },
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily,
        renderHTML: (attributes) => {
          if (!attributes.fontFamily) return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
      lineHeight: {
        default: null,
        parseHTML: (element) => element.style.lineHeight,
        renderHTML: (attributes) => {
          if (!attributes.lineHeight) return {};
          return { style: `line-height: ${attributes.lineHeight}` };
        },
      },
      letterSpacing: {
        default: null,
        parseHTML: (element) => element.style.letterSpacing,
        renderHTML: (attributes) => {
          if (!attributes.letterSpacing) return {};
          return { style: `letter-spacing: ${attributes.letterSpacing}` };
        },
      },
      background: {
        default: null,
        parseHTML: (element) => element.style.background,
        renderHTML: (attributes) => {
          if (!attributes.background) return {};
          return { style: `background: ${attributes.background}` };
        },
      },
      backgroundClip: {
        default: null,
        parseHTML: (element) => element.style.backgroundClip,
        renderHTML: (attributes) => {
          if (!attributes.backgroundClip) return {};
          return { style: `background-clip: ${attributes.backgroundClip}` };
        },
      },
      // For webkit browsers - important for gradient text
      WebkitBackgroundClip: {
        default: null,
        parseHTML: (element) => element.style.webkitBackgroundClip,
        renderHTML: (attributes) => {
          if (!attributes["WebkitBackgroundClip"]) return {};
          return {
            style: `-webkit-background-clip: ${attributes["WebkitBackgroundClip"]}`,
          };
        },
      },
      WebkitTextFillColor: {
        default: null,
        parseHTML: (element) => element.style.webkitTextFillColor,
        renderHTML: (attributes) => {
          if (!attributes["WebkitTextFillColor"]) return {};
          return {
            style: `-webkit-text-fill-color: ${attributes["WebkitTextFillColor"]}`,
          };
        },
      },
    };
  },

  /* Recognize all inline styles when HTML is loaded */
  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          if (!element.style) return false;

          // Must have at least one style to match
          if (
            !element.style.color &&
            !element.style.fontSize &&
            !element.style.fontFamily &&
            !element.style.lineHeight &&
            !element.style.letterSpacing
          ) {
            return false;
          }

          return {
            color: element.style.color,
            fontSize: element.style.fontSize,
            fontFamily: element.style.fontFamily,
            lineHeight: element.style.lineHeight,
            letterSpacing: element.style.letterSpacing,
            background: element.style.background,
            backgroundClip: element.style.backgroundClip,
            WebkitBackgroundClip: element.style["WebkitBackgroundClip"],
            WebkitTextFillColor: element.style["WebkitTextFillColor"],
          };
        },
      },
    ];
  },

  /* Write them back when TipTap renders */
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

/**
 * Fixed TextEditor component with proper style preservation
 */
const TextEditor = () => {
  // Get editing state
  const isEditingText = useIsEditingText();
  const editingNodeId = useEditingTextNodeId();
  const { contentRef } = useBuilderRefs();
  const transform = useTransform();

  // Get node style
  const nodeStyle = useNodeStyle(editingNodeId);

  // Shadow HTML content reference - KEY FIX for cursor jump prevention
  const shadowHtml = useRef(nodeStyle.text || DEFAULT_TEXT);

  // For positioning
  const [editorRect, setEditorRect] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  // Flag to track initialization
  const hasInitializedRef = useRef(false);

  // For continuous position monitoring
  const resizeObserverRef = useRef(null);

  // Helper for getting position
  function getCanvasLocalPos(el, canvas, scale) {
    const cRect = canvas.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    return {
      left: (eRect.left - cRect.left) / scale,
      top: (eRect.top - cRect.top) / scale,
      width: eRect.width / scale,
      height: eRect.height / scale,
    };
  }

  // Function to calculate and update editor position
  const calculatePosition = useCallback(() => {
    const el = document.querySelector(`[data-node-id="${editingNodeId}"]`);
    const canvas = contentRef.current;

    if (!el || !canvas) return;

    const { left, top, width, height } = getCanvasLocalPos(
      el,
      canvas,
      transform.scale
    );

    setEditorRect({
      left,
      top,
      width,
      height,
    });
  }, [editingNodeId, contentRef, transform.scale]);

  // Initialize editor with our enhanced RichTextStyle
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: { HTMLAttributes: { class: "text-inherit" } },
      }),
      RichTextStyle, // Using our enhanced version instead of standard TextStyle
      TextAlign.configure({
        types: ["paragraph"],
      }),
      Underline,
      SelectionDecoration.configure({
        className: "custom-selection",
      }),
    ],
    content: nodeStyle.text || DEFAULT_TEXT,
    editable: true,
    // KEY FIX: Use debounced updates for the node style
    onUpdate: ({ editor }) => {
      // Store in shadow copy - don't update state directly
      const newHTML = editor.getHTML();
      shadowHtml.current = newHTML;

      // Update node style with debounce
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        updateNodeStyle(editingNodeId, { text: newHTML });
      }, 50);
    },
    // Preserve whitespace to maintain exact formatting
    parseOptions: {
      preserveWhitespace: "full",
    },
  });

  // Timeout ref for debouncing updates
  const updateTimeoutRef = useRef(null);

  // Store editor instance in Jotai for toolbar access
  useEffect(() => {
    if (editor) {
      // Store the editor instance in the Jotai atom
      canvasOps.setTiptapEditor(editor);
    }

    return () => {
      // Clean up when component unmounts
      canvasOps.setTiptapEditor(null);

      // Clear any pending timeouts
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [editor]);

  // Initialize editor and set up observers
  useEffect(() => {
    // Initial calculation
    calculatePosition();

    // Set editor content when first initialized
    if (editor && !hasInitializedRef.current) {
      editor.commands.setContent(nodeStyle.text || DEFAULT_TEXT);
      shadowHtml.current = nodeStyle.text || DEFAULT_TEXT;
      hasInitializedRef.current = true;

      // Focus the editor
      setTimeout(() => {
        editor.commands.focus();
      }, 50);
    }

    // Set up ResizeObserver to track element size changes
    const targetElement = document.querySelector(
      `[data-node-id="${editingNodeId}"]`
    );
    if (targetElement && !resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        calculatePosition();
      });

      resizeObserverRef.current.observe(targetElement);
    }

    // Also set up event listeners for scroll and resize
    window.addEventListener("scroll", calculatePosition, true);
    window.addEventListener("resize", calculatePosition);

    // Clean up all observers and listeners
    return () => {
      window.removeEventListener("scroll", calculatePosition, true);
      window.removeEventListener("resize", calculatePosition);

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [editingNodeId, editor, calculatePosition]);

  // Reset initialization when node changes
  useEffect(() => {
    return () => {
      hasInitializedRef.current = false;
    };
  }, [editingNodeId]);

  // Update the position when nodeStyle changes (size or position changes)
  useEffect(() => {
    // Skip the first render
    if (hasInitializedRef.current) {
      calculatePosition();
    }
  }, [
    nodeStyle.width,
    nodeStyle.height,
    nodeStyle.left,
    nodeStyle.top,
    calculatePosition,
  ]);

  // Commit changes function - only called when editing ends
  const commitChanges = useCallback(() => {
    if (shadowHtml.current !== nodeStyle.text) {
      updateNodeStyle(editingNodeId, { text: shadowHtml.current });
    }
  }, [editingNodeId, nodeStyle.text]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        commitChanges();
        canvasOps.setEditingTextNodeId(null);
        canvasOps.setIsEditingText(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [commitChanges]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (editor) {
        commitChanges();
      }
    };
  }, [editor, commitChanges]);

  // Early return if not editing
  if (!isEditingText || !editingNodeId || !contentRef?.current) {
    return null;
  }

  // Portal style
  const editorPortalStyle = {
    position: "absolute",
    left: `${editorRect.left}px`,
    top: `${editorRect.top}px`,
    width: `${editorRect.width}px`,
    height: `${editorRect.height}px`,
    zIndex: 9999,
  };

  // Render editor portal
  return createPortal(
    <div data-editor-portal={editingNodeId} style={editorPortalStyle}>
      {/* Editor container - just the editor, no toolbar */}
      <div
        className="editor-container"
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        {editor && <EditorContent editor={editor} />}
      </div>
    </div>,
    contentRef.current
  );
};

export default TextEditor;
