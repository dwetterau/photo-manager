import { useRef, useState, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePhotoStore } from '../store/photoStore';
import { PhotoCard } from './PhotoCard';
import { useSortedPhotos } from '../hooks/useSortedPhotos';

const ITEM_MIN_WIDTH = 180;
const GAP = 16;

export function PhotoGrid() {
  const { loading, photos } = usePhotoStore();
  const sortedPhotos = useSortedPhotos();
  const parentRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(4);

  // Calculate column count based on container width
  const updateColumnCount = useCallback(() => {
    if (!parentRef.current) return;
    const containerWidth = parentRef.current.clientWidth;
    // Account for padding (16px on each side)
    const availableWidth = containerWidth;
    // Calculate how many items fit (minmax behavior)
    const cols = Math.max(1, Math.floor((availableWidth + GAP) / (ITEM_MIN_WIDTH + GAP)));
    setColumnCount(cols);
  }, []);

  useEffect(() => {
    updateColumnCount();
    const resizeObserver = new ResizeObserver(updateColumnCount);
    if (parentRef.current) {
      resizeObserver.observe(parentRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [updateColumnCount]);

  const rowCount = Math.ceil(sortedPhotos.length / columnCount);

  // Calculate item height dynamically based on column width
  const getItemHeight = useCallback(() => {
    if (!parentRef.current) return 220;
    const containerWidth = parentRef.current.clientWidth;
    const itemWidth = (containerWidth - GAP * (columnCount - 1)) / columnCount;
    // aspect-square + info overlay (roughly 60px for text)
    return itemWidth + 8; // Square + small padding for borders
  }, [columnCount]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: getItemHeight,
    overscan: 3, // Render 3 extra rows above/below viewport
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-surface-400">Scanning directories...</p>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-surface-600">
            <svg
              className="mx-auto h-16 w-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-lg text-surface-400">No photos found</p>
          <p className="text-sm text-surface-500">
            Add directories to start managing your photos
          </p>
        </div>
      </div>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowPhotos = sortedPhotos.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 right-0 grid"
              style={{
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                gap: `${GAP}px`,
                height: `${virtualRow.size}px`,
              }}
            >
              {rowPhotos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
