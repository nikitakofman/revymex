import React, { useEffect, useState, useRef } from "react";
import InterfaceToolbar from "../toolbars/leftToolbar";
import { RenderNodes } from "../../registry/renderNodes";
import {
  useBuilder,
  useBuilderDynamic,
  useBuilderRefs,
} from "@/builder/context/builderState";
import { ViewportDevTools } from "../../dev/ViewportDevTools";
import ElementToolbar from "../toolbars/rightToolbar";
import { useMouseMove } from "@/builder/context/dnd/useMouseMove";

import {
  initNodeStateFromInitialState,
  nodeStore,
  nodeIdsAtom,
} from "@/builder/context/atoms/node-store";
import { nodeInitialState } from "@/builder/reducer/state";

const Canvas = () => {
  const hasInitializedAtoms = useRef(false);

  const { containerRef, contentRef } = useBuilderRefs();

  // Get isPreviewOpen from interface store instead of interfaceState

  console.log(`Canvas re rendering`, new Date().getTime());

  // Initialize Jotai atoms with the initial node state on first render
  useEffect(() => {
    if (!hasInitializedAtoms.current) {
      console.log("Initializing Jotai node state from initial state");
      initNodeStateFromInitialState(nodeInitialState);
      console.log(
        `Initialized ${nodeInitialState.nodes.length} nodes in Jotai store`
      );

      // Check initialization was successful by reading the store
      const nodeIds = nodeStore.get(nodeIdsAtom);
      console.log(`Verified nodeIds in store: ${nodeIds.length} nodes`);

      // Mark as initialized so we don't do it again
      hasInitializedAtoms.current = true;
    }
  }, []);

  return (
    <>
      <div
        className={`fixed inset-0 pt-12 flex overflow-hidden bg-[var(--bg-canvas)]`}
      >
        <>
          <div
            ref={containerRef}
            style={{
              willChange: "transform",
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
              isolation: "isolate",
            }}
            className="w-full h-full canvas relative"
          >
            <div
              ref={contentRef}
              className="relative"
              style={{
                isolation: "isolate",
                willChange: "transform",
                transformOrigin: "0 0",
              }}
            >
              <RenderNodes filter="outOfViewport" />
            </div>
          </div>

          <ElementToolbar />
        </>
      </div>
    </>
  );
};

export default Canvas;
