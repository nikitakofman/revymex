import React, { useState, useCallback } from "react";
import { ImageIcon, Search, RefreshCw } from "lucide-react";
import { ToolInput } from "./_components/ToolInput";
import { ToolbarSection } from "./_components/test-ui";
import { ToolSelect } from "./_components/ToolSelect";
import { useBuilder } from "@/builder/context/builderState";

interface FilterValues {
  blur: number;
  contrast: number;
  brightness: number;
  grayscale: number;
  hueRotate: number;
  invert: number;
  opacity: number;
  saturate: number;
  sepia: number;
}

const DEFAULT_FILTERS: FilterValues = {
  blur: 0,
  contrast: 100,
  brightness: 100,
  grayscale: 0,
  hueRotate: 0,
  invert: 0,
  opacity: 100,
  saturate: 100,
  sepia: 0,
};

const UNSPLASH_ACCESS_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;

interface ImageSearchModalProps {
  onSelectImage: (url: string) => void;
  onClose: () => void;
}

function ImageSearchModal({ onSelectImage, onClose }: ImageSearchModalProps) {
  const [query, setQuery] = useState("minimal");
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchImages = async (searchQuery: string = "minimal") => {
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=20&page=1`,
        {
          headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        }
      );
      const data = await response.json();
      setImages(data.results);
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = async (image: any) => {
    try {
      await fetch(
        `${image.links.download_location}?client_id=${UNSPLASH_ACCESS_KEY}`
      );
    } catch (error) {
      console.error("Error triggering download:", error);
    }
  };

  return (
    <div className="mt-2 p-3 bg-[--bg-surface] rounded-lg border border-[--border-default]">
      <div className="flex gap-2 mb-3">
        <ToolInput
          value={query}
          onChange={(value) => setQuery(value)}
          placeholder="Search images..."
        />
        <button
          className="px-3 py-1.5 bg-[--bg-default] hover:bg-[--bg-hover] rounded-md text-sm flex items-center transition-colors"
          onClick={() => fetchImages(query)}
        >
          <Search className="w-3.5 h-3.5 mr-1.5" />
          Search
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative group cursor-pointer aspect-square"
            onClick={() => {
              triggerDownload(image);
              onSelectImage(image.urls.regular);
              onClose();
            }}
          >
            <img
              src={image.urls.small}
              alt={image.alt_description}
              className="w-full h-full object-cover rounded-md"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded-md" />
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center mt-3">
          <RefreshCw className="w-5 h-5 animate-spin text-[--text-default]" />
        </div>
      )}
    </div>
  );
}

export function ImageSettings() {
  const { setNodeStyle, dragState } = useBuilder();
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [showImageSearch, setShowImageSearch] = useState(false);

  const handleImageSelect = useCallback(
    (imageUrl: string) => {
      setNodeStyle({ src: imageUrl }, undefined, true);
      setShowImageSearch(false);
    },
    [setNodeStyle]
  );

  const handleFilterChange = (key: keyof FilterValues, value: number) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    const filterString = `
      blur(${newFilters.blur}px) 
      contrast(${newFilters.contrast}%) 
      brightness(${newFilters.brightness}%) 
      grayscale(${newFilters.grayscale}%) 
      hue-rotate(${newFilters.hueRotate}deg) 
      invert(${newFilters.invert}%) 
      opacity(${newFilters.opacity}%) 
      saturate(${newFilters.saturate}%) 
      sepia(${newFilters.sepia}%)
    `;

    setNodeStyle({ filter: filterString }, dragState.selectedIds);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setNodeStyle({ filter: "" }, dragState.selectedIds);
  };

  return (
    <>
      <ToolbarSection title="Image">
        <div className="space-y-4">
          <button
            onClick={() => setShowImageSearch(true)}
            className="w-full px-3 py-1.5 bg-[--bg-default] hover:bg-[--bg-hover] rounded-md text-sm flex items-center justify-center transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
            Choose Image
          </button>

          {showImageSearch && (
            <ImageSearchModal
              onSelectImage={handleImageSelect}
              onClose={() => setShowImageSearch(false)}
            />
          )}
        </div>
      </ToolbarSection>

      <ToolbarSection title="Filters">
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              className="px-3 py-1.5 bg-[--bg-default] hover:bg-[--bg-hover] rounded-md text-sm flex items-center transition-colors"
              onClick={resetFilters}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </button>
          </div>

          {Object.entries(filters).map(([key, value]) => (
            <ToolInput
              key={key}
              label={key}
              name={key}
              type="number"
              value={value}
              onChange={(value) =>
                handleFilterChange(key as keyof FilterValues, parseFloat(value))
              }
              showUnit
            />
          ))}
        </div>
      </ToolbarSection>

      <ToolbarSection title="Display">
        <div className="space-y-4">
          <ToolSelect
            label="Object Fit"
            name="objectFit"
            options={[
              { label: "Cover", value: "cover" },
              { label: "Contain", value: "contain" },
              { label: "Fill", value: "fill" },
              { label: "Scale Down", value: "scale-down" },
            ]}
            onChange={(value) =>
              setNodeStyle({ objectFit: value }, dragState.selectedIds)
            }
          />
        </div>
      </ToolbarSection>
    </>
  );
}

export default ImageSettings;
