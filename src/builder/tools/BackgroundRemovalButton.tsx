// BackgroundRemovalButton.tsx
"use client";

import { Config, preload, removeBackground } from "@imgly/background-removal";
import { Eraser, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  imageUrl: string;
  onComplete: (newImageUrl: string) => void;
  disabled?: boolean;
}

const BackgroundRemovalButton = ({ imageUrl, onComplete, disabled }: Props) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState("");

  const config: Config = {
    debug: false,
    progress: (key, current, total) => {
      const [type, subtype] = key.split(":");
      setProgress(
        `${type} ${subtype} ${((current / total) * 100).toFixed(0)}%`
      );
    },
    rescale: true,
    device: "cpu",
    output: {
      quality: 0.8,
      format: "image/png",
    },
  };

  useEffect(() => {
    const preloadAssets = async () => {
      try {
        await preload(config);
        console.log("Asset preloading succeeded");
      } catch (error) {
        console.error("Asset preloading failed:", error);
      }
    };

    preloadAssets();
  }, []);

  const handleRemoveBackground = async () => {
    if (!imageUrl) return;

    // Remove 'url()' wrapper if it exists
    const cleanImageUrl = imageUrl.replace(/^url\(['"](.+)['"]\)$/, "$1");

    setIsRunning(true);
    try {
      const blob = await removeBackground(cleanImageUrl, config);
      const url = URL.createObjectURL(blob);
      onComplete(url);
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <button
      onClick={handleRemoveBackground}
      disabled={isRunning || disabled}
      className={`flex-1 px-3 py-1.5 bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md text-sm flex items-center justify-center ${
        isRunning || disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {isRunning ? (
        <>
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          {progress || "Processing..."}
        </>
      ) : (
        <>
          <Eraser className="w-3.5 h-3.5 mr-1.5" />
          Remove BG
        </>
      )}
    </button>
  );
};

export default BackgroundRemovalButton;
