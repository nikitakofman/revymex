import React from "react";

export const PreviewStyles = () => (
  <style>{`
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100%;
    }
    
    .preview-container {
      width: 100%;
      box-sizing: border-box;
    }
    
   .viewport-container {
  width: 100%;
  box-sizing: border-box;
  /* Remove or change min-height: 100vh to min-height: auto */
  min-height: auto;
}
    
    /* Enhanced styles for dynamic elements */
    .node-dynamic {
      // cursor: pointer !important;
      position: relative;
      transition: all 0.5s ease;
    }
    
    // .node-dynamic::after {
    //   content: '';
    //   position: absolute;
    //   top: 0;
    //   left: 0;
    //   right: 0;
    //   bottom: 0;
    //   border: 2px dashed rgba(255, 0, 255, 0.7);
    //   pointer-events: none;
    //   z-index: 9998;
    // }
    
    /* Fix for overridden background colors */
    .node-frame {
      background-color: transparent;
    }
    
    /* For any node with !important background-color, make it visible */
    [style*="background-color"] {
      background-color: attr(style);
    }
    
    /* Force video object-fit */
    video.node-video {
      object-fit: cover !important;
    }
    
    /* Improve visibility of child nodes */
    [data-has-children="true"] > div {
      position: relative;
      z-index: 1;
    }
    
    /* Debug helper */
    .node {
      position: relative;
    }
  `}</style>
);
