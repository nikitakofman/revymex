/**
 * TransformManager.js
 *
 * A standalone manager for canvas transform operations that decouples
 * transform state from React's rendering cycle to prevent excessive re-renders.
 */

const TransformManager = {
  // Current transform state
  transform: { x: 0, y: 0, scale: 1 },

  // Reference to the DOM element to transform
  contentElement: null,

  // List of subscribers for external components that need transform updates
  subscribers: [],

  /**
   * Initialize the manager with a DOM element
   * @param {HTMLElement} element - DOM element to transform
   * @returns {Object} - this manager for chaining
   */
  init(element) {
    this.contentElement = element;
    return this;
  },

  /**
   * Update the transform values and apply to DOM
   * This doesn't trigger React re-renders
   * @param {Object} newTransform - { x, y, scale } values
   * @returns {Object} - Current transform state
   */
  updateTransform(newTransform) {
    // Update values that are provided
    if (typeof newTransform.x === "number") this.transform.x = newTransform.x;
    if (typeof newTransform.y === "number") this.transform.y = newTransform.y;
    if (typeof newTransform.scale === "number")
      this.transform.scale = newTransform.scale;

    // Apply transform directly to DOM
    this.applyTransformToDOM();

    // Notify subscribers
    this.notifySubscribers();

    return this.getTransform();
  },

  /**
   * Apply current transform to the DOM element
   */
  applyTransformToDOM() {
    if (!this.contentElement) return;

    this.contentElement.style.transform = `translate3d(${this.transform.x}px, ${this.transform.y}px, 0) scale(${this.transform.scale})`;
    this.contentElement.style.transformOrigin = "0 0";
  },

  /**
   * Get a copy of the current transform
   * @returns {Object} - Current transform state
   */
  getTransform() {
    return { ...this.transform };
  },

  /**
   * Pan the canvas by delta amounts
   * @param {number} deltaX - X distance to pan
   * @param {number} deltaY - Y distance to pan
   * @returns {Object} - Updated transform
   */
  panCanvas(deltaX, deltaY) {
    return this.updateTransform({
      x: this.transform.x + deltaX,
      y: this.transform.y + deltaY,
    });
  },

  /**
   * Zoom the canvas with optional focus point
   * @param {number} newScale - New scale factor
   * @param {number} focusX - X coordinate of zoom focus point
   * @param {number} focusY - Y coordinate of zoom focus point
   * @returns {Object} - Updated transform
   */
  zoomCanvas(newScale, focusX = 0, focusY = 0) {
    // Calculate position adjustment to zoom toward focus point
    const x =
      focusX - (focusX - this.transform.x) * (newScale / this.transform.scale);
    const y =
      focusY - (focusY - this.transform.y) * (newScale / this.transform.scale);

    return this.updateTransform({
      x,
      y,
      scale: newScale,
    });
  },

  /**
   * Reset transform to initial state
   * @returns {Object} - Updated transform
   */
  resetTransform() {
    return this.updateTransform({ x: 0, y: 0, scale: 1 });
  },

  /**
   * Subscribe to transform changes
   * @param {Function} callback - Function to call when transform changes
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  },

  /**
   * Notify all subscribers of transform changes
   */
  notifySubscribers() {
    const transform = this.getTransform();
    this.subscribers.forEach((callback) => callback(transform));
  },
};

// Export as singleton
export default TransformManager;
