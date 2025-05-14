// src/builder/registry/elements/BackgroundMedia.tsx
import React from "react";
import Image from "next/image";
import { CSSProperties } from "react";

interface BackgroundMediaProps {
  style: CSSProperties & {
    backgroundImage?: string;
    backgroundVideo?: string;
    objectFit?: CSSProperties["objectFit"];
    objectPosition?: CSSProperties["objectPosition"];
  };
}

export const BackgroundMedia: React.FC<BackgroundMediaProps> = ({ style }) => {
  // Extract the relevant properties from style
  const {
    backgroundImage,
    backgroundVideo,
    objectFit = "cover",
    objectPosition,
  } = style;

  // If there's no media, don't render anything
  if (!backgroundImage && !backgroundVideo) {
    return null;
  }

  return (
    <div
      data-background-wrapper="true"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        overflow: "hidden",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      {backgroundVideo ? (
        <video
          style={{
            width: "100%",
            height: "100%",
            objectFit: objectFit,
            objectPosition: objectPosition,
            borderRadius: "inherit",
            pointerEvents: "none",
          }}
          src={backgroundVideo}
          autoPlay={false}
          muted
          loop
          playsInline
        />
      ) : backgroundImage ? (
        <Image
          fill={true}
          style={{
            width: "100%",
            height: "100%",
            objectFit: objectFit,
            objectPosition: objectPosition,
            borderRadius: "inherit",
            pointerEvents: "none",
          }}
          src={backgroundImage}
          alt=""
        />
      ) : null}
    </div>
  );
};
