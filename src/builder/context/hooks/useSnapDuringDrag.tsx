// hooks/useSnapDuringDrag.ts
import { useEffect, useRef } from "react";
import {
  useDraggedNode,
  useIsDragging,
} from "@/builder/context/atoms/drag-store";
import {
  useGetNodeIds,
  useGetAllNodes,
} from "@/builder/context/atoms/node-store";
import { visualOps } from "@/builder/context/atoms/visual-store";
import { SnapGrid } from "@/builder/context/canvasHelpers/SnapGrid";
import { useTransform } from "@/builder/context/atoms/canvas-interaction-store";

const SNAP_THRESHOLD = 4; // px, feel free to tweak
const RAF = typeof window !== "undefined" && window.requestAnimationFrame;

export const useSnapDuringDrag = () => {
  const dragging = useIsDragging();
  const dragged = useDraggedNode();
  const getNodeIds = useGetNodeIds();
  const getAllNodes = useGetAllNodes();
  const transform = useTransform();
  const gridRef = useRef<SnapGrid | null>(null);
  const rafRef = useRef<number | null>(null);
  const previousGuidesRef = useRef<any[]>([]);

  // For debugging
  const errorRef = useRef<Error | null>(null);

  /** Build a fresh grid once, right after drag-start */
  useEffect(() => {
    // Safely check if we should set up or tear down
    if (!dragging || !dragged) {
      // Clean up logic - do this safely
      try {
        if (gridRef.current) {
          gridRef.current.clear();
          gridRef.current = null;
        }
        visualOps.clearSnapGuides();
        previousGuidesRef.current = [];
      } catch (err) {
        console.error("Error cleaning up snap guides:", err);
        errorRef.current = err as Error;
      }
      return;
    }

    // Only set up grid if we don't already have one
    if (!gridRef.current) {
      try {
        // Get all nodes using the non-reactive getter
        const nodes = getAllNodes();

        // Create a new grid
        gridRef.current = new SnapGrid(nodes);

        console.log(
          "SnapGrid created successfully with",
          nodes.length,
          "nodes"
        );
      } catch (err) {
        console.error("Error creating SnapGrid:", err);
        errorRef.current = err as Error;
      }
    }

    // Clean up function
    return () => {
      try {
        if (gridRef.current) {
          gridRef.current.clear();
          gridRef.current = null;
        }
        visualOps.clearSnapGuides();
        previousGuidesRef.current = [];
      } catch (err) {
        console.error("Error in cleanup:", err);
      }
    };
  }, [dragging, dragged, getAllNodes]);

  /** Handle pointer moves during drag - update snap guides */
  useEffect(() => {
    // Only set up if we're dragging and have a dragged node
    if (!dragging || !dragged) return;

    const handleMove = (e: PointerEvent) => {
      try {
        // Safety check
        if (!gridRef.current || !dragged.node) return;

        // OBSERVATION ONLY - we're not modifying the element directly here
        // Just calculate where it would be and produce guides

        // Calculate current position in canvas coordinates
        const canvasRect = getCurrentCanvasRect(e, dragged, transform);

        // Create snap points for edges and centers
        const pts = [
          { value: canvasRect.x, type: "left" },
          { value: canvasRect.x + canvasRect.width, type: "right" },
          { value: canvasRect.x + canvasRect.width / 2, type: "centerX" },
          { value: canvasRect.y, type: "top" },
          { value: canvasRect.y + canvasRect.height, type: "bottom" },
          { value: canvasRect.y + canvasRect.height / 2, type: "centerY" },
        ];

        // Find nearest snap guides
        const res = gridRef.current.findNearestSnaps(
          pts,
          SNAP_THRESHOLD,
          dragged.node.id
        );

        // Only update visual guides if they've changed to prevent flicker
        const newGuidesJson = JSON.stringify(res.snapGuides);
        const prevGuidesJson = JSON.stringify(previousGuidesRef.current);

        if (newGuidesJson !== prevGuidesJson) {
          visualOps.setSnapGuides(res.snapGuides);
          previousGuidesRef.current = res.snapGuides;
        }

        // FOR NOW, we're not applying any snap offsets - just showing guides
        // This is safer and won't interfere with your existing drag system
        // Uncomment this later once the guides are working:
        // applySnapOffsets(res, dragged);
      } catch (err) {
        console.error("Error in handleMove:", err);
        errorRef.current = err as Error;
      }
    };

    // Throttle through RAF for smoother UI
    const onMove = (evt: PointerEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = RAF?.(() => handleMove(evt)) ?? null;
    };

    // Set up and tear down event listener
    window.addEventListener("pointermove", onMove);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointermove", onMove);
    };
  }, [dragging, dragged, transform]);

  return errorRef.current; // Return any error for debugging
};

