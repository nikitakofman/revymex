# Dynamic Component System: Cross-Viewport Variant Child Trigger Bug & Solution

## Bug Description

### Symptoms

- In **desktop viewport**: Both parent components AND their child elements properly trigger variant changes when interacted with
- In **tablet/mobile viewports**: Only top-level parent components correctly trigger variant changes, while child elements within variants do not trigger their target variants when clicked or hovered

### System Architecture Context

- Dynamic component system with variants for desktop, tablet, and mobile viewports
- Variants are connected via "connections" (source, target, event type)
- A central `transformNode` function processes events and applies variants
- Child elements are rendered recursively using a `renderNode` function
- The same event handling logic should work identically across all viewports

## Root Cause

The bug was caused by a mismatch between:

1. The ID used to render the parent dynamic node (`<DynamicNode nodeId="parentId">`)
2. The ID used to store the variant when a child triggers an event
3. How these IDs are used across different viewports

Specifically, when a child node triggered an event, the system was storing the variant under `sourceNode.dynamicParentId`, but the actual `<DynamicNode>` component looking for this variant was using a different ID in non-desktop viewports.

### Key Problem Point

In the `transformNode` function, the variant key was determined with:

```javascript
// Original problematic code
const variantKey = isChildTrigger ? sourceNode.dynamicParentId : sourceId;
```

This approach didn't account for the possibility that the parent node ID might be different across viewports, or that the parent node's actual ID in the node tree might not match the `dynamicParentId` reference stored in the child node.

## Solution

### The Fix

Replace the simple variant key determination with a more robust approach that verifies the parent ID actually exists in the current viewport's node tree:

```javascript
// Fix in transformNode function
let variantKey = sourceId;

// If this is a child trigger, we need to ensure it's stored under the correct parent ID
if (isChildTrigger && sourceNode.dynamicParentId) {
  // Verify if this parent ID actually exists as a dynamic node in the tree
  const parentExists = nodeTree.some(
    (node) => node.id === sourceNode.dynamicParentId
  );

  if (parentExists) {
    variantKey = sourceNode.dynamicParentId;
    console.log(
      `Child trigger: storing variant under parent ID: ${variantKey}`
    );
  } else {
    // Maybe the parent has a different ID in different viewports?
    // Try to find a matching parent node
    console.log(
      `Parent ID ${sourceNode.dynamicParentId} not found in nodeTree, searching for alternative...`
    );
    const possibleParent = originalNodes.find(
      (node) =>
        node.isDynamic &&
        // Either the node has the same ID as dynamicParentId
        (node.id === sourceNode.dynamicParentId ||
          // Or the node has the same shared ID as the parent referenced in dynamicParentId
          (node.sharedId &&
            originalNodes.some(
              (n) =>
                n.id === sourceNode.dynamicParentId &&
                n.sharedId === node.sharedId
            )))
    );

    if (possibleParent) {
      variantKey = possibleParent.id;
      console.log(`Found alternative parent ID: ${variantKey}`);
    }
  }
}
```

### How This Works

1. Default to using the source node's ID as the variant key
2. For child triggers, check if the referenced parent ID actually exists in the current node tree
3. If the parent exists, use its ID for the variant key
4. If not, try to find an alternative parent node that might be the viewport-specific version
5. Use the found parent ID as the variant key

This ensures that the variant is always stored under an ID that the appropriate `<DynamicNode>` component can find, regardless of viewport.

## Lessons Learned

1. **Cross-Viewport Component Relationships**: When working with responsive components, connections between components can change across viewports. Always ensure ID references remain consistent and accessible across viewport contexts.

2. **ID Verification**: Simply storing references to IDs isn't enough – always verify that those IDs exist in the current context before using them.

3. **Fallback Strategies**: Implement fallback strategies for finding the correct node when direct ID references fail, especially in responsive systems.

4. **Detailed Logging**: Implement detailed logging to trace the flow of events, IDs, and state changes when debugging complex component interactions.

5. **Test Across All Breakpoints**: Thoroughly test interactive behaviors at all viewport sizes, as component relationships and event handling can behave differently across breakpoints.

## Implementation Considerations

When implementing similar interactive component systems:

1. Store viewport context information with variants to help track which viewport a variant belongs to
2. Consider using a direct parent-child relationship for event handling in non-desktop viewports
3. Ensure that node IDs or references are consistent across different rendering contexts
4. Add debug attributes to elements to make it easier to inspect problematic components
5. Create helper functions for finding and validating node relationships across different viewports
