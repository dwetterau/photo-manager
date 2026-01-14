import { useState, useCallback, useEffect } from 'react';
import { usePhotoStore } from '../store/photoStore';
import { PhotoCard } from './PhotoCard';
import { useSortedPhotos, useDuplicateGroups } from '../hooks/useSortedPhotos';
import { formatBytes } from '../utils/format';

// Limit how many items we render at once to prevent memory issues
const INITIAL_RENDER_LIMIT = 50;
const LOAD_MORE_INCREMENT = 50;

// Path prefixes to shorten for display
const PATH_SHORTCUTS: [string, string][] = [
  ['/Users/davidw/Library/CloudStorage/Dropbox/', '/Dropbox/'],
];

// Shorten a path for display
function shortenPath(path: string): string {
  for (const [prefix, replacement] of PATH_SHORTCUTS) {
    if (path.startsWith(prefix)) {
      return replacement + path.slice(prefix.length);
    }
  }
  return path;
}

export function PhotoGrid() {
  const { loading, photos, filterMode, scanProgress, revealInFinder } = usePhotoStore();
  const sortedPhotos = useSortedPhotos();
  const duplicateGroups = useDuplicateGroups();
  
  // Pagination state
  const [visibleGroups, setVisibleGroups] = useState(INITIAL_RENDER_LIMIT);
  const [visiblePhotos, setVisiblePhotos] = useState(INITIAL_RENDER_LIMIT);
  
  // Reset pagination when filter mode or photos change
  useEffect(() => {
    setVisibleGroups(INITIAL_RENDER_LIMIT);
    setVisiblePhotos(INITIAL_RENDER_LIMIT);
  }, [filterMode, photos.length]);
  
  const loadMoreGroups = useCallback(() => {
    setVisibleGroups((prev) => prev + LOAD_MORE_INCREMENT);
  }, []);
  
  const loadMorePhotos = useCallback(() => {
    setVisiblePhotos((prev) => prev + LOAD_MORE_INCREMENT);
  }, []);
  
  // Handle click to reveal in Finder (default), cmd+click does nothing here (handled by PhotoCard)
  const handleRevealClick = useCallback((e: React.MouseEvent, path: string) => {
    if (!(e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      revealInFinder(path);
    }
  }, [revealInFinder]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-surface-400">
            {scanProgress?.message || 'Scanning directories...'}
          </p>
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

  // Duplicates mode: show grouped view
  if (filterMode === 'duplicates') {
    if (duplicateGroups.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-green-500">
              <svg
                className="mx-auto h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-lg text-surface-400">No duplicates found</p>
            <p className="text-sm text-surface-500">
              {photos.length.toLocaleString()} photos scanned, all unique!
            </p>
          </div>
        </div>
      );
    }

    const totalDuplicateSize = duplicateGroups.reduce(
      (acc, g) => acc + g.duplicates.reduce((a, d) => a + d.size, 0),
      0
    );

    const displayedGroups = duplicateGroups.slice(0, visibleGroups);
    const hasMoreGroups = visibleGroups < duplicateGroups.length;
    const remainingGroups = duplicateGroups.length - visibleGroups;

    return (
      <div className="space-y-6">
        {/* Summary header */}
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="text-yellow-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-yellow-100">
                {duplicateGroups.length} duplicate group{duplicateGroups.length !== 1 ? 's' : ''} found
              </p>
              <p className="text-sm text-yellow-300/80">
                {duplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0)} duplicate files
                using {formatBytes(totalDuplicateSize)} of space
              </p>
            </div>
          </div>
        </div>

        {/* Hint about click behavior */}
        <div className="text-xs text-surface-500">
          Click to reveal in Finder • ⌘+click to select for deletion
        </div>

        {/* Duplicate groups - paginated */}
        {displayedGroups.map((group) => (
          <div
            key={group.originalId}
            className="rounded-lg border border-surface-700 bg-surface-800/50"
          >
            {/* Group header with full path */}
            <div 
              className="border-b border-surface-700 px-4 py-3 cursor-pointer hover:bg-surface-700/50 transition-colors"
              onClick={(e) => handleRevealClick(e, group.original.path)}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white shrink-0">Original</span>
                <span className="text-sm font-medium text-white">{group.original.name}</span>
                <span className="rounded bg-surface-700 px-2 py-0.5 text-xs text-surface-400 shrink-0">
                  {formatBytes(group.original.size)}
                </span>
              </div>
              <div className="mt-1 text-xs text-surface-500 font-mono truncate" title={group.original.path}>
                {shortenPath(group.original.path)}
              </div>
            </div>

            {/* Original + duplicates grid */}
            <div className="p-4">
              {/* Duplicates list with paths */}
              <div className="mb-3 space-y-1">
                {group.duplicates.map((dup, idx) => (
                  <div 
                    key={`path-${dup.id}`}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-surface-700/30 rounded px-2 py-1 transition-colors"
                    onClick={(e) => handleRevealClick(e, dup.path)}
                  >
                    <span className="rounded bg-yellow-600 px-1 py-0.5 text-[10px] font-medium text-black shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="text-surface-400 font-mono truncate" title={dup.path}>
                      {shortenPath(dup.path)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {/* Original - shown with green border */}
                <div className="relative" onClick={(e) => handleRevealClick(e, group.original.path)}>
                  <div className="absolute -inset-0.5 rounded-lg bg-green-500/30" />
                  <div className="absolute -top-2 left-2 z-10 rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white">
                    Keep
                  </div>
                  <PhotoCard photo={group.original} />
                </div>

                {/* Duplicates - shown with yellow/red border */}
                {group.duplicates.map((dup, idx) => (
                  <div key={dup.id} className="relative" onClick={(e) => handleRevealClick(e, dup.path)}>
                    <div className="absolute -inset-0.5 rounded-lg bg-yellow-500/30" />
                    <div className="absolute -top-2 left-2 z-10 rounded bg-yellow-600 px-1.5 py-0.5 text-xs font-medium text-black">
                      Dup #{idx + 1}
                    </div>
                    <PhotoCard photo={dup} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Load more button */}
        {hasMoreGroups && (
          <div className="flex justify-center py-4">
            <button
              onClick={loadMoreGroups}
              className="rounded-lg bg-surface-700 px-6 py-3 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-600"
            >
              Load {Math.min(LOAD_MORE_INCREMENT, remainingGroups)} more groups
              <span className="ml-2 text-surface-400">
                ({remainingGroups} remaining)
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // All photos mode: regular grid with pagination
  const displayedPhotos = sortedPhotos.slice(0, visiblePhotos);
  const hasMorePhotos = visiblePhotos < sortedPhotos.length;
  const remainingPhotos = sortedPhotos.length - visiblePhotos;

  return (
    <div className="space-y-6">
      {/* Photo count header */}
      <div className="text-sm text-surface-400">
        Showing {displayedPhotos.length.toLocaleString()} of {sortedPhotos.length.toLocaleString()} photos
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {displayedPhotos.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} />
        ))}
      </div>

      {/* Load more button */}
      {hasMorePhotos && (
        <div className="flex justify-center py-4">
          <button
            onClick={loadMorePhotos}
            className="rounded-lg bg-surface-700 px-6 py-3 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-600"
          >
            Load {Math.min(LOAD_MORE_INCREMENT, remainingPhotos)} more photos
            <span className="ml-2 text-surface-400">
              ({remainingPhotos.toLocaleString()} remaining)
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
