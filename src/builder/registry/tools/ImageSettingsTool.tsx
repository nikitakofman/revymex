import React, { useState, useCallback, useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { ImageIcon, Search, RefreshCw } from "lucide-react";
import {
  ToolContainer,
  ToolSection,
  ToolLabel,
  ToolButton,
  ToolInput,
  ToolSelect,
  ToolGrid,
} from "./_components/tool-ui-kit";

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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchImages = async (
    searchQuery: string = "minimal",
    pageNum: number = 1
  ) => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=20&page=${pageNum}`,
        {
          headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        }
      );
      const data = await response.json();
      const newImages = data.results;

      if (pageNum === 1) {
        setImages(newImages);
      } else {
        setImages((prev) => [...prev, ...newImages]);
      }
      setHasMore(newImages.length > 0);
    } catch (error) {
      console.error("Error fetching images:", error);
      setHasMore(false);
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

  useEffect(() => {
    const controller = new AbortController();
    fetchImages(query, 1);
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    if (page > 1) {
      fetchImages(query, page);
    }
  }, [page, query]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.5 }
    );

    if (loaderRef.current) {
      observerRef.current.observe(loaderRef.current);
    }

    return () => {
      if (observerRef.current && loaderRef.current) {
        observerRef.current.unobserve(loaderRef.current);
      }
    };
  }, [loading, hasMore]);

  return (
    <div className="p-4 bg-[--bg-surface] rounded-[--radius-md] shadow-[--shadow-lg]">
      <div className="flex gap-2 mb-4">
        <ToolInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
            setImages([]);
          }}
          placeholder="Search images..."
        />
        <ToolButton
          onClick={() => {
            setPage(1);
            setImages([]);
            fetchImages(query, 1);
          }}
        >
          <Search className="w-4 h-4 mr-2" />
          Search
        </ToolButton>
      </div>

      <div className="grid grid-cols-3 gap-2">
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
              className="w-full h-full object-cover rounded-[--radius-sm]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded-[--radius-sm]" />
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--accent]" />
        </div>
      )}
      <div ref={loaderRef} className="h-4" />
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
    [dragState.selectedIds, setNodeStyle]
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
    <ToolContainer>
      <ToolSection>
        <ToolLabel>Image Source</ToolLabel>
        <ToolButton onClick={() => setShowImageSearch(true)} className="w-full">
          <ImageIcon className="w-4 h-4 mr-2" />
          Choose Image
        </ToolButton>

        {showImageSearch && (
          <ImageSearchModal
            onSelectImage={handleImageSelect}
            onClose={() => setShowImageSearch(false)}
          />
        )}
      </ToolSection>

      <ToolSection>
        <div className="flex items-center justify-between">
          <ToolLabel>Filters</ToolLabel>
          <ToolButton variant="default" onClick={resetFilters}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </ToolButton>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(filters).map(([key, value]) => (
            <ToolInput
              key={key}
              label={key}
              type="number"
              value={value}
              onChange={(value) =>
                handleFilterChange(key as keyof FilterValues, parseFloat(value))
              }
            />
          ))}
        </div>
      </ToolSection>

      <ToolSection>
        <ToolSelect
          label="Object Fit"
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
      </ToolSection>
    </ToolContainer>
  );
}
