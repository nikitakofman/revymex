import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const SimpleEditor = () => {
  // Initialize the editor
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p>Select some text and click the Bold button.</p>",
  });

  // Function to toggle bold formatting
  const toggleBold = (e) => {
    e.preventDefault(); // Prevent focus from shifting
    if (editor) {
      editor.chain().focus().toggleBold().run();
    }
  };

  return (
    <div
      className="editor-container"
      style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}
    >
      <h1>Simple TipTap Editor POC</h1>

      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: "10px" }}>
        <button
          onMouseDown={toggleBold} // Use onMouseDown instead of onClick
          style={{
            padding: "5px 10px",
            fontWeight: editor?.isActive("bold") ? "bold" : "normal",
            background: editor?.isActive("bold") ? "#eee" : "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Bold
        </button>
      </div>

      {/* Editor */}
      <div
        className="editor-content"
        style={{
          border: "1px solid #ccc",
          borderRadius: "4px",
          padding: "10px",
          minHeight: "200px",
        }}
      >
        {editor && <EditorContent editor={editor} />}
      </div>

      {/* Debug Info */}
      <div style={{ marginTop: "20px", fontSize: "12px", color: "#666" }}>
        <h3>Debug Info:</h3>
        <p>Is Bold Active: {editor?.isActive("bold") ? "Yes" : "No"}</p>
        <p>
          Selection:{" "}
          {editor?.state.selection.empty
            ? "No selection"
            : `From ${editor?.state.selection.from} to ${editor?.state.selection.to}`}
        </p>
      </div>
    </div>
  );
};

export default SimpleEditor;
