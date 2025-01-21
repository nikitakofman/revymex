import React, {
  createContext,
  useCallback,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { NodeState } from "../reducer/nodeDispatcher";
import { DragState } from "../reducer/dragDispatcher";
import { dragInitialState, nodeInitialState } from "../reducer/state";
import { NodeDispatcher } from "../reducer/nodeDispatcher";
import { DragDispatcher } from "../reducer/dragDispatcher";

export interface LineIndicatorState {
  show: boolean;
  x: number;
  y: number;
  width: string | number;
  height: string | number;
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
    styles: React.CSSProperties,
    nodeIds?: (string | number)[]
  ) => void;
  nodeDisp: NodeDispatcher;
  dragDisp: DragDispatcher;
  isMovingCanvas: boolean;
}

const BuilderContext = createContext<BuilderContextType | undefined>(undefined);

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [nodeState, setNodeState] = useState(nodeInitialState);
  const [dragState, setDragState] = useState(dragInitialState);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.3 });
  const [isMovingCanvas, setIsMovingCanvas] = useState(false);

  // Timer ref to handle debouncing the isMovingCanvas state
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const nodeDisp = useMemo(() => new NodeDispatcher(setNodeState), []);
  const dragDisp = useMemo(() => new DragDispatcher(setDragState), []);

  // Clear the timer and set isMoving to false
  const stopMoving = useCallback(() => {
    setIsMovingCanvas(false);
  }, []);

  // Start moving and setup the debounce timer
  const startMoving = useCallback(() => {
    setIsMovingCanvas(true);

    if (moveTimerRef.current) {
      clearTimeout(moveTimerRef.current);
    }

    moveTimerRef.current = setTimeout(stopMoving, 150);
  }, [stopMoving]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (!containerRef.current) return;

      startMoving();

      if (e.ctrlKey || e.metaKey) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const pointX = (mouseX - transform.x) / transform.scale;
        const pointY = (mouseY - transform.y) / transform.scale;

        const delta = -e.deltaY * 0.01;
        const newScale = Math.min(Math.max(0.1, transform.scale + delta), 4);

        const newX = mouseX - pointX * newScale;
        const newY = mouseY - pointY * newScale;

        setTransform({
          x: newX,
          y: newY,
          scale: newScale,
        });
      } else {
        setTransform((prev) => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    },
    [transform]
  );

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
      contentRef.current.style.transformOrigin = "0 0";
    }
  }, [transform]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    if (dragState.isDragging) {
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
  }, [dragState.isDragging]);

  const setNodeStyle = useCallback(
    (styles: React.CSSProperties, nodeIds?: (string | number)[]) => {
      const targetIds = nodeIds || dragState.selectedIds;
      if (targetIds.length > 0) {
        nodeDisp.updateNodeStyle(targetIds, styles);
      }
    },
    [dragState.selectedIds, nodeDisp]
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
