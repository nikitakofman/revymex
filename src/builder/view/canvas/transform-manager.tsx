const TransformManager = {
  // Current transform values
  transform: { x: 0, y: 0, scale: 1 },

  // Optional: DOM elements that need to be updated when transform changes
  contentElement: null,

  // List of subscribers to notify about transform changes (non-React)
  subscribers: [],

  // Initialize with optional references
  init(contentRef) {
    if (contentRef?.current) {
      this.contentElement = contentRef.current;
    }
    return this;
  },

  // Update transform values without triggering React re-renders
  updateTransform(newTransform) {
    this.transform = { ...newTransform };

    // Update DOM directly if we have a content element
    if (this.contentElement) {
      this.contentElement.style.transform = `translate3d(${this.transform.x}px, ${this.transform.y}px, 0) scale(${this.transform.scale})`;
    }

    // Notify subscribers (non-React)
    this.subscribers.forEach((callback) => callback(this.transform));

    return this.transform;
  },

  // Get current transform
  getTransform() {
    return { ...this.transform };
  },

  // Subscribe to transform changes
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  },
};

// Export the singleton
export default TransformManager;
