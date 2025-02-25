// LoadingScreen.tsx
import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";

const RevymeIcon = () => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getLogo = () => {
    if (!mounted) return "/revymeicon.svg";
    return theme === "dark" ? "/revymeicon.svg" : "/revymeiconblack.svg";
  };

  return (
    <Image
      src={getLogo()}
      width={20}
      height={20}
      alt="Revyme Logo"
      className="mx-0.5"
    />
  );
};

interface LoadingScreenProps {
  isLoading: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Handle the fade-out effect when isLoading changes to false
  useEffect(() => {
    if (!isLoading) {
      // Slight delay before starting fade out
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // If not visible at all, return null
  if (!isVisible && !isLoading) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-[var(--bg-toolbar)] z-[9999] transition-opacity duration-500 ease-in-out ${
        isLoading ? "opacity-100" : "opacity-0"
      }`}
      // Remove from DOM after fade completes
      onTransitionEnd={() => {
        if (!isLoading) setIsVisible(false);
      }}
    >
      <div className="flex flex-col items-center">
        <div className="mb-6 relative">
          {/* RevymeIcon in the center */}
          <div className="animate-pulse">
            <RevymeIcon />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
