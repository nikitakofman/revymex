import { ReactNode } from "react";
import { Node } from "../../../../RevymeX/legacy/nodeReducer";

export type ElementProps = {
  children?: ReactNode;
  node: Node;
  [key: string]: unknown;
};
