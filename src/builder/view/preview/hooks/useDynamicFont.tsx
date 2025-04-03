import { useEffect } from "react";

const useDynamicFontLoader = (nodes) => {
  useEffect(() => {
    // Extract unique fonts from nodes
    const uniqueFonts = new Set();
    nodes.forEach((node) => {
      // Assume text nodes include a fontFamily property
      if (node.type === "text" && node.style?.fontFamily) {
        uniqueFonts.add(node.style.fontFamily);
      }
      // Alternatively, if the font is in an HTML string, you might parse it out here.
    });

    console.log("Unique fonts:", uniqueFonts);

    if (uniqueFonts.size > 0) {
      // Build a query string for all fonts
      const familiesQuery = Array.from(uniqueFonts)
        .map(
          (font) => `family=${font.replace(/\s+/g, "+")}:wght@400;500;600;700`
        )
        .join("&");

      const linkHref = `https://fonts.googleapis.com/css2?${familiesQuery}&display=swap`;

      // Check if the link is already added
      if (!document.querySelector(`link[href*="${familiesQuery}"]`)) {
        const link = document.createElement("link");
        link.href = linkHref;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
    }
  }, [nodes]);
};

export default useDynamicFontLoader;
