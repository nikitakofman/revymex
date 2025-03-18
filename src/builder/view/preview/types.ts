import { CSSProperties } from "react";

export type NodeStyle = CSSProperties & {
  src?: string;
  text?: string;
  backgroundImage?: string;
  backgroundVideo?: string;
};

export type DynamicConnection = {
  sourceId: string;
  targetId: string;
  type: "click" | "hover" | "mouseLeave" | "load" | string;
};

export type Node = {
  id: string;
  type: string;
  style: NodeStyle;
  isViewport?: boolean;
  viewportWidth?: number;
  viewportName?: string;
  parentId: string | null;
  inViewport: boolean;
  sharedId?: string;
  independentStyles?: Record<string, boolean>;
  position?: {
    x: number;
    y: number;
  };

  // Dynamic node properties
  isDynamic?: boolean;
  dynamicPosition?: { x: number; y: number };
  dynamicConnections?: DynamicConnection[];
};

export type ResponsiveNode = Node & {
  responsiveStyles: Record<number, NodeStyle>;
  children: ResponsiveNode[];
};

export type Viewport = {
  id: string;
  width: number;
  name: string;
};
