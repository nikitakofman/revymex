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
import {
  useBuilder,
  useBuilderDynamic,
  useBuilderRefs,
} from "@/builder/context/builderState";
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
import { useNodeSelected } from "@/builder/context/atoms/select-store";
import {
  useGetDynamicModeNodeId,
  useGetIsDragging,
} from "@/builder/context/atoms/drag-store";
import {
  canvasOps,
  useGetIsMovingCanvas,
  useGetIsResizing,
  useGetTransform,
  useTransform,
} from "@/builder/context/atoms/canvas-interaction-store";
import { dynamicOps } from "@/builder/context/atoms/dynamic-store";

// Add this extension to your list of extensions in TextElement.jsx

const LineHeightExtension = Extension.create({
  name: "lineHeight",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight:
        (lineHeight) =>
        ({ chain }) =>
          chain().setMark("textStyle", { lineHeight }).run(),
    };
  },
});

const LetterSpacingExtension = Extension.create({
  name: "letterSpacing",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          letterSpacing: {
            default: null,
            parseHTML: (element) => element.style.letterSpacing,
            renderHTML: (attributes) => {
              if (!attributes.letterSpacing) return {};
              return { style: `letter-spacing: ${attributes.letterSpacing}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLetterSpacing:
        (letterSpacing) =>
        ({ chain }) =>
          chain().setMark("textStyle", { letterSpacing }).run(),
    };
  },
});

// -----------------------
// SpacePreservingExtension
// -----------------------
const SpacePreservingExtension = Extension.create({
  name: "spacePreserving",

  addKeyboardShortcuts() {
    return {
      Space: ({ editor }) => {
        // Get the current cursor position
        const { from, to, empty } = editor.state.selection;

        // Only intercept if there's no selection (just a cursor)
        if (empty) {
          // Check if the previous character was a space
          const before = editor.state.doc.textBetween(
            Math.max(0, from - 1),
            from
          );

          if (before === " ") {
            // If previous character was a space, insert a non-breaking space
            editor.chain().insertContent("\u00A0").run();
            return true; // Mark as handled
          }
        }

        // Let normal space key handling occur
        return false;
      },
    };
  },

  addInputRules() {
    return [
      // This fixes the case where you paste text with multiple spaces
      {
        find: / {2,}/g,
        handler: ({ state, range, match }) => {
          const spaces = match[0];
          const spaceCount = spaces.length;

          // Create a mixture of spaces and non-breaking spaces
          const replacement = " " + "\u00A0".repeat(spaceCount - 1);

          // Create a transaction to replace the matched text
          const tr = state.tr.insertText(replacement, range.from, range.to);

          return tr;
        },
      },
    ];
  },
});

// -----------------------
// PreserveFormattingExtension
// -----------------------
const PreserveFormattingExtension = Extension.create({
  name: "preserveFormatting",
  addKeyboardShortcuts() {
    const handler = ({ editor }) => {
      const { from, to } = editor.state.selection;
      // Two conditions:
      // 1. When selection covers from near the beginning to near the end.
      // 2. When selection exactly equals the document's full range.
      const fullSelection =
        (from <= 1 && to >= editor.state.doc.content.size - 1) ||
        (from === 0 && to === editor.state.doc.nodeSize);
      if (fullSelection) {
        // Capture current active marks
        const currentMarks = editor.state.selection.$from.marks();
        // Clear all content
        editor.commands.clearContent();
        // Reapply captured marks as stored marks, so new text inherits them
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
// This extension intercepts paste events and strips formatting
const PasteHandler = Extension.create({
  name: "pasteHandler",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("pasteHandler"),
        props: {
          handlePaste: (view, event) => {
            // Get plain text from clipboard
            const text = event.clipboardData?.getData("text/plain");

            if (text) {
              // Get the current marks at the cursor position to preserve them
              const { selection, storedMarks } = view.state;
              const marks =
                storedMarks ||
                (selection.$from.marks && selection.$from.marks());

              // Create a new transaction
              const tr = view.state.tr;

              // Delete any selected content first
              if (!selection.empty) {
                tr.deleteSelection();
              }

              // Insert plain text with the current marks
              if (marks && marks.length > 0) {
                // Apply each mark to the inserted text
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
                // Just insert text without marks
                tr.insertText(text);
              }

              // Apply the transaction
              view.dispatch(tr);

              // Return true to indicate we've handled the paste
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

const preserveSpaces = (html) => {
  if (!html) return html;

  // Replace multiple spaces with non-breaking spaces (&nbsp;)
  // But keep one regular space at the beginning of each sequence
  return html.replace(/( +)/g, (match) => {
    if (match.length <= 1) return match; // Keep single spaces as-is
    // Replace all but the first space with &nbsp;
    return " " + "\u00A0".repeat(match.length - 1);
  });
};

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

  console.log(`Text re-rendering: ${node.id}`, new Date().getTime());

  const lastSelectionRef = useRef(null);
  const toolbarInteractionRef = useRef(false);
  const [fontSize, setFontSize] = useState<string>("16");
  const selectionBeforeFocus = useRef(null);
  const [displayUnit, setDisplayUnit] = useState<string>("px");
  const hasVwUnitsRef = useRef(false);
  const lastUpdatedContentRef = useRef<string | null>(null);
  const preventExitRef = useRef(true);
  const [lineHeight, setLineHeight] = useState("normal");
  const [letterSpacing, setLetterSpacing] = useState("normal");

  const getIsDragging = useGetIsDragging();
  const connect = useConnect();
  const { setNodeStyle, nodeState } = useBuilderDynamic();
  const { contentRef } = useBuilderRefs();

  const isNodeSelected = useNodeSelected(node.id);
  const getTransform = useGetTransform();
  const getIsMovingCanvas = useGetIsMovingCanvas();
  const getResizing = useGetIsResizing();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  const getParentViewportWidth = useCallback(() => {
    const parentViewportId = findParentViewport(node.parentId, nodeState.nodes);
    const viewportNode = nodeState.nodes.find((n) => n.id === parentViewportId);
    return viewportNode?.viewportWidth || window.innerWidth;
  }, [node.parentId, nodeState.nodes]);

  // Extract VW value from text element for UI display
  const extractVwValue = useCallback((html) => {
    if (!html || !html.includes("vw")) return null;

    try {
      // First check for direct vw value
      const vwMatch = html.match(/font-size:\s*([0-9.]+)vw/);
      if (vwMatch && vwMatch[1]) {
        return parseFloat(vwMatch[1]);
      }

      // Then check for data attribute
      const dataMatch = html.match(/data-vw-size:\s*([0-9.]+)vw/);
      if (dataMatch && dataMatch[1]) {
        return parseFloat(dataMatch[1]);
      }

      return null;
    } catch (error) {
      console.error("Error extracting VW value:", error);
      return null;
    }
  }, []);

  const convertUnits = useCallback(
    (value, fromUnit, toUnit, referenceWidth) => {
      if (fromUnit === toUnit) return value;

      if (fromUnit === "px" && toUnit === "vw") {
        // Convert px to vw using the reference width
        return (value / referenceWidth) * 100;
      } else if (fromUnit === "vw" && toUnit === "px") {
        // Convert vw to px using the reference width
        return (value * referenceWidth) / 100;
      }

      return value; // Default fallback
    },
    []
  );

  // Convert HTML content from VW units to PX units for editing
  const convertHtmlVwToPx = useCallback((html, viewportWidth) => {
    if (!html || !html.includes("vw") || !viewportWidth) return html;

    try {
      // Replace all vw font-size values with calculated px values
      return html.replace(/font-size:\s*([0-9.]+)vw/g, (match, vwValue) => {
        const pixelValue = (parseFloat(vwValue) * viewportWidth) / 100;
        // Store original vw value as data attribute
        return `font-size: ${Math.round(
          pixelValue
        )}px; data-vw-size: ${vwValue}vw`;
      });
    } catch (error) {
      console.error("Error converting VW to PX:", error);
      return html;
    }
  }, []);

  // Convert HTML content from PX units to VW units for saving
  const convertHtmlPxToVw = useCallback((html, viewportWidth) => {
    if (!html || !viewportWidth) return html;

    try {
      // First check for data-vw-size attributes (preferred)
      if (html.includes("data-vw-size")) {
        // Replace px values with their corresponding vw values from data attributes
        return html.replace(
          /font-size:\s*([0-9.]+)px;\s*data-vw-size:\s*([0-9.]+)vw/g,
          "font-size: $2vw"
        );
      }

      // Fallback: calculated conversion
      return html.replace(/font-size:\s*([0-9.]+)px/g, (match, pxValue) => {
        const vwValue = (parseFloat(pxValue) / viewportWidth) * 100;
        return `font-size: ${vwValue.toFixed(2)}vw`;
      });
    } catch (error) {
      console.error("Error converting PX to VW:", error);
      return html;
    }
  }, []);

  // Initialize the editor with necessary extensions
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
      LineHeightExtension, // Add this line
      LetterSpacingExtension, // Add this line
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      PreserveFormattingExtension,
      PasteHandler,
      SpacePreservingExtension,
    ],
    content:
      node.style.text && node.style.text.trim() !== ""
        ? node.style.text
        : '<p class="text-inherit"><span>Text</span></p>',
    editable: false,
    editorProps: {
      handleTextInput: (view, from, to, text) => {
        // Prevent exiting edit mode when typing
        preventExitRef.current = true;
        return false; // Let TipTap handle text input normally
      },
      transformPasted: (slice) => {
        return slice; // Return unmodified slice
      },
    },
    onUpdate: ({ editor }) => {
      // Prevent updating node style here to avoid exiting edit mode
      // We'll update in separate handlers
    },
    onSelectionUpdate: ({ editor }) => {
      if (isEditing && isNodeSelected) {
        const isEmpty = editor.state.selection.empty;
        if (!isEmpty) {
          lastSelectionRef.current = editor.state.selection;
        }
        if (isEmpty !== !hasSelection) {
          setHasSelection(!isEmpty);
        }

        // Only update if we're not in an active toolbar interaction
        if (!toolbarInteractionRef.current) {
          const attrs = editor.getAttributes("textStyle");

          // Handle font size (existing code)
          if (attrs.fontSize) {
            // Check for data-vw-size attribute first
            const vwMatch = attrs.fontSize.match(/data-vw-size:\s*([0-9.]+)vw/);
            if (vwMatch && vwMatch[1] && displayUnit === "vw") {
              // If we have a data-vw-size and are in VW mode, use it
              setFontSize(vwMatch[1]);
            } else {
              // Otherwise extract the pixel value if we're in PX mode
              if (displayUnit === "px") {
                const sizeValue = attrs.fontSize.replace(/[^\d.]/g, "") || "16";
                setFontSize(sizeValue);
              }
            }
          }

          // Extract line height
          if (attrs.lineHeight) {
            setLineHeight(attrs.lineHeight);
          }

          // Extract letter spacing
          if (attrs.letterSpacing) {
            setLetterSpacing(attrs.letterSpacing);
          }
        }
      }
    },
  });

  // Check if node has VW units when first rendering
  useEffect(() => {
    if (node.style.text) {
      const hasVwUnits = node.style.text.includes("vw");
      hasVwUnitsRef.current = hasVwUnits;

      if (hasVwUnits) {
        setDisplayUnit("vw");

        // Extract VW value for UI display
        const vwValue = extractVwValue(node.style.text);
        if (vwValue !== null) {
          setFontSize(vwValue.toFixed(2));
        }
      } else {
        setDisplayUnit("px");

        // Extract PX value for UI display
        const pxMatch = node.style.text.match(/font-size:\s*([0-9.]+)px/);
        if (pxMatch && pxMatch[1]) {
          setFontSize(pxMatch[1]);
        }
      }
    }
  }, [node.style.text, extractVwValue]);

  // Mark the initial edit as complete after a delay.
  useEffect(() => {
    if (isEditing && editor) {
      const timer = setTimeout(() => {
        setInitialEditComplete(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isEditing, editor]);

  // Function to safely update node content without exiting edit mode
  const safeUpdateNodeContent = useCallback(
    (html) => {
      if (!editor || html === lastUpdatedContentRef.current) return;

      try {
        // Store this content to prevent duplicate updates
        lastUpdatedContentRef.current = html;

        // Process the HTML based on display unit
        let finalHtml = html;
        if (displayUnit === "vw") {
          finalHtml = convertHtmlPxToVw(html, getParentViewportWidth());
        }

        finalHtml = preserveSpaces(finalHtml);

        // Update node style WITHOUT exiting edit mode
        preventExitRef.current = true;
        setNodeStyle({ text: finalHtml }, undefined, true, false, false);
      } catch (error) {
        console.error("Error in safeUpdateNodeContent:", error);
      }
    },
    [
      editor,
      displayUnit,
      convertHtmlPxToVw,
      getParentViewportWidth,
      setNodeStyle,
    ]
  );

  // Add a periodic content saver to prevent losing changes
  useEffect(() => {
    if (!isEditing || !editor) return;

    const saveInterval = setInterval(() => {
      const currentContent = editor.getHTML();
      if (
        currentContent !== lastUpdatedContentRef.current &&
        currentContent !== node.style.text
      ) {
        safeUpdateNodeContent(currentContent);
      }
    }, 2000); // Save every 2 seconds

    return () => clearInterval(saveInterval);
  }, [isEditing, editor, node.style.text, safeUpdateNodeContent]);

  // When loading node content into the editor
  useEffect(() => {
    if (editor && node.style.text && !isEditing) {
      try {
        // Reset the content tracking ref
        lastUpdatedContentRef.current = null;

        const hasVwUnits = node.style.text.includes("vw");
        hasVwUnitsRef.current = hasVwUnits;

        if (hasVwUnits) {
          // If the node has VW units, convert to PX for editing but display VW
          setDisplayUnit("vw");

          // Extract the VW value for UI display
          const vwValue = extractVwValue(node.style.text);
          if (vwValue !== null) {
            setFontSize(vwValue.toFixed(2));
          }

          // Convert to pixels for editing
          const viewportWidth = getParentViewportWidth();
          const pxContent = convertHtmlVwToPx(node.style.text, viewportWidth);

          // Set content with pixels but data-vw-size attributes
          editor.commands.setContent(pxContent);
        } else {
          // For PX content, just load as is
          setDisplayUnit("px");
          editor.commands.setContent(node.style.text);

          // Extract PX value for UI display
          const pxMatch = node.style.text.match(/font-size:\s*([0-9.]+)px/);
          if (pxMatch && pxMatch[1]) {
            setFontSize(pxMatch[1]);
          }
        }
      } catch (error) {
        console.error("Error loading node content:", error);
        editor.commands.setContent(node.style.text);
      }
    }
  }, [
    editor,
    node.style.text,
    isEditing,
    convertHtmlVwToPx,
    getParentViewportWidth,
    extractVwValue,
  ]);

  // When node is deselected, exit edit mode
  useEffect(() => {
    if (!isNodeSelected && isEditing) {
      // When exiting edit mode, convert to VW units if needed
      if (editor) {
        try {
          const currentHtml = editor.getHTML();
          if (currentHtml !== node.style.text) {
            let finalHtml = currentHtml;

            // Convert to VW if that's the display unit
            if (displayUnit === "vw") {
              finalHtml = convertHtmlPxToVw(
                currentHtml,
                getParentViewportWidth()
              );
            }

            finalHtml = preserveSpaces(finalHtml);

            // Update node with final HTML
            setNodeStyle({ text: finalHtml }, undefined, true, false, false);
          }
        } catch (error) {
          console.error("Error saving content on deselect:", error);
        }
      }

      // Exit edit mode
      setIsEditing(false);
      canvasOps.setIsEditingText(false);
      setHasSelection(false);
      setInitialEditComplete(false);

      if (editor) {
        window.getSelection()?.removeAllRanges();
        editor.setEditable(false);
      }
    }
  }, [
    isNodeSelected,
    editor,
    canvasOps.setIsEditingText,
    isEditing,
    displayUnit,
    convertHtmlPxToVw,
    getParentViewportWidth,
    setNodeStyle,
    node.style.text,
  ]);

  const handleToolbarInteractionStart = useCallback(() => {
    toolbarInteractionRef.current = true;
    preventExitRef.current = true;
  }, []);

  const handleToolbarInteractionEnd = useCallback(() => {
    setTimeout(() => {
      toolbarInteractionRef.current = false;
      if (editor && isEditing) {
        editor.view.focus();
      }
    }, 10);
  }, [editor, isEditing]);

  // Handler for font size change that works correctly with selections
  const handleFontSizeChange = useCallback(
    (value, unit) => {
      if (!editor) return;

      // Simple start of toolbar interaction
      toolbarInteractionRef.current = true;

      try {
        // Parse numeric value
        let numericValue = parseFloat(value);
        if (isNaN(numericValue)) return;

        // Get viewport width for calculations
        const viewportWidth = getParentViewportWidth();

        // Check if multi-line text
        const isMultiLine = editor.getHTML().includes("</p><p");

        // Detect unit change
        const isUnitChange = unit && unit !== displayUnit;

        // Convert the value if changing units
        if (isUnitChange) {
          if (displayUnit === "px" && unit === "vw") {
            // px to vw conversion
            numericValue = (numericValue / viewportWidth) * 100;
          } else if (displayUnit === "vw" && unit === "px") {
            // vw to px conversion
            numericValue = (numericValue * viewportWidth) / 100;
            // Cap at reasonable size
            numericValue = Math.min(numericValue, 300);
          }

          // Update unit display state
          setDisplayUnit(unit);
        }

        // Format value based on unit
        const formattedValue =
          unit === "vw" || displayUnit === "vw"
            ? numericValue.toFixed(2)
            : Math.round(numericValue).toString();

        // Update display
        setFontSize(formattedValue);

        // ====== MULTI-LINE TEXT WITH VW HANDLING ======
        // (This part is necessary from the new version)
        if (isMultiLine && (unit === "vw" || displayUnit === "vw")) {
          // Use HTML-based approach for multi-line text
          let htmlContent = editor.getHTML();

          // The unit we're using now
          const finalUnit = unit || displayUnit;

          // Format value for HTML
          const htmlValue =
            finalUnit === "vw"
              ? numericValue.toFixed(2)
              : Math.round(numericValue);

          // Replace all font sizes
          htmlContent = htmlContent.replace(
            /font-size:\s*([0-9.]+)(px|vw|em|rem|%)(?:;\s*data-vw-size:\s*[0-9.]+vw)?/g,
            `font-size: ${htmlValue}${finalUnit}`
          );

          // Save updates
          if (finalUnit === "vw") {
            setNodeStyle({ text: htmlContent }, undefined, true, false, false);
          }

          if (finalUnit !== "vw") {
            // Set content
            editor.commands.setContent(htmlContent);
          }
        }
        // ====== SINGLE-LINE TEXT & UNIT CHANGES ======
        // (This part uses the original version's simplicity)
        else {
          // For unit changes, select all text
          if (isUnitChange) {
            const docSize = editor.state.doc.content.size;
            editor.commands.setTextSelection({ from: 0, to: docSize });
          }

          // Apply font size - USING THE ORIGINAL SIMPLE APPROACH
          const finalUnit = unit || displayUnit;
          const fontSizeValue = `${formattedValue}${finalUnit}`;

          // THE KEY: Simple chain approach that works with partial selections
          editor.chain().focus().setFontSize(fontSizeValue).run();

          // Update node content
          const updatedHtml = editor.getHTML();
          setNodeStyle({ text: updatedHtml }, undefined, true, false, false);
        }
      } catch (error) {
        console.error("Error in handleFontSizeChange:", error);
      } finally {
        // End toolbar interaction with a short delay
        setTimeout(() => {
          toolbarInteractionRef.current = false;
          if (editor) editor.view.focus();
        }, 10);
      }
    },
    [editor, displayUnit, getParentViewportWidth, setNodeStyle]
  );

  // Special handler for increment/decrement changes
  const directUpdateFontSize = useCallback(
    (value, unit) => {
      if (!editor) return;

      // Start toolbar interaction
      toolbarInteractionRef.current = true;

      try {
        // Parse numeric value
        const numericValue = parseFloat(value);
        if (isNaN(numericValue)) return;

        // Get viewport width
        const viewportWidth = getParentViewportWidth();

        // Check if multi-line text
        const isMultiLine = editor.getHTML().includes("</p><p");

        // For multi-line text, use special handling
        if (isMultiLine) {
          // Format value based on unit
          const formattedValue =
            unit === "vw"
              ? Math.round(numericValue * 100) / 100 // 2 decimal places for VW
              : Math.round(numericValue); // Integer for PX

          // Get HTML content
          let updatedHtml = editor.getHTML();

          // Replace all font sizes
          updatedHtml = updatedHtml.replace(
            /font-size:\s*([0-9.]+)(px|vw|em|rem|%)(?:;\s*data-vw-size:\s*[0-9.]+vw)?/g,
            `font-size: ${formattedValue}${unit}`
          );

          // Set node style directly
          setNodeStyle({ text: updatedHtml }, undefined, true, false, false);

          // Update editor content
          if (isEditing) {
            // Prepare editor content
            let editorContent;
            if (unit === "vw") {
              // Convert VW to PX for display
              const pxEquivalent = Math.round(
                (formattedValue * viewportWidth) / 100
              );
              editorContent = updatedHtml.replace(
                /font-size:\s*([0-9.]+)vw/g,
                `font-size: ${pxEquivalent}px; data-vw-size: $1vw`
              );
            } else {
              editorContent = updatedHtml;
            }

            // Save selection
            const selection = editor.state.selection;

            // Update content
            editor.commands.setContent(editorContent);

            // Try to restore selection
            try {
              editor.view.dispatch(editor.state.tr.setSelection(selection));
              editor.view.focus();
            } catch (e) {}

            // Update UI state
            setFontSize(formattedValue.toString());
            setDisplayUnit(unit);
          }
        }
        // For single-line text
        else {
          // Format value based on unit
          const finalValue =
            unit === "vw"
              ? Math.round(numericValue * 100) / 100 // 2 decimal places for VW
              : Math.round(numericValue); // Integer for PX

          // Create font size string
          const fontSizeValue = `${finalValue}${unit}`;

          // THE KEY: Simple chain approach - use the original version's approach
          editor.chain().focus().setFontSize(fontSizeValue).run();

          // Update node style
          setTimeout(() => {
            const updatedHtml = editor.getHTML();
            setNodeStyle({ text: updatedHtml }, undefined, true, false, false);
          }, 10);

          // Update UI state
          setFontSize(finalValue.toString());
          setDisplayUnit(unit);
        }
      } catch (error) {
        console.error("Error in directUpdateFontSize:", error);
      } finally {
        // End toolbar interaction
        setTimeout(() => {
          toolbarInteractionRef.current = false;
          if (editor) editor.view.focus();
        }, 10);
      }
    },
    [editor, isEditing, getParentViewportWidth, setNodeStyle]
  );

  const handleLineHeightChange = useCallback(
    (value) => {
      if (!editor) return;

      // Start toolbar interaction
      toolbarInteractionRef.current = true;
      preventExitRef.current = true;

      try {
        // Parse value and set lineHeight state
        const lineHeightValue = value;
        setLineHeight(lineHeightValue);

        // Check if multi-line text
        const isMultiLine = editor.getHTML().includes("</p><p");

        // For multi-line text
        if (isMultiLine) {
          let htmlContent = editor.getHTML();

          // Replace all line height styles
          htmlContent = htmlContent.replace(
            /line-height:\s*([^;'"]+)/g,
            `line-height: ${lineHeightValue}`
          );

          // If no line-height found, add it to each paragraph
          if (!htmlContent.includes("line-height")) {
            htmlContent = htmlContent.replace(
              /<p([^>]*)>/g,
              `<p$1 style="line-height: ${lineHeightValue}">`
            );
          }

          // Update editor content
          editor.commands.setContent(htmlContent);

          // Save updates
          const updatedHtml = editor.getHTML();
          safeUpdateNodeContent(updatedHtml);
        } else {
          // For single-line text, use the standard approach
          editor.chain().focus().setLineHeight(lineHeightValue).run();

          // Update node content
          const updatedHtml = editor.getHTML();
          safeUpdateNodeContent(updatedHtml);
        }
      } catch (error) {
        console.error("Error in handleLineHeightChange:", error);
      } finally {
        // End toolbar interaction
        setTimeout(() => {
          toolbarInteractionRef.current = false;
          if (editor) editor.view.focus();
        }, 10);
      }
    },
    [editor, safeUpdateNodeContent]
  );

  const handleLetterSpacingChange = useCallback(
    (value) => {
      if (!editor) return;

      // Start toolbar interaction
      toolbarInteractionRef.current = true;
      preventExitRef.current = true;

      try {
        // Parse value and set letterSpacing state
        const letterSpacingValue = value;
        setLetterSpacing(letterSpacingValue);

        // Check if multi-line text
        const isMultiLine = editor.getHTML().includes("</p><p");

        // For multi-line text
        if (isMultiLine) {
          let htmlContent = editor.getHTML();

          // Replace all letter spacing styles
          htmlContent = htmlContent.replace(
            /letter-spacing:\s*([^;'"]+)/g,
            `letter-spacing: ${letterSpacingValue}`
          );

          // If no letter-spacing found, add it to spans
          if (!htmlContent.includes("letter-spacing")) {
            htmlContent = htmlContent.replace(
              /<span([^>]*)>/g,
              `<span$1 style="letter-spacing: ${letterSpacingValue}">`
            );
          }

          // Update editor content
          editor.commands.setContent(htmlContent);

          // Save updates
          const updatedHtml = editor.getHTML();
          safeUpdateNodeContent(updatedHtml);
        } else {
          // For single-line text, use the standard approach
          editor.chain().focus().setLetterSpacing(letterSpacingValue).run();

          // Update node content
          const updatedHtml = editor.getHTML();
          safeUpdateNodeContent(updatedHtml);
        }
      } catch (error) {
        console.error("Error in handleLetterSpacingChange:", error);
      } finally {
        // End toolbar interaction
        setTimeout(() => {
          toolbarInteractionRef.current = false;
          if (editor) editor.view.focus();
        }, 10);
      }
    },
    [editor, safeUpdateNodeContent]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if click is inside the text node
      const isClickInside = target.closest(`[data-node-id="${node.id}"]`);

      // If we're inside the element and edit mode was just activated, don't process this event
      if (isClickInside && preventExitRef.current) {
        return; // Skip processing this click entirely
      }

      // Expanded check for toolbar elements and input controls
      const isClickOnToolbar =
        target.closest(".text-toolbar") ||
        target.closest(".bubble-menu-container") ||
        target.closest("[class*='color-picker']") ||
        target.closest("button") ||
        target.closest("select") ||
        target.closest("input") ||
        target.closest(".Toolbar") ||
        target.closest("[class*='-toolbar']") ||
        target.closest("[class*='ToolInput']") ||
        target.closest("[class*='tool-']") ||
        target.closest("[class*='slider']") ||
        target.closest("[class*='Slider']") ||
        target.closest("[class*='panel']") ||
        target.closest("[class*='Panel']") ||
        target.closest("[class*='dropdown']") ||
        target.closest("[class*='Dropdown']") ||
        target.closest("[class*='select']") ||
        target.closest("[class*='Select']") ||
        target.closest("[class*='input']") ||
        target.closest("[class*='Input']");

      // If it's a toolbar interaction, skip everything
      if (toolbarInteractionRef.current || isClickOnToolbar) {
        return; // Return without preventing default
      }

      // Only deselect if clicking outside both the node and any toolbar element
      if (!isClickInside && !isClickOnToolbar && editor) {
        try {
          // Only update the node text if we were actually in editing mode
          if (isEditing) {
            const currentHtml = editor.getHTML();

            if (currentHtml !== node.style.text) {
              // If display unit is VW, convert to VW before saving
              let finalHtml = currentHtml;
              if (displayUnit === "vw") {
                finalHtml = convertHtmlPxToVw(
                  currentHtml,
                  getParentViewportWidth()
                );
              }

              finalHtml = preserveSpaces(finalHtml);

              // Update the node content
              setNodeStyle({ text: finalHtml }, undefined, true, false, false);
            }
          }
        } catch (error) {
          console.error("Error in handleClickOutside:", error);
        }

        // Now exit edit mode
        window.getSelection()?.removeAllRanges();
        setHasSelection(false);
        setIsEditing(false);
        canvasOps.setIsEditingText(false);
        setInitialEditComplete(false);
        editor.setEditable(false);
      }
    },
    [
      editor,
      node.id,
      node.style.text,
      setNodeStyle,
      canvasOps.setIsEditingText,
      isEditing,
      displayUnit,
      convertHtmlPxToVw,
      getParentViewportWidth,
    ]
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside, {
      capture: true,
    });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, {
        capture: true,
      });
    };
  }, [handleClickOutside]);

  const shouldShowMenu = useCallback(() => {
    const isMovingCanvas = getIsMovingCanvas();
    const isResizing = getResizing();

    const isDragging = getIsDragging();
    const isTextNode = node.type === "text";
    return (
      isNodeSelected &&
      isTextNode &&
      !isMovingCanvas &&
      !isResizing &&
      !isDragging &&
      (hasSelection || isEditing)
    );
  }, [
    isNodeSelected,
    node.type,
    getIsMovingCanvas,
    getResizing,
    getIsDragging,
    hasSelection,
    isEditing,
  ]);

  const getToolbarPosition = useCallback(() => {
    const transform = getTransform();

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
  }, [node.id, getTransform, contentRef]);

  useEffect(() => {
    if (shouldShowMenu()) {
      setMenuPosition(getToolbarPosition());
    } else {
      setMenuPosition((prev) => ({ ...prev, show: false }));
    }
  }, [shouldShowMenu, getToolbarPosition]);

  const safeSimulateSelection = useCallback((editor) => {
    if (!editor) return;

    // Store current content before selection
    const currentHTML = editor.getHTML();

    // Focus and select
    editor.commands.focus("start");
    const docSize = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: 1, to: docSize - 1 });

    // Verify content didn't get replaced
    if (editor.getHTML() !== currentHTML && currentHTML.trim() !== "") {
      // If content changed, restore it
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
          setTimeout(() => {
            safeSimulateSelection(editor);
          }, 1);
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

  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  // Handle CMD+A to modify selection range
  useEffect(() => {
    if (!editor || !isEditing) return;

    const handleCmdA = (e) => {
      // Only handle CMD+A (or CTRL+A)
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault(); // Prevent default CMD+A behavior
        preventExitRef.current = true;

        // Select from position 1 to end-1 instead of 0 to end
        // This ensures marks are preserved
        const docSize = editor.state.doc.content.size;

        // Set the selection range
        editor.commands.setTextSelection({
          from: 1,
          to: docSize - 1,
        });

        return false;
      }
    };

    document.addEventListener("keydown", handleCmdA);
    return () => document.removeEventListener("keydown", handleCmdA);
  }, [editor, isEditing]);

  // Add key event listener to prevent exiting edit mode when typing
  useEffect(() => {
    if (!editor || !isEditing) return;

    const handleKeyDown = (e) => {
      preventExitRef.current = true;
    };

    const handleKeyUp = (e) => {
      preventExitRef.current = true;

      // Save content after typing
      setTimeout(() => {
        if (editor && isEditing) {
          const currentContent = editor.getHTML();
          safeUpdateNodeContent(currentContent);
        }
      }, 100);
    };

    // Add events to editor DOM element
    const editorElement = document.querySelector(
      `[data-node-id="${node.id}"] .ProseMirror`
    );
    if (editorElement) {
      editorElement.addEventListener("keydown", handleKeyDown);
      editorElement.addEventListener("keyup", handleKeyUp);

      return () => {
        editorElement.removeEventListener("keydown", handleKeyDown);
        editorElement.removeEventListener("keyup", handleKeyUp);
      };
    }
  }, [editor, isEditing, node.id, safeUpdateNodeContent]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const dynamicModeNodeId = getDynamicModeNodeId();
      if (node.isDynamic && dynamicModeNodeId === null) {
        dynamicOps.setDynamicModeNodeId(node.id);
      } else {
        if (isNodeSelected) {
          e.stopPropagation();
          e.preventDefault();

          if (isEditing && initialEditComplete) {
            if (editor) {
              editor.view.focus();
            }
            return;
          }

          if (!isEditing) {
            try {
              // Set preventExitRef to true immediately to prevent click outside handling
              preventExitRef.current = true;

              // Reset content tracking
              lastUpdatedContentRef.current = null;

              // Check if the text has VW units
              const hasVwUnits =
                node.style.text && node.style.text.includes("vw");
              hasVwUnitsRef.current = hasVwUnits;

              if (editor) {
                if (hasVwUnits) {
                  // For VW units, we need special handling
                  setDisplayUnit("vw");

                  // Extract the VW value for the UI
                  const vwValue = extractVwValue(node.style.text);
                  if (vwValue !== null) {
                    setFontSize(vwValue.toFixed(2));
                  }

                  // Convert VW to PX for editing
                  const viewportWidth = getParentViewportWidth();
                  const pxContent = convertHtmlVwToPx(
                    node.style.text,
                    viewportWidth
                  );

                  // Set editor content with PX values + data attributes
                  editor.commands.setContent(pxContent);
                } else if (node.style.text && node.style.text.trim() !== "") {
                  // For regular PX content
                  setDisplayUnit("px");
                  editor.commands.setContent(node.style.text);

                  // Extract PX value for UI
                  const pxMatch = node.style.text.match(
                    /font-size:\s*([0-9.]+)px/
                  );
                  if (pxMatch && pxMatch[1]) {
                    setFontSize(pxMatch[1]);
                  }
                } else {
                  // Default for empty nodes
                  setDisplayUnit("px");
                  editor.commands.setContent(
                    '<p class="text-inherit"><span>Text</span></p>'
                  );
                  setFontSize("16");
                }

                // Make editor editable
                editor.setEditable(true);
              }

              // Enter edit mode
              setIsEditing(true);
              canvasOps.setIsEditingText(true);
              setInitialEditComplete(false);

              // Use a timeout to focus the editor after React has updated the DOM
              setTimeout(() => {
                if (editor) {
                  editor.view.focus();

                  // Maintain the preventExitRef flag to ensure clicks don't immediately exit
                  preventExitRef.current = true;

                  // Position cursor or select text after focusing
                  safeSimulateSelection(editor);
                }
              }, 50);

              // Keep preventExitRef true for a while to prevent mousedown events from exiting
              setTimeout(() => {
                preventExitRef.current = true;
              }, 300);
            } catch (error) {
              console.error("Error in handleDoubleClick:", error);

              // Fallback to basic edit mode
              if (editor) {
                editor.commands.setContent(
                  node.style.text ||
                    '<p class="text-inherit"><span>Text</span></p>'
                );
                editor.setEditable(true);
                setIsEditing(true);
                canvasOps.setIsEditingText(true);

                // Focus after a brief delay
                setTimeout(() => {
                  editor.view.focus();
                }, 50);
              }
            }
          }
        }
      }
    },
    [
      node,
      isNodeSelected,
      isEditing,
      initialEditComplete,
      editor,
      getDynamicModeNodeId,
      extractVwValue,
      convertHtmlVwToPx,
      getParentViewportWidth,
      canvasOps.setIsEditingText,
      safeSimulateSelection,
    ]
  );

  const handleBlur = useCallback(
    (e) => {
      // Don't exit edit mode on blur - this prevents issues when clicking toolbar
      if (toolbarInteractionRef.current) {
        e.preventDefault();
        return;
      }

      // Still save content on blur
      if (
        !editor?.view.hasFocus() &&
        !toolbarInteractionRef.current &&
        isEditing
      ) {
        const currentHtml = editor?.getHTML();

        if (currentHtml !== node.style.text) {
          try {
            // Process HTML based on display unit
            let finalHtml = currentHtml;
            if (displayUnit === "vw") {
              finalHtml = convertHtmlPxToVw(
                currentHtml,
                getParentViewportWidth()
              );
            }

            // Update node style WITHOUT exiting edit mode
            preventExitRef.current = true;
            setNodeStyle({ text: finalHtml }, undefined, true, false, false);
          } catch (error) {
            console.error("Error in handleBlur:", error);
          }
        }
      }
    },
    [
      editor,
      node.style.text,
      setNodeStyle,
      isEditing,
      displayUnit,
      convertHtmlPxToVw,
      getParentViewportWidth,
    ]
  );

  const style: CSSProperties = {
    position: "relative",
    outline: "none",
    borderRadius: "var(--radius-sm)",
    cursor: isEditing && isNodeSelected ? "text" : "default",
    minWidth: "1px",
    minHeight: "1em",
    ...node.style,
  };

  // Adjust the VW display for proper viewport visualization
  const adjustTextForViewport = useCallback(() => {
    if (!editor || !isEditing) return;

    try {
      // Check if we have VW units to process
      const hasVwUnits =
        editor.getHTML().includes("vw") ||
        editor.getHTML().includes("data-vw-size");

      if (!hasVwUnits) return;

      const viewportWidth = getParentViewportWidth();
      if (!viewportWidth) return;

      // Get the editor element DOM node
      const editorElement = document.querySelector(
        `[data-node-id="${node.id}"] .ProseMirror`
      );

      if (!editorElement) return;

      // Find all spans with font-size styling
      const spans = editorElement.querySelectorAll('span[style*="font-size"]');

      // Find all paragraphs (to handle line breaks)
      const paragraphs = editorElement.querySelectorAll("p");

      // Process both direct spans and paragraphs
      const allElements = [...spans, ...paragraphs];

      allElements.forEach((element) => {
        try {
          const style = element.getAttribute("style") || "";

          // First check for VW in style
          const vwMatch = style.match(/font-size:\s*([0-9.]+)vw/);
          if (vwMatch && vwMatch[1]) {
            const vwValue = parseFloat(vwMatch[1]);
            const pxValue = (vwValue * viewportWidth) / 100;

            // Apply pixel value for display but keep VW data
            element.style.fontSize = `${pxValue.toFixed(0)}px`;
            element.dataset.vwSize = vwValue.toString();
          }

          // Then check for data-vw-size attribute
          else if (element.dataset.vwSize) {
            const vwValue = parseFloat(element.dataset.vwSize);
            const pxValue = (vwValue * viewportWidth) / 100;

            // Just update the pixel size
            element.style.fontSize = `${pxValue.toFixed(0)}px`;
          }
        } catch (err) {
          console.error("Error processing element:", err);
        }
      });

      // Also handle any direct style attribute on the editor element itself
      if (editorElement.style.fontSize && editorElement.dataset.vwSize) {
        const vwValue = parseFloat(editorElement.dataset.vwSize);
        const pxValue = (vwValue * viewportWidth) / 100;
        editorElement.style.fontSize = `${pxValue.toFixed(0)}px`;
      }
    } catch (err) {
      console.error("Error in adjustTextForViewport:", err);
    }
  }, [editor, isEditing, node.id, getParentViewportWidth]);

  // Setup DOM observer to adjust viewport when content changes
  useEffect(() => {
    if (isEditing && displayUnit === "vw") {
      // Initial adjustment
      adjustTextForViewport();

      // Monitor for changes requiring viewport adjustment
      const observer = new MutationObserver(() => {
        adjustTextForViewport();
        preventExitRef.current = true; // Prevent edit mode exit
      });

      const editorElement = document.querySelector(
        `[data-node-id="${node.id}"] .ProseMirror`
      );

      if (editorElement) {
        observer.observe(editorElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
      }

      return () => observer.disconnect();
    }
  }, [isEditing, displayUnit, node.id, adjustTextForViewport]);

  // ===== ADD THIS TO TextElement.jsx =====

  // New method: Direct DOM-based font size adjustment for partial selections
  // This bypasses TipTap's selection handling entirely when needed
  const handleFontSizeWithDOM = useCallback(
    (value, unit) => {
      if (!editor) return;

      // Start toolbar interaction
      toolbarInteractionRef.current = true;
      preventExitRef.current = true;

      try {
        // Parse numeric value
        const numericValue = parseFloat(value);
        if (isNaN(numericValue)) return;

        // Format value based on unit
        const formattedValue =
          unit === "vw"
            ? numericValue.toFixed(2)
            : Math.round(numericValue).toString();

        // Update display in UI
        setFontSize(formattedValue);

        // Get selection information
        const selection = editor.state.selection;
        const { from, to } = selection;
        const hasPartialSelection = !selection.empty && from > 1;

        // For multi-line text with VW units, use existing special handling
        const isMultiLine = editor.getHTML().includes("</p><p");
        if (isMultiLine && (unit === "vw" || displayUnit === "vw")) {
          directUpdateFontSize(value, unit || displayUnit);
          return;
        }

        // For complete selection or unit change, use existing approach
        if (!hasPartialSelection || unit !== displayUnit) {
          if (unit !== displayUnit) {
            setDisplayUnit(unit);
          }
          directUpdateFontSize(value, unit || displayUnit);
          return;
        }

        // For partial selection, use DOM-based approach
        // This is the key to fixing the "bouncing" issue
        const editorElement = document.querySelector(
          `[data-node-id="${node.id}"] .ProseMirror`
        );
        if (!editorElement) return;

        // 1. Force browser focus on editor
        editor.view.focus();

        // 2. Create a transaction that flags we're in a special operation
        // This prevents other handlers from interfering
        editor.view.dispatch(
          editor.state.tr.setMeta("fontSizeOperation", true)
        );

        // 3. Get window selection for direct DOM manipulation
        const domSelection = window.getSelection();
        if (!domSelection || domSelection.rangeCount === 0) return;

        // 4. Get the selected range
        const range = domSelection.getRangeAt(0);
        if (!range) return;

        // 5. Create document fragment with the selected content
        const fragment = range.cloneContents();
        if (!fragment) return;

        // 6. Prepare new spans with updated styling
        const tempDiv = document.createElement("div");
        tempDiv.appendChild(fragment);

        // 7. Apply font size to all text nodes within the selection
        const spanNodes = tempDiv.querySelectorAll("span");
        if (spanNodes.length === 0) {
          // If no spans found, wrap text in span
          const newSpan = document.createElement("span");
          newSpan.style.fontSize = `${formattedValue}${unit || displayUnit}`;
          while (tempDiv.firstChild) {
            newSpan.appendChild(tempDiv.firstChild);
          }
          tempDiv.appendChild(newSpan);
        } else {
          // Update all spans in the selection
          spanNodes.forEach((span) => {
            span.style.fontSize = `${formattedValue}${unit || displayUnit}`;
          });
        }

        // 8. Replace the selected content with our modified version
        range.deleteContents();
        range.insertNode(tempDiv);

        // 9. Clean up the temporary div (unwrap it)
        while (tempDiv.firstChild) {
          tempDiv.parentNode.insertBefore(tempDiv.firstChild, tempDiv);
        }
        tempDiv.parentNode.removeChild(tempDiv);

        // 10. Update selection
        domSelection.removeAllRanges();
        domSelection.addRange(range);

        // 11. Update editor content from DOM
        // This is a key step - it synchronizes the editor state with our DOM changes
        const newContent = editorElement.innerHTML;
        editor.commands.setContent(newContent);

        // 12. Re-select the text
        setTimeout(() => {
          editor.commands.setTextSelection({ from, to });
          editor.view.focus();
        }, 0);

        // 13. Update node content
        setTimeout(() => {
          const updatedHtml = editor.getHTML();
          safeUpdateNodeContent(updatedHtml);
        }, 10);
      } catch (error) {
        console.error("Error in handleFontSizeWithDOM:", error);
      } finally {
        // End toolbar interaction with longer delay
        setTimeout(() => {
          toolbarInteractionRef.current = false;
        }, 100);
      }
    },
    [editor, node.id, displayUnit, directUpdateFontSize, safeUpdateNodeContent]
  );

  const applyFontSizeToSelection = useCallback(
    (fontSize, unit) => {
      if (!editor) return;

      // Lock toolbar interaction for the entire operation
      toolbarInteractionRef.current = true;
      preventExitRef.current = true;

      try {
        // Save current selection state
        const currentSelection = editor.state.selection;
        const hasSelection = !currentSelection.empty;

        // Parse value
        const numericValue = parseFloat(fontSize);
        if (isNaN(numericValue)) return;

        // Format value based on unit
        const formattedValue =
          unit === "vw"
            ? Math.round(numericValue * 100) / 100 // 2 decimal places for VW
            : Math.round(numericValue); // Integer for px

        // Create font size string
        const fontSizeValue = `${formattedValue}${unit}`;

        // CRITICAL: For mid-text selections, we need to:
        // 1. Create a transaction that applies the mark directly to the selection
        // 2. Dispatch the transaction manually to ensure precision
        // 3. Force focus on the editor
        if (hasSelection) {
          const { from, to } = currentSelection;

          // Create the transaction
          const tr = editor.state.tr;

          // Get any existing marks to preserve
          const currentMarks = editor.schema.marks.textStyle.create({
            ...editor.getAttributes("textStyle"),
            fontSize: fontSizeValue,
          });

          // Add the mark to the exact selection range
          tr.addMark(from, to, currentMarks);

          // Dispatch the transaction
          editor.view.dispatch(tr);

          // Force focus and restore selection
          editor.view.focus();

          // Update node style after a delay to ensure changes are processed
          setTimeout(() => {
            const updatedHtml = editor.getHTML();
            safeUpdateNodeContent(updatedHtml);
          }, 20);
        }
        // For whole-text changes, use the standard approach
        else {
          editor.chain().focus().setFontSize(fontSizeValue).run();

          // Update node content
          const updatedHtml = editor.getHTML();
          safeUpdateNodeContent(updatedHtml);
        }

        // Update UI state
        setFontSize(formattedValue.toString());
      } catch (error) {
        console.error("Error in applyFontSizeToSelection:", error);
      } finally {
        // Keep toolbar interaction flag active longer to prevent interference
        setTimeout(() => {
          toolbarInteractionRef.current = false;
          if (editor) editor.view.focus();
        }, 150); // Longer timeout to ensure stability
      }
    },
    [editor, safeUpdateNodeContent]
  );

  return (
    <ResizableWrapper node={node}>
      <div {...connect(node)} style={style} onDoubleClick={handleDoubleClick}>
        {editor && menuPosition.show && shouldShowMenu() && (
          <TextMenu
            BubbleMenuPortal={BubbleMenuPortal}
            menuPosition={menuPosition}
            editor={editor}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fontUnit={displayUnit}
            setFontUnit={setDisplayUnit}
            lineHeight={lineHeight} // Add this line
            setLineHeight={setLineHeight} // Add this line
            letterSpacing={letterSpacing} // Add this line
            setLetterSpacing={setLetterSpacing} // Add this line
            onToolbarInteractionStart={handleToolbarInteractionStart}
            onToolbarInteractionEnd={handleToolbarInteractionEnd}
            handleFontSizeChange={handleFontSizeChange}
            directUpdateFontSize={directUpdateFontSize}
            handleLineHeightChange={handleLineHeightChange} // Add this line
            handleLetterSpacingChange={handleLetterSpacingChange} // Add this line
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
              canvasOps.setIsEditingText(true);
              preventExitRef.current = true;
            }
          }}
          onMouseDown={(e) => {
            if (isEditing && isNodeSelected) {
              canvasOps.setIsEditingText(true);
              e.stopPropagation();
              preventExitRef.current = true;
            }
          }}
          onMouseUp={(e) => {
            if (isEditing && isNodeSelected) {
              e.stopPropagation();
              preventExitRef.current = true;
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
