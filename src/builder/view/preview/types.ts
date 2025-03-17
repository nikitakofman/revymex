import { CSSProperties } from "react";

/**
 * Interface for a node with responsive styles
 */
export interface ResponsiveNode {
  id: string | number;
  type: string;
  style?: React.CSSProperties & { src?: string };
  src?: string;
  text?: string;
  viewportStyles: {
    [viewport: number]: React.CSSProperties & { src?: string; text?: string };
  };
  parentId?: string | number | null;
  isDynamic?: boolean;
  dynamicConnections?: Array<{
    sourceId: string | number;
    targetId: string | number;
    type: string;
  }>;
  dynamicParentId?: string | number;
  sharedId?: string;
  originalId?: string | number; // Store original ID for finding connections
  children?: ResponsiveNode[];
}

/**
 * Props for the ResponsiveNode component
 */
export interface ResponsiveNodeProps {
  node: ResponsiveNode;
  allNodes: ResponsiveNode[];
  originalNodes: any[]; // This could be refined to the exact type from your reducer
  viewport: number;
  nodeStates: Map<string | number, string | number | null>;
  setNodeState: (
    nodeId: string | number,
    stateId: string | number | null
  ) => void;
  nodeMap: Map<string | number, ResponsiveNode>;
}

/**
 * Props for the ResponsivePreview component
 */
export interface ResponsivePreviewProps {
  nodes: any[]; // This could be refined to the exact type from your reducer
  viewport: number;
}
