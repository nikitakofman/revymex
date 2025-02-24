import { ReactNode } from "react";
import { Node } from "../reducer/nodeDispatcher";

export type ElementProps = {
  children?: ReactNode;
  node: Node;
  [key: string]: unknown;
};

// Define drop position types
export const enum DropPosition {
  Before = "before",
  After = "after",
  Inside = "inside",
  None = "none",
  Canvas = "canvas",
}

// Extended Node type with children for tree structure
export interface TreeNodeWithChildren extends Node {
  children: TreeNodeWithChildren[];
}

// Track drag info globally since dataTransfer is not accessible in dragOver
export const currentDragInfo = {
  id: null as null | string | number,
  type: null as null | string,
  isViewport: false,
  inViewport: false,
};
