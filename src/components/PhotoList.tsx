import { useState, useCallback, useEffect } from 'react';
import { usePhotoStore } from '../store/photoStore';
import { useSortedPhotos, useDuplicateGroups } from '../hooks/useSortedPhotos';
import { formatBytes, formatDate, shortenPath } from '../utils/format';
import { getSmartSelections, getFullySelectedGroups } from '../utils/smartSelect';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import clsx from 'clsx';

// Limit how many items we render at once to prevent memory issues
const INITIAL_RENDER_LIMIT = 100;
const LOAD_MORE_INCREMENT = 100;

// RAW extensions that browsers can't display
const RAW_EXTENSIONS = ['arw', 'cr2', 'cr3', 'nef', 'dng', 'raf', 'orf', 'rw2', 'pef'];

export function PhotoList() {
  const { loading, photos, selectedIds, toggleSelection, selectMultiple, filterMode, scanProgress, revealInFinder } =
    usePhotoStore();
  const sortedPhotos = useSortedPhotos();
  const duplicateGroups = useDuplicateGroups();
  
  // Pagination state
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_LIMIT);
  
  // Reset pagination when filter mode or photos change
  useEffect(() => {
    setVisibleCount(INITIAL_RENDER_LIMIT);
  }, [filterMode, photos.length]);
  
  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + LOAD_MORE_INCREMENT);
  }, []);

  // Check if a thumbnail path is a RAW file (can't be displayed in browser)
  const isRawThumbnail = (thumbnailPath: string | undefined): boolean => {
    if (!thumbnailPath) return false;
    const ext = thumbnailPath.split('.').pop()?.toLowerCase() || '';
    return RAW_EXTENSIONS.includes(ext);
  };

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
        <p className="text-surface-400">No photos found</p>
      </div>
    );
  }

  if (filterMode === 'duplicates' && duplicateGroups.length === 0) {
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

  // Duplicates mode: grouped view
  if (filterMode === 'duplicates') {
    const visibleGroups = duplicateGroups.slice(0, visibleCount);
    const hasMore = duplicateGroups.length > visibleCount;

    const totalDuplicateSize = duplicateGroups.reduce(
      (acc, g) => acc + g.duplicates.reduce((a, d) => a + d.size, 0),
      0
    );

    // Compute smart selections (only for visible groups)
    const smartSelections = getSmartSelections(visibleGroups);
    const smartSelectCount = smartSelections.size;
    
    // Check for groups with all photos selected (error state)
    const fullySelectedCount = getFullySelectedGroups(visibleGroups, selectedIds);
    
    const handleSmartSelect = () => {
      selectMultiple(Array.from(smartSelections));
    };

    return (
      <div className="overflow-x-auto p-4">
        {/* Summary header */}
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
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
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
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

        <p className="mb-4 text-xs text-surface-500">
          Click row to select for deletion
        </p>
        
        {visibleGroups.map((group) => {
          const isOriginalSelected = selectedIds.has(group.original.id);
          const originalThumbnailSrc = group.original.thumbnailPath && !isRawThumbnail(group.original.thumbnailPath)
            ? convertFileSrc(group.original.thumbnailPath)
            : null;

          return (
            <div key={group.originalId} className="mb-6 rounded-lg border border-surface-700 bg-surface-800/30">
              {/* Group header: Original file - styled same as duplicate rows */}
              <div
                className={clsx(
                  'flex cursor-pointer items-center gap-2 border-b border-surface-700 py-2 pr-3 transition-colors',
                  isOriginalSelected
                    ? 'bg-accent/20 hover:bg-accent/30'
                    : 'bg-surface-800/50 hover:bg-surface-700/50'
                )}
                onClick={() => toggleSelection(group.original.id)}
              >
                {/* Checkbox */}
                <div className="px-3">
                  <input
                    type="checkbox"
                    checked={isOriginalSelected}
                    onChange={() => toggleSelection(group.original.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-accent focus:ring-accent"
                  />
                </div>

                {/* Thumbnail */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-800">
                  {originalThumbnailSrc ? (
                    <img
                      src={originalThumbnailSrc}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-surface-600">
                      <span className="text-[8px] font-bold uppercase">
                        {group.original.extension}
                      </span>
                    </div>
                  )}
                </div>

                {/* Path */}
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-surface-300">
                    {group.original.isCloudPlaceholder && (
                      <span className="mr-1.5 text-sky-400" title="Cloud placeholder">☁️</span>
                    )}
                    {shortenPath(group.original.path)}
                  </span>
                </div>

                {/* Size & Date */}
                <div className="shrink-0 text-right text-xs tabular-nums text-surface-500">
                  {formatBytes(group.original.size)} · {formatDate(group.original.modifiedAt)}
                </div>

                {/* Finder button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    revealInFinder(group.original.path);
                  }}
                  className="shrink-0 rounded p-1.5 text-surface-500 transition-colors hover:bg-surface-600 hover:text-surface-200"
                  title="Reveal in Finder"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </div>

              {/* Duplicate rows */}
              <div className="divide-y divide-surface-800">
                {group.duplicates.map((dup) => {
                  const isSelected = selectedIds.has(dup.id);
                  const thumbnailSrc = dup.thumbnailPath && !isRawThumbnail(dup.thumbnailPath)
                    ? convertFileSrc(dup.thumbnailPath)
                    : null;

                  return (
                    <div
                      key={dup.id}
                      className={clsx(
                        'flex cursor-pointer items-center gap-2 py-2 pr-3 transition-colors',
                        isSelected
                          ? 'bg-accent/20 hover:bg-accent/30'
                          : 'hover:bg-surface-800/50'
                      )}
                      onClick={() => toggleSelection(dup.id)}
                    >
                      {/* Checkbox */}
                      <div className="px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(dup.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-accent focus:ring-accent"
                        />
                      </div>

                      {/* Thumbnail */}
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-800">
                        {thumbnailSrc ? (
                          <img
                            src={thumbnailSrc}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-surface-600">
                            <span className="text-[8px] font-bold uppercase">
                              {dup.extension}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Path */}
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm text-surface-300">
                          {dup.isCloudPlaceholder && (
                            <span className="mr-1.5 text-sky-400" title="Cloud placeholder">☁️</span>
                          )}
                          {shortenPath(dup.path)}
                        </span>
                      </div>

                      {/* Size & Date combined */}
                      <div className="shrink-0 text-right text-xs tabular-nums text-surface-500">
                        {formatBytes(dup.size)} · {formatDate(dup.modifiedAt)}
                      </div>

                      {/* Finder button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          revealInFinder(dup.path);
                        }}
                        className="shrink-0 rounded p-1.5 text-surface-500 transition-colors hover:bg-surface-600 hover:text-surface-200"
                        title="Reveal in Finder"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={loadMore}
              className="rounded-md bg-surface-800 px-4 py-2 text-sm text-surface-300 transition-colors hover:bg-surface-700"
            >
              Load more ({duplicateGroups.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    );
  }

  // All photos mode: flat table view
  const visiblePhotos = sortedPhotos.slice(0, visibleCount);
  const hasMore = sortedPhotos.length > visibleCount;

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 px-3 text-xs text-surface-500">
        Click checkbox/thumbnail to select • Click elsewhere to reveal in Finder
      </p>
      
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="sticky top-0 bg-surface-900 text-xs uppercase text-surface-500">
          <tr>
            <th className="w-8 px-3 py-2">
              <span className="sr-only">Select</span>
            </th>
            <th className="w-12 px-3 py-2">
              <span className="sr-only">Thumbnail</span>
            </th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Full Path</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Modified</th>
            <th className="w-16 px-3 py-2">Related</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-800">
          {visiblePhotos.map((photo) => {
            const isSelected = selectedIds.has(photo.id);
            const thumbnailSrc = photo.thumbnailPath && !isRawThumbnail(photo.thumbnailPath)
              ? convertFileSrc(photo.thumbnailPath)
              : null;

            return (
              <tr
                key={photo.id}
                className={clsx(
                  'transition-colors',
                  isSelected
                    ? 'bg-accent/20 hover:bg-accent/30'
                    : 'hover:bg-surface-800/50'
                )}
              >
                {/* Checkbox - click to select */}
                <td
                  className="cursor-pointer px-3 py-2"
                  onClick={() => toggleSelection(photo.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(photo.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-accent focus:ring-accent"
                  />
                </td>

                {/* Thumbnail - click to select */}
                <td
                  className="cursor-pointer px-3 py-2"
                  onClick={() => toggleSelection(photo.id)}
                >
                  <div className="h-10 w-10 overflow-hidden rounded bg-surface-800">
                    {thumbnailSrc ? (
                      <img
                        src={thumbnailSrc}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-surface-600">
                        <span className="text-[8px] font-bold uppercase">
                          {photo.extension}
                        </span>
                      </div>
                    )}
                  </div>
                </td>

                {/* Name - click to reveal */}
                <td
                  className="cursor-pointer px-3 py-2"
                  onClick={() => revealInFinder(photo.path)}
                >
                  <span className="flex items-center gap-1.5 font-medium text-surface-200 hover:text-accent">
                    {photo.isCloudPlaceholder && (
                      <span className="text-sky-400" title="Cloud placeholder">☁️</span>
                    )}
                    {photo.name}
                  </span>
                </td>

                {/* Full Path - click to reveal */}
                <td
                  className="cursor-pointer px-3 py-2"
                  onClick={() => revealInFinder(photo.path)}
                >
                  <span className="block max-w-[300px] truncate font-mono text-xs text-surface-400 hover:text-accent" title={photo.path}>
                    {shortenPath(photo.path)}
                  </span>
                </td>

                {/* Type - click to reveal */}
                <td
                  className="cursor-pointer px-3 py-2"
                  onClick={() => revealInFinder(photo.path)}
                >
                  <span className="rounded bg-surface-800 px-1.5 py-0.5 font-mono text-xs uppercase text-surface-400">
                    {photo.extension}
                  </span>
                </td>

                {/* Size - click to reveal */}
                <td
                  className="cursor-pointer px-3 py-2 tabular-nums text-surface-400"
                  onClick={() => revealInFinder(photo.path)}
                >
                  {formatBytes(photo.size)}
                </td>

                {/* Modified - click to reveal */}
                <td
                  className="cursor-pointer px-3 py-2 text-surface-400"
                  onClick={() => revealInFinder(photo.path)}
                >
                  {formatDate(photo.modifiedAt)}
                </td>

                {/* Related files - click to reveal */}
                <td
                  className="cursor-pointer px-3 py-2"
                  onClick={() => revealInFinder(photo.path)}
                >
                  {photo.relatedFiles.length > 0 ? (
                    <span
                      className="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400"
                      title={photo.relatedFiles.map((f) => f.name).join(', ')}
                    >
                      +{photo.relatedFiles.length}
                    </span>
                  ) : (
                    <span className="text-surface-600">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {hasMore && (
        <div className="mt-4 pb-4 text-center">
          <button
            onClick={loadMore}
            className="rounded-md bg-surface-800 px-4 py-2 text-sm text-surface-300 transition-colors hover:bg-surface-700"
          >
            Load more ({sortedPhotos.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
