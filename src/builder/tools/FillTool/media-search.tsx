import React, { useState, useEffect } from "react";
import { Search, RefreshCw } from "lucide-react";
import Button from "@/components/ui/button";
import { useBuilder } from "@/builder/context/builderState";
import { canvasOps } from "@/builder/context/atoms/canvas-interaction-store";

/**
 * Helper function to safely create a CSS background image value
 */
export const createBackgroundImageValue = (url) => {
  if (!url) return "none";
  return `url('${url}')`;
};

/**
 * Image Search component for selecting images from Unsplash
 */
export const ImageSearchModal = ({
  onSelectImage,
  onClose,
  embedded = false,
}) => {
  const [query, setQuery] = useState("minimal");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchImages = async (searchQuery = "minimal") => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=20&page=1`,
        {
          headers: {
            Authorization: `Client-ID ${process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY}`,
          },
        }
      );
      const data = await response.json();
      setImages(data.results || []);
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages(query);
  }, []);

  // This function handles the image selection and ensures we pass a clean URL
  const handleImageSelect = (imageUrl) => {
    // Pass the raw URL to the parent component
    onSelectImage(imageUrl);

    // Only close if not in embedded mode
    if (!embedded) {
      onClose();
    }
  };

  console.log("images", images);

  const content = (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={(e) => canvasOps.setIsEditingText(false)}
          onSelect={(e) => canvasOps.setIsEditingText(true)}
          placeholder="Search images..."
          className="flex-1 px-3 py-1.5 bg-[var(--bg-default)] border border-[var(--border-default)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <Button onClick={() => fetchImages(query)}>
          <Search className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative group cursor-pointer aspect-square rounded-md overflow-hidden"
            onClick={() => handleImageSelect(image.urls.regular)}
          >
            {/* Important: Use divs with background-image for preview, not Next/Image components */}
            <div
              className="w-full h-full bg-cover bg-center transition-transform group-hover:scale-105"
              style={{ backgroundImage: `url(${image.urls.small})` }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center mt-4">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-default)]" />
        </div>
      )}
    </div>
  );

  // If embedded, just return the content without the modal wrapper
  if (embedded) {
    return content;
  }

  // Otherwise, return with modal wrapper
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-elevated)] p-4 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Select Image</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)]"
          >
            &times;
          </button>
        </div>
        {content}
      </div>
    </div>
  );
};

/**
 * Video Search component for selecting videos from Pixabay
 */
export const VideoSearchModal = ({
  onSelectVideo,
  onClose,
  embedded = false,
}) => {
  const [query, setQuery] = useState("minimal");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchVideos = async (searchQuery = "minimal") => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://pixabay.com/api/videos/?key=${process.env.NEXT_PUBLIC_PIXABAY_API_KEY}&q=${searchQuery}&per_page=20`
      );
      const data = await response.json();
      setVideos(data.hits || []);
    } catch (error) {
      console.error("Error fetching videos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos(query);
  }, []);

  // This function handles the video selection
  const handleVideoSelect = (videoUrl) => {
    // Pass the raw URL to the parent component
    onSelectVideo(videoUrl);

    // Only close if not in embedded mode
    if (!embedded) {
      onClose();
    }
  };

  const content = (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={(e) => canvasOps.setIsEditingText(false)}
          onSelect={(e) => canvasOps.setIsEditingText(true)}
          placeholder="Search videos..."
          className="flex-1 px-3 py-1.5 bg-[var(--bg-default)] border border-[var(--border-default)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <Button onClick={() => fetchVideos(query)}>
          <Search className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
        {videos.map((video) => (
          <div
            key={video.id}
            className="relative group cursor-pointer aspect-video rounded-md overflow-hidden"
            onClick={() => handleVideoSelect(video.videos.large.url)}
          >
            <video
              src={video.videos.tiny.url}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              muted
              loop
              onMouseOver={(e) => e.currentTarget.play()}
              onMouseOut={(e) => e.currentTarget.pause()}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center mt-4">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-default)]" />
        </div>
      )}
    </div>
  );

  // If embedded, just return the content without the modal wrapper
  if (embedded) {
    return content;
  }

  // Otherwise, return with modal wrapper
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-elevated)] p-4 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Select Video</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)]"
          >
            &times;
          </button>
        </div>
        {content}
      </div>
    </div>
  );
};
