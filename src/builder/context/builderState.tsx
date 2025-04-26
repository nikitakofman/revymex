import React, {
  createContext,
  useCallback,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  RefObject,
} from "react";
import { NodeState } from "../reducer/nodeDispatcher";
import { DragState } from "../reducer/dragDispatcher";
import { dragInitialState, nodeInitialState } from "../reducer/state";
import { NodeDispatcher } from "../reducer/nodeDispatcher";
import { DragDispatcher } from "../reducer/dragDispatcher";
import { useNodeHistory } from "./hooks/useHistory";
import { createTrackedNodeDispatcher } from "./hooks/useNodeDispTracker";
import { useGetSelectedIds } from "./atoms/select-store";
import { useGetDynamicModeNodeId, useGetIsDragging } from "./atoms/drag-store";
import { useIsPreviewOpen } from "./atoms/interface-store";
import {
  useTransform,
  canvasOps,
  useIsMovingCanvas,
  useIsMiddleMouseDown,
} from "./atoms/canvas-interaction-store";

export interface LineIndicatorState {
  show: boolean;
  x: number;
  y: number;
  width: string | number;
  height: string | number;
}

export interface Operation {
  method: string;
  timestamp: number;
  args: any[];
  options?: any;
}

interface BuilderContextType {
  nodeState: NodeState;
  dragState: DragState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  transform: { x: number; y: number; scale: number };
  setTransform: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; scale: number }>
  >;
  setNodeStyle: (
    styles: React.CSSProperties & { src?: string } & { text?: string } & {
      backgroundImage?: string;
    } & { backgroundVideo?: string },
    nodeIds?: (string | number)[],
    sync?: boolean,
    preventUnsync?: boolean,
    preventCascade?: boolean
  ) => void;
  nodeDisp: NodeDispatcher;
  dragDisp: DragDispatcher;
  elementRef: React.RefObject<HTMLDivElement | null>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  operations: Operation[];
  clearOperations: () => void;
  startRecording: () => string;
  stopRecording: (sessionId: string) => boolean;
  dragDimensionsRef: RefObject<DragDimensions>;
  selectedIdsRef: RefObject<(string | number)[]>;
  popupRef: RefObject<HTMLDivElement | null>;
  handleWheel: (e: WheelEvent) => void;
  attachWheelListener: () => void;
  detachWheelListener: () => void;
  draggingOverCanvasRef: RefObject<boolean>;
  hasLeftViewportRef: RefObject<boolean>;
}

export interface RecordingSession {
  id: string;
  startState: NodeState;
}

interface DragDimensions {
  [nodeId: string]: { width: number; height: number };
}

// Create a separate transform manager to handle DOM updates
const TransformManager = {
  // Current state
  transform: { x: 480, y: 200, scale: 0.3 },
  contentElement: null,
  lastSyncedTransform: { x: 480, y: 200, scale: 0.3 },
  hasMovedSinceMouseDown: false,

  // Methods
  init(element) {
    this.contentElement = element;
    return this;
  },

  updateTransform(newTransform) {
    // Mark as moved if the values actually changed
    if (
      (typeof newTransform.x === "number" &&
        newTransform.x !== this.transform.x) ||
      (typeof newTransform.y === "number" &&
        newTransform.y !== this.transform.y) ||
      (typeof newTransform.scale === "number" &&
        newTransform.scale !== this.transform.scale)
    ) {
      this.hasMovedSinceMouseDown = true;
    }

    // Only update properties that are provided
    if (typeof newTransform.x === "number") this.transform.x = newTransform.x;
    if (typeof newTransform.y === "number") this.transform.y = newTransform.y;
    if (typeof newTransform.scale === "number")
      this.transform.scale = newTransform.scale;

    // Apply transform directly to DOM
    this.applyTransform();

    return { ...this.transform };
  },

  resetMovementTracking() {
    this.hasMovedSinceMouseDown = false;
  },

  applyTransform() {
    if (!this.contentElement) return;

    this.contentElement.style.willChange = "transform";
    this.contentElement.style.transform = `translate3d(${this.transform.x}px, ${this.transform.y}px, 0) scale(${this.transform.scale})`;
    this.contentElement.style.transformOrigin = "0 0";
  },

  getTransform() {
    return { ...this.transform };
  },

  syncFromReactState(reactTransform) {
    this.lastSyncedTransform = { ...reactTransform };
    this.transform = { ...reactTransform };
    this.applyTransform();
  },
};

const BuilderContext = createContext<BuilderContextType | undefined>(undefined);

