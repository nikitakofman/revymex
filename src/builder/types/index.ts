import { ReactNode } from "react";
import { Node } from "../reducer/nodeDispatcher";

export type ElementProps = {
  children?: ReactNode;
  node: Node;
  [key: string]: unknown;
};
