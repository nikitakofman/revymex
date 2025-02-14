import { useRef, useCallback } from "react";
import { useBuilder } from "@/builder/context/builderState";

export const EDGE_SIZE = 50;
const MAX_SCROLL_SPEED = 4;
const MIN_SCROLL_SPEED = 0.5;

interface ScrollDirections {
  left: number;
  right: number;
  up: number;
  down: number;
}

interface ScrollState {
  clientX: number;
  clientY: number;
}

export const useAutoScroll = () => {
  const { setTransform } = useBuilder();
  const scrollAnimationRef = useRef<number | null>(null);
  const currentScrollState = useRef<ScrollState | null>(null);

  const calculateScrollDirections = useCallback(
    (
      clientX: number,
      clientY: number,
      containerRect: DOMRect
    ): ScrollDirections => {
      const distanceFromTop = Math.max(0, clientY - containerRect.top);
      const distanceFromBottom = Math.max(0, containerRect.bottom - clientY);
      const distanceFromLeft = Math.max(0, clientX - containerRect.left);
      const distanceFromRight = Math.max(0, containerRect.right - clientX);

      const isInsideCanvas =
        clientX >= containerRect.left &&
        clientX <= containerRect.right &&
        clientY >= containerRect.top &&
        clientY <= containerRect.bottom;

      if (!isInsideCanvas) {
        return { left: 0, right: 0, up: 0, down: 0 };
      }

      const getScrollSpeed = (distance: number): number => {
        if (distance > EDGE_SIZE) return 0;
        const distancePercent = distance / EDGE_SIZE;
        const speedFactor = Math.pow(1 - distancePercent, 2);
        return (
          MIN_SCROLL_SPEED + (MAX_SCROLL_SPEED - MIN_SCROLL_SPEED) * speedFactor
        );
      };

      return {
        left:
          distanceFromLeft <= EDGE_SIZE ? getScrollSpeed(distanceFromLeft) : 0,
        right:
          distanceFromRight <= EDGE_SIZE
            ? -getScrollSpeed(distanceFromRight)
            : 0,
        up: distanceFromTop <= EDGE_SIZE ? getScrollSpeed(distanceFromTop) : 0,
        down:
          distanceFromBottom <= EDGE_SIZE
            ? -getScrollSpeed(distanceFromBottom)
            : 0,
      };
    },
    []
  );

  const stopAutoScroll = useCallback(() => {
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    currentScrollState.current = null;
  }, []);

  const startAutoScroll = useCallback(
    (clientX: number, clientY: number, containerElement: HTMLElement) => {
      currentScrollState.current = { clientX, clientY };

      const scroll = () => {
        if (!currentScrollState.current) return;

        const { clientX, clientY } = currentScrollState.current;
        const containerRect = containerElement.getBoundingClientRect();
        const { left, right, up, down } = calculateScrollDirections(
          clientX,
          clientY,
          containerRect
        );

        const shouldScroll =
          left !== 0 || right !== 0 || up !== 0 || down !== 0;

        if (shouldScroll) {
          setTransform((prev) => ({
            ...prev,
            x: prev.x + left + right,
            y: prev.y + up + down,
          }));
          scrollAnimationRef.current = requestAnimationFrame(scroll);
        } else {
          stopAutoScroll();
        }
      };

      if (!scrollAnimationRef.current) {
        scrollAnimationRef.current = requestAnimationFrame(scroll);
      }
    },
    [setTransform, calculateScrollDirections, stopAutoScroll]
  );

  const updateScrollPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (currentScrollState.current) {
        currentScrollState.current = { clientX, clientY };
      }
    },
    []
  );

  return {
    startAutoScroll,
    updateScrollPosition,
    stopAutoScroll,
  };
};