export function BuilderProvider({ children }: { children: ReactNode }) {
  const {
    nodeState,
    setNodeState,
    undo,
    redo,
    canUndo,
    canRedo,
    startRecording,
    stopRecording,
  } = useNodeHistory(nodeInitialState);

  const currentSelectedIds = useGetSelectedIds();

  const getIsDragging = useGetIsDragging();

  const [dragState, setDragState] = useState(dragInitialState);

  const transform = useTransform();
  const isMovingCanvas = useIsMovingCanvas();
  const isMiddleMouseDown = useIsMiddleMouseDown();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const dragDimensionsRef = useRef<DragDimensions>({});
  const selectedIdsRef = useRef(null);
  const popupRef = useRef(null);
  const wheelHandlerAttached = useRef(false);
  const draggingOverCanvasRef = useRef(false);
  const hasLeftViewportRef = useRef(false);

  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [operations, setOperations] = useState<Operation[]>([]);

  const operationsRef = useRef<Operation[]>([]);

  const isPreviewOpen = useIsPreviewOpen();

  const onOperation = useCallback((operation: Operation) => {
    operationsRef.current = [...operationsRef.current.slice(-99), operation];
    requestAnimationFrame(() => {
      setOperations(operationsRef.current);
    });
  }, []);

  const nodeDisp = useMemo(() => {
    const dispatcher = new NodeDispatcher(setNodeState);
    return createTrackedNodeDispatcher(
      dispatcher,
      onOperation,
      process.env.NODE_ENV !== "production"
    );
  }, [setNodeState, onOperation]);

  const dragDisp = useMemo(() => new DragDispatcher(setDragState), []);

  // Initialize the TransformManager when contentRef is available
  useEffect(() => {
    if (contentRef.current) {
      TransformManager.init(contentRef.current);
      TransformManager.syncFromReactState(transform);
    }
  }, [contentRef.current]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd/Ctrl + Z first
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        // Prevent default browser behavior
        e.preventDefault();

        if (e.shiftKey) {
          // Cmd/Ctrl + Shift + Z = Redo
          redo();
          window.dispatchEvent(new Event("resize"));
        } else {
          // Cmd/Ctrl + Z = Undo
          undo();
          window.dispatchEvent(new Event("resize"));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Add these event handlers near your existing wheel handler
  const handleMouseDown = useCallback((e) => {
    // Check if it's the middle mouse button (button === 1)
    if (e.button === 1) {
      e.preventDefault();
      canvasOps.setIsMiddleMouseDown(true);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      // Reset movement tracking on mouse down
      TransformManager.resetMovementTracking();

      if (containerRef.current) {
        containerRef.current.style.cursor = "grabbing";
      }
    }
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (isMiddleMouseDown && containerRef.current && !isPreviewOpen) {
        e.preventDefault();

        // Calculate the delta from the last position
        const deltaX = e.clientX - lastMousePosRef.current.x;
        const deltaY = e.clientY - lastMousePosRef.current.y;

        // Update the last position
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        // Use TransformManager to update DOM directly
        const currentTransform = TransformManager.getTransform();
        TransformManager.updateTransform({
          x: currentTransform.x + deltaX,
          y: currentTransform.y + deltaY,
        });

        // Set isMovingCanvas directly instead of through a function
        canvasOps.setIsMovingCanvas(true);

        // Clear any existing timer
        if (moveTimerRef.current) {
          clearTimeout(moveTimerRef.current);
        }
      }
    },
    [isMiddleMouseDown, isPreviewOpen]
  );

  const handleMouseUp = useCallback(
    (e) => {
      if (e.button === 1 || isMiddleMouseDown) {
        e.preventDefault();
        canvasOps.setIsMiddleMouseDown(false);

        if (containerRef.current) {
          containerRef.current.style.cursor = "";
        }

        // Only update React state if we actually moved
        if (TransformManager.hasMovedSinceMouseDown) {
          canvasOps.setTransform(TransformManager.getTransform());
        }

        // Always reset isMovingCanvas and clear any timers
        canvasOps.setIsMovingCanvas(false);
        if (moveTimerRef.current) {
          clearTimeout(moveTimerRef.current);
          moveTimerRef.current = null;
        }

        TransformManager.resetMovementTracking();
      }
    },
    [isMiddleMouseDown]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (!containerRef.current || isPreviewOpen) return;

      // Get current transform from TransformManager
      const currentTransform = TransformManager.getTransform();

      if (e.ctrlKey || e.metaKey) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const pointX = (mouseX - currentTransform.x) / currentTransform.scale;
        const pointY = (mouseY - currentTransform.y) / currentTransform.scale;

        const delta = -e.deltaY * 0.01;
        const newScale = Math.min(
          Math.max(0.1, currentTransform.scale + delta),
          4
        );

        const newX = mouseX - pointX * newScale;
        const newY = mouseY - pointY * newScale;

        // Update via TransformManager
        TransformManager.updateTransform({
          x: newX,
          y: newY,
          scale: newScale,
        });
      } else {
        // Update via TransformManager
        TransformManager.updateTransform({
          x: currentTransform.x - e.deltaX,
          y: currentTransform.y - e.deltaY,
        });
      }

      // Temporarily set isMovingCanvas true for visual feedback
      canvasOps.setIsMovingCanvas(true);

      // Start a timer to sync React state after wheel events stop
      if (moveTimerRef.current) {
        clearTimeout(moveTimerRef.current);
      }

      moveTimerRef.current = setTimeout(() => {
        // Reset isMovingCanvas
        canvasOps.setIsMovingCanvas(false);

        // Then update React state with final position
        canvasOps.setTransform(TransformManager.getTransform());
      }, 200);
    },
    [isPreviewOpen]
  );

  // Add a safety effect to reset isMovingCanvas
  useEffect(() => {
    // Reset isMovingCanvas when mouse is released
    const handleGlobalMouseUp = () => {
      if (isMovingCanvas && !isMiddleMouseDown) {
        canvasOps.setIsMovingCanvas(false);
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isMovingCanvas, isMiddleMouseDown]);

  const attachWheelListener = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Attach your existing wheel handler
    container.addEventListener("wheel", handleWheel, { passive: false });
    wheelHandlerAttached.current = true;

    // Also attach the middle mouse handlers
    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mouseleave", handleMouseUp);
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  const detachWheelListener = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detach wheel handler
    container.removeEventListener("wheel", handleWheel);
    wheelHandlerAttached.current = false;

    // Detach middle mouse handlers
    container.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("mouseleave", handleMouseUp);
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  // Attach/detach wheel listener based on preview state
  useEffect(() => {
    if (isPreviewOpen) {
      detachWheelListener();
    } else {
      attachWheelListener();
    }

    return () => {
      detachWheelListener();
    };
  }, [isPreviewOpen, attachWheelListener, detachWheelListener]);

  // Keep TransformManager in sync with React state for non-panning operations
  useEffect(() => {
    if (!isMovingCanvas && !isMiddleMouseDown && contentRef.current) {
      // Only sync when React state changes, not during panning
      if (
        transform.x !== TransformManager.lastSyncedTransform.x ||
        transform.y !== TransformManager.lastSyncedTransform.y ||
        transform.scale !== TransformManager.lastSyncedTransform.scale
      ) {
        TransformManager.syncFromReactState(transform);
      }
    }
  }, [transform, isMovingCanvas, isMiddleMouseDown]);

  useEffect(() => {
    const isDragging = getIsDragging();

    if (isDragging) {
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
  }, [getIsDragging]);

  const setNodeStyle = useCallback(
    (
      styles: React.CSSProperties,
      nodeIds?: (string | number)[],
      sync = false,
      preventUnsync = false,
      preventCascade = preventUnsync
    ) => {
      const selectedIds = currentSelectedIds();
      const targetIds = nodeIds || selectedIds;

      if (targetIds.length > 0) {
        // NEW: Filter out text property if applying to non-text elements
        const nodesToUpdate = targetIds.map((id) => {
          const node = nodeState.nodes.find((n) => n.id === id);
          if (node && node.type !== "text" && styles.hasOwnProperty("text")) {
            // Create a new styles object without the text property
            const { text, ...filteredStyles } = styles;
            return { id, styles: filteredStyles };
          }
          return { id, styles };
        });

        const dynamicModeNodeId = getDynamicModeNodeId();

        // Update each node with appropriate styles
        nodesToUpdate.forEach(({ id, styles }) => {
          nodeDisp.updateNodeStyle(
            [id],
            styles,
            dynamicModeNodeId,
            preventUnsync,
            preventCascade
          );
        });

        // if (sync && !dragState.dynamicModeNodeId) {
        //   nodeDisp.syncViewports();
        // }
      }
    },
    [nodeDisp, getDynamicModeNodeId, nodeState.nodes]
  );

  const value: BuilderContextType = {
    nodeState,
    dragState,
    containerRef,
    contentRef,
    setNodeStyle,
    nodeDisp,
    dragDisp,
    elementRef,
    undo,
    redo,
    canUndo,
    canRedo,
    operations,
    clearOperations: useCallback(() => setOperations([]), []),
    startRecording,
    stopRecording,
    dragDimensionsRef,
    selectedIdsRef,
    popupRef,
    handleWheel,
    attachWheelListener,
    detachWheelListener,
    draggingOverCanvasRef,
    hasLeftViewportRef,
  };

  return (
    <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
  );
}

export function useBuilder() {
  const context = useContext(BuilderContext);

  if (context === undefined) {
    throw new Error("useBuilder must be used within a BuilderProvider");
  }

  return context;
}
