import { NodeId, nodeStore, nodeSharedInfoAtom } from "../";
import { hierarchyStore, childrenMapAtom } from "../hierarchy-store";

/**
 * Remove shared ID from a node and all its descendants
 * @param nodeId ID of the node to update
 */
export function removeSharedId(nodeId: NodeId) {
  // Remove shared ID from the node itself
  nodeStore.set(nodeSharedInfoAtom(nodeId), { sharedId: undefined });

  // Remove from all descendants
  const childrenMap = hierarchyStore.get(childrenMapAtom);
  const children = childrenMap.get(nodeId) || [];

  children.forEach((childId) => {
    removeSharedId(childId);
  });
}

/**
 * Assign a shared ID to a node and all its descendants
 * @param nodeId ID of the node to update
 * @param sharedId Shared ID to assign (or generate a new one if not provided)
 */
export function assignSharedId(nodeId: NodeId, sharedId?: string) {
  const newSharedId = sharedId || `shared-${nanoid(8)}`;

  // Assign to the node itself
  nodeStore.set(nodeSharedInfoAtom(nodeId), { sharedId: newSharedId });

  // Assign to all descendants (with unique suffixes)
  const childrenMap = hierarchyStore.get(childrenMapAtom);
  const children = childrenMap.get(nodeId) || [];

  children.forEach((childId, index) => {
    assignSharedId(childId, `${newSharedId}-child-${index}`);
  });

  return newSharedId;
}

const urlAlphabet =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generate a unique ID
 * @param size Size of the ID (default: 21)
 * @returns A random ID string
 */
export function nanoid(size = 21): string {
  let id = "";
  // Compact alternative for loop with crypto.getRandomValues()
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);

  while (size--) {
    // Using & is faster than % because it avoids a division operation
    const byte = bytes[size] & 63;
    id += urlAlphabet[byte];
  }

  return id;
}

export function arrayMove<T>(
  array: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}
