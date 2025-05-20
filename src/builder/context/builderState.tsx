import React, {
  createContext,
  useCallback,
  ReactNode,
  useContext,
  useRef,
  useState,
  useMemo,
  RefObject,
} from "react";
import { NodeState } from "../reducer/nodeDispatcher";
import { nodeInitialState } from "../reducer/state";
import { NodeDispatcher } from "../reducer/nodeDispatcher";
import { useNodeHistory } from "./hooks/useHistory";
import { createTrackedNodeDispatcher } from "./hooks/useNodeDispTracker";
import { useGetSelectedIds } from "./atoms/select-store";
import { useGetDynamicModeNodeId } from "./atoms/drag-store";

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

interface BuilderDynamicContextType {
  nodeState: NodeState;
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
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  operations: Operation[];
  clearOperations: () => void;
  startRecording: () => string;
  stopRecording: (sessionId: string) => boolean;
}

interface BuilderRefsContextType {
  containerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  elementRef: React.RefObject<HTMLDivElement>;
  dragDimensionsRef: RefObject<DragDimensions>;
  selectedIdsRef: RefObject<(string | number)[]>;
  popupRef: RefObject<HTMLDivElement | null>;
  draggingOverCanvasRef: RefObject<boolean>;
  hasLeftViewportRef: RefObject<boolean>;
  transitioningToCanvasRef: RefObject<boolean>;
  transitioningToParentRef: RefObject<boolean>;
}

export interface RecordingSession {
  id: string;
  startState: NodeState;
}

interface DragDimensions {
  [nodeId: string]: { width: number; height: number };
}

const BuilderDynamicContext = createContext<
  BuilderDynamicContextType | undefined
>(undefined);
const BuilderRefsContext = createContext<BuilderRefsContextType | undefined>(
  undefined
);

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
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  // Create refs - these will be passed to components that need them
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const dragDimensionsRef = useRef<DragDimensions>({});
  const selectedIdsRef = useRef<(string | number)[] | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const draggingOverCanvasRef = useRef<boolean>(false);
  const hasLeftViewportRef = useRef<boolean>(false);
  const transitioningToCanvasRef = useRef<boolean>(false);
  const transitioningToParentRef = useRef<boolean>(false);

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

  // Set up undo/redo keyboard shortcuts
  React.useEffect(() => {
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
        // Filter out text property if applying to non-text elements
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

        // Sync viewports if needed
        // if (sync && !dynamicModeNodeId) {
        //   nodeDisp.syncViewports();
        // }
      }
    },
    [nodeDisp, currentSelectedIds, getDynamicModeNodeId, nodeState.nodes]
  );

  const refsValue = useMemo<BuilderRefsContextType>(
    () => ({
      containerRef,
      contentRef,
      elementRef,
      dragDimensionsRef,
      selectedIdsRef,
      popupRef,
      draggingOverCanvasRef,
      hasLeftViewportRef,
      transitioningToCanvasRef,
      transitioningToParentRef,
    }),
    [] // Empty dependency array - this value never changes
  );

  // Create memoized dynamic value that only changes when its dependencies change
  const dynamicValue = useMemo<BuilderDynamicContextType>(
    () => ({
      nodeState,
      setNodeStyle,
      nodeDisp,
      undo,
      redo,
      canUndo,
      canRedo,
      operations,
      setOperations,
      startRecording,
      stopRecording,
    }),
    [
      nodeState,
      setNodeStyle,
      nodeDisp,
      undo,
      redo,
      canUndo,
      canRedo,
      operations,
      startRecording,
      stopRecording,
    ]
  );

  console.log("builder state re rendering");

  return (
    <BuilderRefsContext.Provider value={refsValue}>
      <BuilderDynamicContext.Provider value={dynamicValue}>
        {children}
      </BuilderDynamicContext.Provider>
    </BuilderRefsContext.Provider>
  );
}

export function useBuilderDynamic() {
  const context = useContext(BuilderDynamicContext);

  if (context === undefined) {
    throw new Error("useBuilderDynamic must be used within a BuilderProvider");
  }

  return context;
}

export function useBuilderRefs() {
  const context = useContext(BuilderRefsContext);

  if (context === undefined) {
    throw new Error("useBuilderRefs must be used within a BuilderProvider");
  }

  return context;
}

// Keep the original useBuilder for backward compatibility during migration
export function useBuilder() {
  const dynamicContext = useContext(BuilderDynamicContext);
  const refsContext = useContext(BuilderRefsContext);

  if (dynamicContext === undefined || refsContext === undefined) {
    throw new Error("useBuilder must be used within a BuilderProvider");
  }

  // Combine both contexts for backward compatibility
  return {
    ...dynamicContext,
    ...refsContext,
  };
}
