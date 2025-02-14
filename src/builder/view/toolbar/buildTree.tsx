// utils/buildTree.ts
import { Node } from "@/builder/reducer/nodeDispatcher";

export function buildTreeFromNodes(nodes: Node[]) {
  const nodeMap = new Map();
  const tree: Node[] = [];

  // First pass: Create all nodes
  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // Second pass: Build tree relationships
  nodes.forEach((node) => {
    const mappedNode = nodeMap.get(node.id);
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId);
      parent.children.push(mappedNode);
    } else {
      tree.push(mappedNode);
    }
  });

  return tree;
}
