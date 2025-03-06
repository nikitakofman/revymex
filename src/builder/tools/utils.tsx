/**
 * Utilities for handling URLs in various formats
 */

/**
 * Extracts a clean URL from a CSS background-image value
 * @param {string} cssValue - CSS value that may contain url('...') or url("...")
 * @returns {string|null} - The extracted URL or null if not found
 */
export const extractUrlFromCssValue = (cssValue) => {
  if (!cssValue) return null;

  // Extract URL from url('...') or url("...") format
  const urlMatch = cssValue.match(/url\(['"]?(.*?)['"]?\)/i);
  return urlMatch ? urlMatch[1] : null;
};

/**
 * Gets a clean image source from a node, checking multiple possible locations
 * @param {Object} node - The node object that may contain image sources
 * @returns {string|null} - The extracted image URL or null if not found
 */
export const getNodeImageSource = (node) => {
  if (!node) return null;

  // Check direct src property
  if (node.style?.src) {
    return node.style.src;
  }

  // Check backgroundImage property
  if (node.style?.backgroundImage) {
    if (node.style.backgroundImage.includes("url(")) {
      return extractUrlFromCssValue(node.style.backgroundImage);
    }
    return node.style.backgroundImage;
  }

  // Check background property for potential URL
  if (node.style?.background && node.style.background.includes("url(")) {
    return extractUrlFromCssValue(node.style.background);
  }

  return null;
};

/**
 * Gets a clean video source from a node
 * @param {Object} node - The node object that may contain video sources
 * @returns {string|null} - The extracted video URL or null if not found
 */
export const getNodeVideoSource = (node) => {
  if (!node) return null;

  // Check direct src property
  if (node.style?.src) {
    return node.style.src;
  }

  // Check backgroundVideo property
  if (node.style?.backgroundVideo) {
    return node.style.backgroundVideo;
  }

  return null;
};

/**
 * Safely extracts an image source from a Next.js Image component in the DOM
 * @param {Element} element - DOM element that may contain a Next.js Image
 * @returns {string|null} - Extracted image source or null
 */
export const getNextImageSource = (element) => {
  if (!element) return null;

  // Find img tag within the element
  const imgElement = element.querySelector("img");
  if (!imgElement) return null;

  // Try to get src attribute
  let imgSrc = imgElement.getAttribute("src");
  if (imgSrc) return imgSrc;

  // Try srcset if no src found
  const srcset = imgElement.getAttribute("srcset");
  if (!srcset) return null;

  // Parse srcset to get the first URL
  const firstSrcMatch = srcset
    .split(",")[0]
    .trim()
    .match(/^(.*?)\s/);
  return firstSrcMatch ? firstSrcMatch[1] : null;
};