/**
 * Helper function to convert screen coordinates to canvas coordinates
 * This doesn't modify anything, just calculates positions
 */
function getCurrentCanvasRect(e: PointerEvent, dragged: any, transform: any) {
  try {
    // Default values in case properties are missing
    const startMouseX = dragged.offset?.mouseX ?? 0;
    const startMouseY = dragged.offset?.mouseY ?? 0;

    // Get mouse position
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Calculate screen position
    const screenLeft = mouseX - startMouseX;
    const screenTop = mouseY - startMouseY;

    // Convert to canvas coordinates
    const canvasX = (screenLeft - transform.x) / transform.scale;
    const canvasY = (screenTop - transform.y) / transform.scale;

    // Get dimensions from the dragged node
    const width = parseFloat(dragged.node.style?.width as string) || 100;
    const height = parseFloat(dragged.node.style?.height as string) || 100;

    return {
      x: canvasX,
      y: canvasY,
      width,
      height,
    };
  } catch (err) {
    console.error("Error in getCurrentCanvasRect:", err);
    // Return default values if there's an error
    return { x: 0, y: 0, width: 100, height: 100 };
  }
}

/**
 * Helper function to apply snap offsets to the dragged element
 */
function applySnapOffsets(snapResult: any, dragged: any) {
  if (!dragged.element) {
    // If there's no direct element reference, we can't apply offsets
    // Alternative: You could modify the dragged node's position in the DOM directly,
    // or update a state value that's used in rendering
    return;
  }

  // Calculate the x/y offsets to apply based on the snap result
  let offsetX = 0;
  let offsetY = 0;

  // Apply horizontal snap if available
  if (snapResult.horizontalSnap) {
    const targetPos = snapResult.horizontalSnap.position;
    const targetType = snapResult.horizontalSnap.type;
    const { y, height } = getCurrentPositionAndSize(dragged);

    if (targetType === "top") {
      offsetY = targetPos - y;
    } else if (targetType === "bottom") {
      offsetY = targetPos - (y + height);
    } else if (targetType === "centerY") {
      offsetY = targetPos - (y + height / 2);
    }
  }

  // Apply vertical snap if available
  if (snapResult.verticalSnap) {
    const targetPos = snapResult.verticalSnap.position;
    const targetType = snapResult.verticalSnap.type;
    const { x, width } = getCurrentPositionAndSize(dragged);

    if (targetType === "left") {
      offsetX = targetPos - x;
    } else if (targetType === "right") {
      offsetX = targetPos - (x + width);
    } else if (targetType === "centerX") {
      offsetX = targetPos - (x + width / 2);
    }
  }

  // Check spacing snaps
  if (
    !snapResult.horizontalSnap &&
    snapResult.horizontalSpacingSnap !== undefined
  ) {
    const { x } = getCurrentPositionAndSize(dragged);
    offsetX = snapResult.horizontalSpacingSnap - x;
  }

  if (
    !snapResult.verticalSnap &&
    snapResult.verticalSpacingSnap !== undefined
  ) {
    const { y } = getCurrentPositionAndSize(dragged);
    offsetY = snapResult.verticalSpacingSnap - y;
  }

  // Apply the offsets
  if (offsetX !== 0 || offsetY !== 0) {
    // Update the element directly in the DOM overlay
    if (dragged.element && dragged.element.style) {
      if (offsetX !== 0) {
        const currentLeft = parseFloat(dragged.element.style.left || "0");
        dragged.element.style.left = `${currentLeft + offsetX}px`;
      }

      if (offsetY !== 0) {
        const currentTop = parseFloat(dragged.element.style.top || "0");
        dragged.element.style.top = `${currentTop + offsetY}px`;
      }
    }

    // Alternatively, if we had a state-based approach:
    // dragged.setPosition(prev => ({
    //   x: prev.x + offsetX,
    //   y: prev.y + offsetY
    // }));
  }
}

/**
 * Helper function to get current position and size
 */
function getCurrentPositionAndSize(dragged: any) {
  if (dragged.element && dragged.element.style) {
    return {
      x: parseFloat(dragged.element.style.left || "0"),
      y: parseFloat(dragged.element.style.top || "0"),
      width: parseFloat(dragged.node.style?.width || "0"),
      height: parseFloat(dragged.node.style?.height || "0"),
    };
  }

  // Fallback to node style if element is not available
  return {
    x: parseFloat(dragged.node.style?.left || "0"),
    y: parseFloat(dragged.node.style?.top || "0"),
    width: parseFloat(dragged.node.style?.width || "0"),
    height: parseFloat(dragged.node.style?.height || "0"),
  };
}
