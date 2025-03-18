import React, { useMemo } from "react";
import { ResponsiveNode, Viewport } from "../../types";
import { ImageNode } from "./ImageNode";
import { VideoNode } from "./VideoNode";
import { TextNode } from "./TextNode";
import { FrameNode } from "./FrameNode";

type NodeRendererProps = {
  node: ResponsiveNode;
  currentViewport: number;
  viewportBreakpoints: Viewport[];
  onInteraction?: (sourceId: string, eventType: string) => void;
  allNodes: ResponsiveNode[]; // All nodes for finding dynamic targets
};

export const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  currentViewport,
  viewportBreakpoints,
  onInteraction,
  allNodes,
}) => {
  // Create event handlers for dynamic nodes
  const eventHandlers = useMemo(() => {
    if (!node.isDynamic || !node.dynamicConnections || !onInteraction)
      return {};

    const handlers: Record<string, (e: React.SyntheticEvent) => void> = {};

    node.dynamicConnections.forEach((conn) => {
      if (conn.sourceId === node.id) {
        switch (conn.type) {
          case "click":
            handlers.onClick = (e) => {
              e.stopPropagation(); // Prevent event bubbling
              onInteraction(conn.sourceId, "click");
            };
            break;
          case "hover":
            handlers.onMouseEnter = (e) => {
              e.stopPropagation();
              onInteraction(conn.sourceId, "hover");
            };
            break;
          case "mouseLeave":
            handlers.onMouseLeave = (e) => {
              e.stopPropagation();
              onInteraction(conn.sourceId, "mouseLeave");
            };
            break;
          // Add other event types as needed
        }
      }
    });

    return handlers;
  }, [node, onInteraction]);

  // Create a recursive render function
  const renderNode = useMemo(() => {
    const renderer = (nodeToRender: ResponsiveNode) => {
      // Prepare node-specific props with event handlers
      const nodeProps = {
        key: nodeToRender.id,
        node: nodeToRender,
        currentViewport,
        viewportBreakpoints,
        eventHandlers: nodeToRender.isDynamic ? eventHandlers : {},
      };

      // For child nodes, we need to check if parent is dynamic
      // If parent is dynamic, children should also trigger parent's events
      const parentEventHandlers = nodeToRender.isDynamic ? {} : eventHandlers;

      switch (nodeToRender.type) {
        case "image":
          return (
            <ImageNode
              {...nodeProps}
              eventHandlers={{
                ...nodeProps.eventHandlers,
                ...parentEventHandlers,
              }}
            />
          );
        case "video":
          return (
            <VideoNode
              {...nodeProps}
              eventHandlers={{
                ...nodeProps.eventHandlers,
                ...parentEventHandlers,
              }}
            />
          );
        case "text":
          return (
            <TextNode
              {...nodeProps}
              eventHandlers={{
                ...nodeProps.eventHandlers,
                ...parentEventHandlers,
              }}
            />
          );
        case "frame":
        default:
          return (
            <FrameNode
              {...nodeProps}
              renderNode={renderer}
              eventHandlers={{
                ...nodeProps.eventHandlers,
                ...parentEventHandlers,
              }}
              onInteraction={onInteraction}
              allNodes={allNodes}
            />
          );
      }
    };
    return renderer;
  }, [
    currentViewport,
    viewportBreakpoints,
    eventHandlers,
    onInteraction,
    allNodes,
  ]);

  return <>{renderNode(node)}</>;
};
