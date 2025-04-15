// StyleManager.js
// A specialized manager for direct DOM style manipulation

const StyleManager = {
  // Map of node IDs to their DOM elements
  nodeElements: new Map(),

  // Enable/disable direct updates (useful for debugging)
  directUpdatesEnabled: true,

  // Register a node's DOM element
  registerNode(nodeId, element) {
    this.nodeElements.set(nodeId, element);
    return element;
  },

  // Update node styles directly in DOM
  updateNodeStyle(nodeId, styles) {
    if (!this.directUpdatesEnabled) return false;

    const element = this.nodeElements.get(nodeId);
    if (!element) return false;

    // Apply styles directly to the DOM
    Object.entries(styles).forEach(([prop, value]) => {
      if (value === undefined || value === null) {
        element.style[prop] = "";
      } else {
        element.style[prop] = value;
      }
    });

    return true;
  },

  // Batch update multiple nodes
  batchUpdate(updates) {
    if (!this.directUpdatesEnabled) return;

    updates.forEach(({ nodeId, styles }) => {
      this.updateNodeStyle(nodeId, styles);
    });
  },

  // Get all registered elements (for debugging)
  getRegisteredNodeIds() {
    return Array.from(this.nodeElements.keys());
  },

  // Clear registration for a node
  unregisterNode(nodeId) {
    this.nodeElements.delete(nodeId);
  },

  // Enable/disable direct updates
  setDirectUpdatesEnabled(enabled) {
    this.directUpdatesEnabled = enabled;
  },
};

export default StyleManager;
