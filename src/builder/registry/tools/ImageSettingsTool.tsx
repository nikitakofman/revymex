import React, { useState, useCallback, useEffect, useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { ImageIcon, Search, RefreshCw } from "lucide-react";
import {
  ToolContainer,
  ToolSection,
  ToolLabel,
  ToolButton,
  ToolInput,
  ToolGrid,
} from "./_components/tool-ui";

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
  const observerRef = useRef<IntersectionObserver>();
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
    <div className="p-4 bg-[var(--bg-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)]">
      <div className="flex gap-2 mb-4">
        <ToolInput
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
            setImages([]);
          }}
          placeholder="Search images..."
          className="flex-1"
        />
        <ToolButton
          onClick={() => {
            setPage(1);
            setImages([]);
            fetchImages(query, 1);
          }}
        >
          <Search className="w-4 h-4" />
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
              className="w-full h-full object-cover rounded-[var(--radius-sm)]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded-[var(--radius-sm)]" />
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
        </div>
      )}
      <div ref={loaderRef} className="h-4" />
    </div>
  );
}

export function ImageSettings() {
  const { nodeDisp, dragState, setNodeStyle } = useBuilder();
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [showImageSearch, setShowImageSearch] = useState(false);

  const handleImageSelect = useCallback(
    (imageUrl: string) => {
      setNodeStyle({ src: imageUrl }, undefined, true);
      setShowImageSearch(false);
    },
    [dragState.selectedIds, nodeDisp]
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
        <div className="flex gap-2">
          <ToolButton
            onClick={() => setShowImageSearch(true)}
            className="flex-1"
          >
            <ImageIcon className="w-4 h-4" />
            Choose Image
          </ToolButton>
        </div>

        {showImageSearch && (
          <ImageSearchModal
            onSelectImage={handleImageSelect}
            onClose={() => setShowImageSearch(false)}
          />
        )}
      </ToolSection>

      <ToolSection>
        <div className="flex items-center justify-between mb-2">
          <ToolLabel>Filters</ToolLabel>
          <ToolButton size="sm" onClick={resetFilters}>
            <RefreshCw className="w-3 h-3" />
            Reset
          </ToolButton>
        </div>

        <ToolGrid>
          {Object.entries(filters).map(([key, value]) => (
            <div key={key} className="flex flex-col items-center">
              <ToolInput
                type="number"
                value={value}
                onChange={(e) =>
                  handleFilterChange(
                    key as keyof FilterValues,
                    parseFloat(e.target.value)
                  )
                }
                label={key}
              />
            </div>
          ))}
        </ToolGrid>
      </ToolSection>

      <ToolSection>
        <ToolLabel>Object Fit</ToolLabel>
        <select
          className="w-full p-2 bg-[var(--control-bg)] border border-[var(--control-border)] rounded-[var(--radius-sm)]"
          onChange={(e) =>
            setNodeStyle({ objectFit: e.target.value }, dragState.selectedIds)
          }
        >
          <option value="cover">Cover</option>
          <option value="contain">Contain</option>
          <option value="fill">Fill</option>
          <option value="scale-down">Scale Down</option>
        </select>
      </ToolSection>
    </ToolContainer>
  );
}
