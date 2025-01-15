export class DragManager {
  private initialRect: DOMRect;
  private initialTransform: { x: number; y: number; scale: number };

  constructor(
    element: Element,
    transform: { x: number; y: number; scale: number }
  ) {
    this.initialRect = element.getBoundingClientRect();
    this.initialTransform = { ...transform };
  }

  getBoundingClientRect(): DOMRect {
    return this.initialRect;
  }
}

export function createDragManager(
  element: Element,
  transform: { x: number; y: number; scale: number }
) {
  return new DragManager(element, transform);
}
