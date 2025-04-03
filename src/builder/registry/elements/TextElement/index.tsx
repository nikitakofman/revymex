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

  const [fontUnit, setFontUnit] = useState<string>("px"); // New state for the font unit

  const getParentViewportWidth = useCallback(() => {
    const parentViewportId = findParentViewport(node.parentId, nodeState.nodes);
    const viewportNode = nodeState.nodes.find((n) => n.id === parentViewportId);
    return viewportNode?.viewportWidth || window.innerWidth;
  }, [node.parentId, nodeState.nodes]);

  // Initialize the editor with necessary extensions including our PreserveFormattingExtension.
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
    // Store a snapshot of current text to avoid race conditions
    content:
      node.style.text && node.style.text.trim() !== ""
        ? node.style.text
        : '<p class="text-inherit"><span>Text</span></p>',
    editable: false,

    // Add this to prevent style changes during selection
    editorProps: {
      handleTextInput: (view, from, to, text) => {
        // This preserves marks during text input
        return false; // Let TipTap handle it normally
      },
      transformPasted: (slice) => {
        // This preserves current styles during paste
        return slice; // Return unmodified slice
      },
    },
    onUpdate: ({ editor }) => {
      let html = editor.getHTML();

      // First detect if the original text had vw units
      const originalHadVw = node.style.text && node.style.text.includes("vw");

      // If the original text had vw but the current HTML has px, convert back to vw
      if (originalHadVw && html.includes("px") && !html.includes("vw")) {
        html = preserveVwUnits(html);
      }

      if (html !== node.style.text && node.type === "text" && isEditing) {
        // Only allow updates while actually editing
        // Check if this text has independent styles
        if (node.independentStyles?.text) {
          // If node has independent styles set, only update this specific node
          // without syncing to other viewports
          setNodeStyle(
            { text: html },
            undefined, // Only update this node
            true,
            false,
            false
          );
        } else {
          // Standard behavior - update and sync
          setNodeStyle(
            { text: html },
            undefined, // IMPORTANT: Only update this specific node
            true,
            false,
            false
          );
        }
      }
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

        const attrs = editor.getAttributes("textStyle");

        if (attrs.fontSize) {
          // Check if there's a data-vw-size in the fontSize attribute
          const vwMatch = attrs.fontSize.match(/data-vw-size:\s*([0-9.]+)vw/);
          if (vwMatch && vwMatch[1]) {
            // If we have a data-vw-size, use it for font size and set unit to vw
            setFontSize(vwMatch[1]);
            setFontUnit("vw");
          } else {
            // Otherwise use the px value
            const sizeValue = attrs.fontSize.replace(/[^\d.]/g, "") || "16";
            setFontSize(sizeValue);

            // Extract unit (px, vw, etc.)
            const unitMatch = attrs.fontSize.match(/[a-z%]+$/i);
            if (unitMatch && unitMatch[0]) {
              const detectedUnit = unitMatch[0];
              // Only update if it's a unit we support
              if (detectedUnit === "px" || detectedUnit === "vw") {
                setFontUnit(detectedUnit);
              }
            }
          }
        }
      }
    },
  });

  useEffect(() => {
    if (
      editor &&
      isEditing &&
      node.style.text &&
      node.style.text.includes("vw")
    ) {
      // Get the original vw values
      const vwMatches = [
        ...node.style.text.matchAll(/font-size:\s*([0-9.]+)vw/g),
      ];
      if (vwMatches && vwMatches.length > 0) {
        const vwValue = vwMatches[0][1];

        // Force the font unit to vw in the UI
        setFontUnit("vw");
        setFontSize(vwValue);

        // Force the editor content to use vw
        const currentHtml = editor.getHTML();
        if (currentHtml.includes("px") && !currentHtml.includes("vw")) {
          // Replace px with vw while maintaining the correct visual size
          const correctedHtml = currentHtml.replace(
            /font-size:\s*([0-9.]+)px/g,
            `font-size: ${vwValue}vw`
          );

          // Only update if something changed
          if (correctedHtml !== currentHtml) {
            // Store selection
            const selection = editor.state.selection;

            // Set corrected content
            editor.commands.setContent(correctedHtml);

            // Restore selection
            if (selection && !selection.empty) {
              editor.commands.setTextSelection({
                from: selection.from,
                to: selection.to,
              });
            }
          }
        }
      }
    }
  }, [editor, isEditing, node.style.text]);

  /**
   * Converts between units (px and vw) based on a reference viewport width
   * @param {number} value - The numeric value to convert
   * @param {string} fromUnit - The source unit ('px' or 'vw')
   * @param {string} toUnit - The target unit ('px' or 'vw')
   * @param {number} referenceWidth - The viewport width to use as reference
   * @returns {number} - The converted value
   */
  const convertUnits = (value, fromUnit, toUnit, referenceWidth) => {
    if (fromUnit === toUnit) return value;

    if (fromUnit === "px" && toUnit === "vw") {
      // Convert px to vw using the reference width
      return (value / referenceWidth) * 100;
    } else if (fromUnit === "vw" && toUnit === "px") {
      // Convert vw to px using the reference width
      return (value * referenceWidth) / 100;
    }

    return value; // Default fallback
  };

  // Function to intercept and update HTML content with simulated px values for vw units
  const updateVwUnitsForEditor = (html, viewportWidth) => {
    if (!html || !html.includes("vw") || !viewportWidth) return html;

    // Use regex to replace vw values with calculated px values while preserving the original vw value
    return html.replace(/font-size:\s*([0-9.]+)vw/g, (match, vwValue) => {
      const pixelValue = (parseFloat(vwValue) * viewportWidth) / 100;
      return `font-size: ${pixelValue.toFixed(
        2
      )}px; data-vw-size: ${vwValue}vw`;
    });
  };

  const preserveVwUnits = (html) => {
    if (!html) return html;

    // Even if data-vw-size isn't present, try to get vw values from the original node
    if (node.style.text && node.style.text.includes("vw")) {
      // Extract all vw values from the original text
      const vwMatches = [
        ...node.style.text.matchAll(/font-size:\s*([0-9.]+)vw/g),
      ];
      if (vwMatches && vwMatches.length > 0) {
        // For each match, replace the corresponding px value in the current HTML
        let updatedHtml = html;
        vwMatches.forEach((match) => {
          const vwValue = match[1];
          // Replace any font-size with px with the original vw value
          updatedHtml = updatedHtml.replace(
            /font-size:\s*([0-9.]+)px(?:;\s*data-vw-size:\s*[0-9.]+vw)?/,
            `font-size: ${vwValue}vw`
          );
        });
        return updatedHtml;
      }
    }

    // If we have data-vw-size attributes, use those
    if (html.includes("data-vw-size")) {
      return html.replace(
        /(font-size:\s*)([0-9.]+)px;\s*data-vw-size:\s*([0-9.]+)vw/g,
        (match, prefix, px, vw) => `${prefix}${vw}vw`
      );
    }

    return html;
  };

  // Helper function to update font-size in HTML
  const updateFontSizeInHTML = (html, newSize) => {
    // Simple replacement - you might need something more robust for complex cases
    return html.replace(/(font-size:)[^;]*/, `$1 ${newSize}`);
  };

  // Mark the initial edit as complete after a delay.
  useEffect(() => {
    if (isEditing && editor) {
      const timer = setTimeout(() => {
        setInitialEditComplete(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isEditing, editor]);

  // Sync external node content with the editor.
  useEffect(() => {
    if (editor && node.style.text) {
      // Only sync from node to editor if we're not currently editing
      // This prevents circular update issues
      if (!isEditing) {
        editor.commands.setContent(node.style.text);
      }
    }
  }, [editor, node.style.text, isEditing]);

  // When node is deselected, turn off editing.
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

  // Process vw units for the editor display
  useEffect(() => {
    if (editor && node.style.text) {
      // Find parent viewport
      const parentViewportId = findParentViewport(
        node.parentId,
        nodeState.nodes
      );
      const viewportNode = nodeState.nodes.find(
        (n) => n.id === parentViewportId
      );

      // Only process if we're not editing (to avoid cursor issues) and the content has vw units
      if (
        viewportNode?.viewportWidth &&
        !isEditing &&
        node.style.text.includes("vw")
      ) {
        // Convert vw to px for display in the editor
        const updatedHTML = updateVwUnitsForEditor(
          node.style.text,
          viewportNode.viewportWidth
        );

        // Only update if the content has changed
        if (updatedHTML !== editor.getHTML()) {
          // Check if node content is different from what the editor has
          const currentEditorHTML = editor.getHTML();

          // Only update if the node has valid content and it differs from the editor
          if (
            node.style.text.trim() !== "" &&
            currentEditorHTML !== updatedHTML
          ) {
            editor.commands.setContent(updatedHTML);
          }
        }
      }
    }
  }, [editor, node.style.text, nodeState.nodes, isEditing, node.parentId]);

  const handleToolbarInteractionStart = useCallback(() => {
    toolbarInteractionRef.current = true;
  }, []);

  const handleToolbarInteractionEnd = useCallback(() => {
    setTimeout(() => {
      toolbarInteractionRef.current = false;
      if (editor && isEditing) {
        editor.view.focus();
      }
    }, 10);
  }, [editor, isEditing]);

  // Handler for font size change that considers the parent viewport width
  const handleFontSizeChange = (value, unit) => {
    if (!editor) return;

    // Save selection before applying style
    selectionBeforeFocus.current = editor.state.selection;

    // Use the provided unit or fallback to current fontUnit
    const actualUnit = unit || fontUnit;
    let newValue = parseFloat(value);

    if (isNaN(newValue)) return;

    // Get the parent viewport width
    const viewportWidth = getParentViewportWidth();

    // If there's a unit change, convert values accordingly
    if (unit && unit !== fontUnit) {
      // Convert value to maintain visual size
      const convertedValue = convertUnits(
        newValue,
        fontUnit,
        unit,
        viewportWidth
      );

      // Format based on unit type
      if (unit === "vw") {
        newValue = parseFloat(convertedValue.toFixed(2)); // 2 decimal places for vw
      } else {
        newValue = Math.round(convertedValue); // Integer for px
      }

      // Update the font unit state
      setFontUnit(unit);
    }

    // Update font size state with proper formatting
    setFontSize(
      actualUnit === "vw"
        ? newValue.toFixed(2)
        : Math.round(newValue).toString()
    );

    // Set the font size in the editor
    if (actualUnit === "vw") {
      // For vw units, calculate the equivalent pixel size for display
      const pixelSize = (newValue * viewportWidth) / 100;
      // Apply both values - pixels for display and vw as data attribute
      editor
        .chain()
        .focus()
        .setFontSize(
          `${pixelSize.toFixed(2)}px; data-vw-size: ${newValue.toFixed(2)}vw`
        )
        .run();
    } else {
      // For other units, just apply directly
      editor.chain().focus().setFontSize(`${newValue}${actualUnit}`).run();
    }

    // Refocus and restore selection if needed
    if (editor.state.selection.empty && selectionBeforeFocus.current) {
      editor.view.dispatch(
        editor.state.tr.setSelection(selectionBeforeFocus.current)
      );
    }

    handleToolbarInteractionEnd();
  };

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if click is inside the text node
      const isClickInside = target.closest(`[data-node-id="${node.id}"]`);

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
        // CRITICAL FIX: Only update the node text if we were actually in editing mode
        // This prevents accidental updates when just selecting and then clicking away
        if (isEditing) {
          const currentHtml = editor.getHTML();
          if (currentHtml !== node.style.text) {
            // Always use the node ID to prevent updating unrelated nodes
            setNodeStyle(
              { text: currentHtml },
              undefined, // IMPORTANT: Only update this specific node
              true,
              false,
              false
            );
          }
        }

        window.getSelection()?.removeAllRanges();
        setHasSelection(false);
        setIsEditing(false);
        setIsEditingText(false);
        setInitialEditComplete(false);
        editor.setEditable(false);
      }
    },
    [
      editor,
      node.id,
      node.style.text,
      setNodeStyle,
      setIsEditingText,
      isEditing,
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
    return { x: canvasX, y: canvasY - 10, show: true };
  }, [node.id, transform, contentRef]);

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

  // Handle CMD+A to modify selection range and fix formatting preservation
  useEffect(() => {
    if (!editor || !isEditing) return;

    const handleCmdA = (e) => {
      // Only handle CMD+A (or CTRL+A)
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault(); // Prevent default CMD+A behavior

        // Select from position 1 to end-1 instead of 0 to end
        // This ensures marks are preserved as they are with Shift+Arrow
        const docSize = editor.state.doc.content.size;

        // Use the editor's commands to set the selection range
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

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (node.isDynamic && dragState.dynamicModeNodeId === null) {
      dragDisp.setDynamicModeNodeId(node.id);
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
          if (editor) {
            // IMPORTANT: Capture current state to avoid race conditions
            const currentNodeText = node.style.text;

            // Only use the editor if we have valid content
            if (currentNodeText && currentNodeText.trim() !== "") {
              // Process content for display with parent-viewport-relative vw scaling
              if (currentNodeText.includes("vw")) {
                const viewportWidth = getParentViewportWidth();
                // Convert vw to absolute px for display but keep vw in data attributes
                const processedContent = updateVwUnitsForEditor(
                  currentNodeText,
                  viewportWidth
                );

                // Apply the processed content
                editor.commands.setContent(processedContent);

                // Set UI to show vw
                const vwMatch = currentNodeText.match(
                  /font-size:\s*([0-9.]+)vw/
                );
                if (vwMatch && vwMatch[1]) {
                  setFontSize(vwMatch[1]);
                  setFontUnit("vw");
                }
              } else {
                editor.commands.setContent(currentNodeText);
              }
            } else {
              // If no valid content, set default text
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
    }
  };

  useEffect(() => {
    if (!editor || !isEditing) return;

    // Save the entire HTML when editing starts
    const originalHTML = node.style.text;

    const handleSelectionChange = () => {
      // If selection changes and HTML content remains the same,
      // it's probably just a cursor movement, not a content edit
      if (editor.getHTML() === originalHTML) {
        // Do nothing - this is important to not trigger style changes
        return;
      }
    };

    editor.on("selectionUpdate", handleSelectionChange);

    return () => {
      editor.off("selectionUpdate", handleSelectionChange);
    };
  }, [editor, isEditing, node.style.text]);

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
          setNodeStyle(
            { text: currentHtml },
            undefined, // IMPORTANT: Only update this specific node
            true,
            false,
            false
          );
        }
      }
    },
    [editor, node.style.text, setNodeStyle, isEditing]
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
      <div {...connect(node)} style={style} onDoubleClick={handleDoubleClick}>
        {editor && menuPosition.show && shouldShowMenu() && (
          <TextMenu
            BubbleMenuPortal={BubbleMenuPortal}
            menuPosition={menuPosition}
            editor={editor}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fontUnit={fontUnit} // Pass the current font unit
            setFontUnit={setFontUnit} // Pass the setter function
            onToolbarInteractionStart={handleToolbarInteractionStart}
            onToolbarInteractionEnd={handleToolbarInteractionEnd}
            handleFontSizeChange={handleFontSizeChange} // Pass our custom handler
            node={node} // Pass the node to the menu
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
              console.log("bruh");
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
