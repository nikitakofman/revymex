import { useCallback, RefObject } from "react";
import { nanoid } from "nanoid";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Transform } from "@/builder/types";
import { selectOps } from "../atoms/select-store";

interface UseImageDropProps {
  containerRef: RefObject<HTMLDivElement>;
  transform: Transform;
  nodeDisp: {
    addNode: (
      node: Node,
      parentId: string | null,
      index: number | null,
      inViewport: boolean
    ) => void;
  };
}

export function useImageDrop({
  containerRef,
  transform,
  nodeDisp,
}: UseImageDropProps) {
  const { setSelectedIds } = selectOps;

  const createImageNode = useCallback(
    (
      imageSrc: string,
      clientX: number,
      clientY: number,
      naturalWidth?: number,
      naturalHeight?: number
    ) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Convert screen coordinates to canvas coordinates
      const canvasX = (clientX - rect.left - transform.x) / transform.scale;
      const canvasY = (clientY - rect.top - transform.y) / transform.scale;

      // Calculate dimensions while maintaining aspect ratio if we have natural dimensions
      let width = 200;
      let height = 200;
      if (naturalWidth && naturalHeight) {
        const aspectRatio = naturalWidth / naturalHeight;
        if (aspectRatio > 1) {
          height = width / aspectRatio;
        } else {
          width = height * aspectRatio;
        }
      }

      const newNode: Node = {
        id: nanoid(),
        type: "image",
        style: {
          position: "absolute",
          left: `${canvasX}px`,
          top: `${canvasY}px`,
          width: `${width}px`,
          height: `${height}px`,
          objectFit: "cover",
          src: imageSrc,
        },
        inViewport: false,
      };

      nodeDisp.addNode(newNode, null, null, false);
      setSelectedIds([newNode.id]);
    },
    [containerRef, transform, nodeDisp]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        // Handle dropped files (e.g., from desktop)
        if (e.dataTransfer.files.length > 0) {
          const files = Array.from(e.dataTransfer.files).filter((file) =>
            file.type.startsWith("image/")
          );

          if (files.length === 0) {
            alert("Please drop image files only");
            return;
          }

          // Process each image file
          files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (reader.result) {
                // Create a temporary image to get dimensions
                const img = new Image();
                img.onload = () => {
                  createImageNode(
                    reader.result as string,
                    e.clientX + index * 20, // Offset multiple images
                    e.clientY + index * 20,
                    img.naturalWidth,
                    img.naturalHeight
                  );
                };
                img.src = reader.result as string;
              }
            };
            reader.onerror = () => {
              alert(`Failed to load image: ${file.name}`);
            };
            reader.readAsDataURL(file);
          });
          return;
        }

        // Handle dropped images (e.g., from browser)
        const imageUrl =
          e.dataTransfer.getData("text/uri-list") ||
          e.dataTransfer.getData("text/plain");

        if (
          imageUrl &&
          (imageUrl.startsWith("http") || imageUrl.startsWith("data:"))
        ) {
          // Create a temporary image to get dimensions
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            createImageNode(
              imageUrl,
              e.clientX,
              e.clientY,
              img.naturalWidth,
              img.naturalHeight
            );
          };
          img.onerror = () => {
            alert("Failed to load image from URL");
          };
          img.src = imageUrl;
        }
      } catch (error) {
        alert("Error processing dropped image");
        console.error("Drop error:", error);
      }
    },
    [createImageNode]
  );

  return {
    handleDragOver,
    handleDrop,
  };
}
