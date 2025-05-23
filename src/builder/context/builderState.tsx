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
import {
  dragInitialState,
  interfaceInitialState,
  nodeInitialState,
} from "../reducer/state";
import { NodeDispatcher } from "../reducer/nodeDispatcher";
import { DragDispatcher } from "../reducer/dragDispatcher";
import { debounce } from "lodash";
import { useNodeHistory } from "./hooks/useHistory";
import { createTrackedNodeDispatcher } from "./hooks/useNodeDispTracker";
import {
  InterfaceDispatcher,
  InterfaceState,
} from "../reducer/interfaceDispatcher";

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
  isMovingCanvas: boolean;
  setIsMovingCanvas: React.Dispatch<React.SetStateAction<boolean>>;
  elementRef: React.RefObject<HTMLDivElement | null>;
  isResizing: boolean;
  setIsResizing: React.Dispatch<React.SetStateAction<boolean>>;
  isAdjustingGap: boolean;
  setIsAdjustingGap: React.Dispatch<React.SetStateAction<boolean>>;
  isRotating: boolean;
  setIsRotating: React.Dispatch<React.SetStateAction<boolean>>;
  isAdjustingBorderRadius: boolean;
  setIsAdjustingBorderRadius: React.Dispatch<React.SetStateAction<boolean>>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  operations: Operation[];
  clearOperations: () => void;
  startRecording: () => string;
  stopRecording: (sessionId: string) => boolean;
  interfaceState: InterfaceState;
  interfaceDisp: InterfaceDispatcher;
  dragDimensionsRef: RefObject<DragDimensions>;
  selectedIdsRef: RefObject<(string | number)[]>;
  isFrameModeActive: boolean;
  setIsFrameModeActive: React.Dispatch<React.SetStateAction<boolean>>;
  isTextModeActive: boolean;
  setIsTextModeActive: React.Dispatch<React.SetStateAction<boolean>>;
  isMoveCanvasMode: boolean;
  setIsMoveCanvasMode: React.Dispatch<React.SetStateAction<boolean>>;
  popupRef: RefObject<HTMLDivElement | null>;
  handleWheel: (e: WheelEvent) => void;
  attachWheelListener: () => void;
  detachWheelListener: () => void;
  draggingOverCanvasRef: RefObject<boolean>;
  hasLeftViewportRef: RefObject<boolean>;
  isEditingText: boolean;
  setIsEditingText: React.Dispatch<React.SetStateAction<boolean>>;
  isFontSizeHandleActive: boolean;
  setIsFontSizeHandleActive: React.Dispatch<React.SetStateAction<boolean>>;
  isMiddleMouseDown: boolean;
  isDraggingChevrons: boolean;
  setIsDraggingChevrons: React.Dispatch<React.SetStateAction<boolean>>;
  isTextMenuOpen: boolean;
  setIsTextMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
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

  const [dragState, setDragState] = useState(dragInitialState);
  const [interfaceState, setInterfaceState] = useState(interfaceInitialState);
  const [isFrameModeActive, setIsFrameModeActive] = useState(false);
  const [isTextModeActive, setIsTextModeActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 480, y: 200, scale: 0.3 });
  const [isMovingCanvas, setIsMovingCanvas] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isAdjustingGap, setIsAdjustingGap] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isTextMenuOpen, setIsTextMenuOpen] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [isAdjustingBorderRadius, setIsAdjustingBorderRadius] = useState(false);
  const [isFontSizeHandleActive, setIsFontSizeHandleActive] = useState(false);
  const [isDraggingChevrons, setIsDraggingChevrons] = useState(false);
  const dragDimensionsRef = useRef<DragDimensions>({});
  const selectedIdsRef = useRef(null);
  const popupRef = useRef(null);
  const wheelHandlerAttached = useRef(false);
  const draggingOverCanvasRef = useRef(false);
  const hasLeftViewportRef = useRef(false);

  const [isMoveCanvasMode, setIsMoveCanvasMode] = useState(false);

  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [operations, setOperations] = useState<Operation[]>([]);

  const operationsRef = useRef<Operation[]>([]);

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

  const interfaceDisp = useMemo(
    () => new InterfaceDispatcher(setInterfaceState),
    []
  );

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

  const debouncedSetTransform = useMemo(
    () =>
      debounce((newTransform: { x: number; y: number; scale: number }) => {
        setTransform(newTransform);
      }, 5),
    []
  );

  const [isMiddleMouseDown, setIsMiddleMouseDown] = useState(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Add these event handlers near your existing wheel handler
  const handleMouseDown = useCallback((e) => {
    // Check if it's the middle mouse button (button === 1)
    if (e.button === 1) {
      e.preventDefault();
      setIsMiddleMouseDown(true);
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
      if (
        isMiddleMouseDown &&
        containerRef.current &&
        !interfaceState.isPreviewOpen
      ) {
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
        setIsMovingCanvas(true);

        // Clear any existing timer
        if (moveTimerRef.current) {
          clearTimeout(moveTimerRef.current);
        }
      }
    },
    [isMiddleMouseDown, interfaceState.isPreviewOpen]
  );

  const handleMouseUp = useCallback(
    (e) => {
      if (e.button === 1 || isMiddleMouseDown) {
        e.preventDefault();
        setIsMiddleMouseDown(false);

        if (containerRef.current) {
          containerRef.current.style.cursor = "";
        }

        // Only update React state if we actually moved
        if (TransformManager.hasMovedSinceMouseDown) {
          setTransform(TransformManager.getTransform());
        }

        // Always reset isMovingCanvas and clear any timers
        setIsMovingCanvas(false);
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

      if (!containerRef.current || interfaceState.isPreviewOpen) return;

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
      setIsMovingCanvas(true);

      // Start a timer to sync React state after wheel events stop
      if (moveTimerRef.current) {
        clearTimeout(moveTimerRef.current);
      }

      moveTimerRef.current = setTimeout(() => {
        // Reset isMovingCanvas
        setIsMovingCanvas(false);

        // Then update React state with final position
        setTransform(TransformManager.getTransform());
      }, 200);
    },
    [interfaceState.isPreviewOpen]
  );

  // Add a safety effect to reset isMovingCanvas
  useEffect(() => {
    // Reset isMovingCanvas when mouse is released
    const handleGlobalMouseUp = () => {
      if (isMovingCanvas && !isMiddleMouseDown) {
        setIsMovingCanvas(false);
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
    if (interfaceState.isPreviewOpen) {
      detachWheelListener();
    } else {
      attachWheelListener();
    }

    return () => {
      detachWheelListener();
    };
  }, [interfaceState.isPreviewOpen, attachWheelListener, detachWheelListener]);

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
    if (dragState.isDragging) {
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
  }, [dragState.isDragging]);

  const setNodeStyle = useCallback(
    (
      styles: React.CSSProperties,
      nodeIds?: (string | number)[],
      sync = false,
      preventUnsync = false,
      preventCascade = preventUnsync
    ) => {
      const targetIds = nodeIds || dragState.selectedIds;

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

        // Update each node with appropriate styles
        nodesToUpdate.forEach(({ id, styles }) => {
          nodeDisp.updateNodeStyle(
            [id],
            styles,
            dragState.dynamicModeNodeId,
            preventUnsync,
            preventCascade
          );
        });

        // if (sync && !dragState.dynamicModeNodeId) {
        //   nodeDisp.syncViewports();
        // }
      }
    },
    [
      dragState.selectedIds,
      nodeDisp,
      dragState.dynamicModeNodeId,
      nodeState.nodes,
    ]
  );

  const value: BuilderContextType = {
    nodeState,
    dragState,
    containerRef,
    contentRef,
    transform,
    setTransform,
    setNodeStyle,
    nodeDisp,
    dragDisp,
    isMovingCanvas,
    setIsMovingCanvas,
    elementRef,
    isResizing,
    setIsResizing,
    isAdjustingGap,
    setIsAdjustingGap,
    isRotating,
    setIsRotating,
    undo,
    redo,
    canUndo,
    canRedo,
    operations,
    clearOperations: useCallback(() => setOperations([]), []),
    startRecording,
    stopRecording,
    interfaceState,
    interfaceDisp,
    dragDimensionsRef,
    selectedIdsRef,
    isFrameModeActive,
    setIsFrameModeActive,
    isTextModeActive,
    setIsTextModeActive,
    isAdjustingBorderRadius,
    setIsAdjustingBorderRadius,
    isMoveCanvasMode,
    setIsMoveCanvasMode,
    popupRef,
    handleWheel,
    attachWheelListener,
    detachWheelListener,
    draggingOverCanvasRef,
    hasLeftViewportRef,
    isEditingText,
    setIsEditingText,
    isFontSizeHandleActive,
    setIsFontSizeHandleActive,
    isMiddleMouseDown,
    isDraggingChevrons,
    setIsDraggingChevrons,
    isTextMenuOpen,
    setIsTextMenuOpen,
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
