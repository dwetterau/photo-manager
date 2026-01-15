import { useState, useCallback, useEffect } from 'react';
import { usePhotoStore } from '../store/photoStore';
import { PhotoCard } from './PhotoCard';
import { useSortedPhotos, useDuplicateGroups } from '../hooks/useSortedPhotos';
import { formatBytes, shortenPath } from '../utils/format';
import { getSmartSelections, getFullySelectedGroups } from '../utils/smartSelect';
import clsx from 'clsx';

// Limit how many items we render at once to prevent memory issues
const INITIAL_RENDER_LIMIT = 50;
const LOAD_MORE_INCREMENT = 50;

export function PhotoGrid() {
  const { loading, photos, filterMode, scanProgress, revealInFinder, selectedIds, toggleSelection, selectMultiple } = usePhotoStore();
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

    // Compute smart selections (only for visible groups)
    const smartSelections = getSmartSelections(displayedGroups);
    const smartSelectCount = smartSelections.size;
    
    // Check for groups with all photos selected (error state)
    const fullySelectedCount = getFullySelectedGroups(displayedGroups, selectedIds);
    
    const handleSmartSelect = () => {
      selectMultiple(Array.from(smartSelections));
    };
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
            <div className="flex-1">
              <p className="font-medium text-yellow-100">
                {duplicateGroups.length} duplicate group{duplicateGroups.length !== 1 ? 's' : ''} found
              </p>
              <p className="text-sm text-yellow-300/80">
                {duplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0)} duplicate files
                using {formatBytes(totalDuplicateSize)} of space
              </p>
            </div>
            {smartSelectCount > 0 && (
              <button
                onClick={handleSmartSelect}
                className="flex items-center gap-1.5 rounded-md bg-accent/20 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/30"
                title="Auto-select non-Camera Uploads photos that have copies in Camera Uploads"
              >
                <span>🪄</span>
                <span>Smart Select</span>
                <span className="rounded-full bg-accent/30 px-1.5 py-0.5 text-xs">
                  {smartSelectCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Error: all photos in a group selected */}
        {fullySelectedCount > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="text-red-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-red-100">
                  {fullySelectedCount} group{fullySelectedCount !== 1 ? 's have' : ' has'} all copies selected
                </p>
                <p className="text-sm text-red-300/80">
                  Deselect at least one photo from each group to keep a copy
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hint about click behavior */}
        <div className="text-xs text-surface-500">
          Click to select for deletion
        </div>

        {/* Duplicate groups - paginated */}
        {displayedGroups.map((group) => {
          const isOriginalSelected = selectedIds.has(group.original.id);
          
          return (
            <div
              key={group.originalId}
              className="rounded-lg border border-surface-700 bg-surface-800/50"
            >
              {/* Group header with full path */}
              <div 
                className={clsx(
                  "group border-b border-surface-700 px-4 py-3 cursor-pointer transition-colors",
                  isOriginalSelected 
                    ? "bg-accent/20 hover:bg-accent/30" 
                    : "hover:bg-surface-700/50"
                )}
                onClick={() => toggleSelection(group.original.id)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isOriginalSelected}
                    onChange={() => toggleSelection(group.original.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-accent focus:ring-accent"
                  />
                  <span className="rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white shrink-0">Original</span>
                  <span className="text-sm font-medium text-white truncate">{group.original.name}</span>
                  <span className="rounded bg-surface-700 px-2 py-0.5 text-xs text-surface-400 shrink-0">
                    {formatBytes(group.original.size)}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      revealInFinder(group.original.path);
                    }}
                    className="shrink-0 rounded p-1 text-surface-500 transition-colors hover:bg-surface-600 hover:text-surface-200"
                    title="Reveal in Finder"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
                <div className="mt-1 ml-6 text-xs text-surface-500 font-mono truncate" title={group.original.path}>
                  {shortenPath(group.original.path)}
                </div>
              </div>

              {/* Original + duplicates grid */}
              <div className="p-4">
                {/* Duplicates list with paths */}
                <div className="mb-3 space-y-1">
                  {group.duplicates.map((dup, idx) => {
                    const isDupSelected = selectedIds.has(dup.id);
                    return (
                      <div 
                        key={`path-${dup.id}`}
                        className={clsx(
                          "flex items-center gap-2 text-xs cursor-pointer rounded px-2 py-1 transition-colors",
                          isDupSelected
                            ? "bg-accent/20 hover:bg-accent/30"
                            : "hover:bg-surface-700/30"
                        )}
                        onClick={() => toggleSelection(dup.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isDupSelected}
                          onChange={() => toggleSelection(dup.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 rounded border-surface-600 bg-surface-800 text-accent focus:ring-accent"
                        />
                        <span className="rounded bg-yellow-600 px-1 py-0.5 text-[10px] font-medium text-black shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="text-surface-400 font-mono truncate flex-1" title={dup.path}>
                          {shortenPath(dup.path)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            revealInFinder(dup.path);
                          }}
                          className="shrink-0 rounded p-0.5 text-surface-500 transition-colors hover:bg-surface-600 hover:text-surface-200"
                          title="Reveal in Finder"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                  {/* Original - shown with green border */}
                  <div className="relative">
                    <div className={clsx(
                      "absolute -inset-0.5 rounded-lg",
                      isOriginalSelected ? "bg-accent/50" : "bg-green-500/30"
                    )} />
                    <div className="absolute -top-2 left-2 z-10 rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white">
                      Keep
                    </div>
                    <PhotoCard photo={group.original} duplicateMode={true} />
                  </div>

                  {/* Duplicates - shown with yellow/red border */}
                  {group.duplicates.map((dup, idx) => {
                    const isDupSelected = selectedIds.has(dup.id);
                    return (
                      <div key={dup.id} className="relative">
                        <div className={clsx(
                          "absolute -inset-0.5 rounded-lg",
                          isDupSelected ? "bg-accent/50" : "bg-yellow-500/30"
                        )} />
                        <div className="absolute -top-2 left-2 z-10 rounded bg-yellow-600 px-1.5 py-0.5 text-xs font-medium text-black">
                          Dup #{idx + 1}
                        </div>
                        <PhotoCard photo={dup} duplicateMode={true} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

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
