import { useState, useCallback, useEffect } from 'react';
import { usePhotoStore } from '../store/photoStore';
import { useSortedPhotos, useDuplicateGroups } from '../hooks/useSortedPhotos';
import { formatBytes, formatDate } from '../utils/format';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import clsx from 'clsx';

// Limit how many items we render at once to prevent memory issues
const INITIAL_RENDER_LIMIT = 100;
const LOAD_MORE_INCREMENT = 100;

// RAW extensions that browsers can't display
const RAW_EXTENSIONS = ['arw', 'cr2', 'cr3', 'nef', 'dng', 'raf', 'orf', 'rw2', 'pef'];

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

export function PhotoList() {
  const { loading, photos, selectedIds, toggleSelection, filterMode, scanProgress, revealInFinder } =
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

  // Handle click: default = reveal in Finder, cmd+click = toggle selection
  const handleRowClick = useCallback((e: React.MouseEvent, photoId: string, photoPath: string) => {
    if (e.metaKey || e.ctrlKey) {
      toggleSelection(photoId);
    } else {
      revealInFinder(photoPath);
    }
  }, [toggleSelection, revealInFinder]);

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

    return (
      <div className="overflow-x-auto p-4">
        <p className="mb-4 text-xs text-surface-500">
          Click to reveal in Finder • ⌘+click to select for deletion
        </p>
        
        {visibleGroups.map((group) => (
          <div key={group.originalId} className="mb-6 rounded-lg border border-surface-700 bg-surface-800/30">
            {/* Group header: Original file */}
            <div className="border-b border-surface-700 bg-surface-800/50 px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Thumbnail */}
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-surface-800">
                  {group.original.thumbnailPath && !isRawThumbnail(group.original.thumbnailPath) ? (
                    <img
                      src={convertFileSrc(group.original.thumbnailPath)}
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
                
                {/* Original info */}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-surface-200">
                    Original: {group.original.name}
                  </p>
                  <p
                    className="cursor-pointer truncate font-mono text-xs text-surface-400 hover:text-accent"
                    title={group.original.path}
                    onClick={(e) => handleRowClick(e, group.original.id, group.original.path)}
                  >
                    {shortenPath(group.original.path)}
                  </p>
                </div>
                
                {/* Stats */}
                <div className="text-right text-sm text-surface-400">
                  <p>{formatBytes(group.original.size)}</p>
                  <p className="text-xs">{group.duplicates.length} duplicate{group.duplicates.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* Duplicate rows */}
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-900/50 text-xs uppercase text-surface-500">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="w-12 px-3 py-2">
                    <span className="sr-only">Thumbnail</span>
                  </th>
                  <th className="px-3 py-2">Full Path</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {group.duplicates.map((dup) => {
                  const isSelected = selectedIds.has(dup.id);
                  const thumbnailSrc = dup.thumbnailPath && !isRawThumbnail(dup.thumbnailPath)
                    ? convertFileSrc(dup.thumbnailPath)
                    : null;

                  return (
                    <tr
                      key={dup.id}
                      onClick={(e) => handleRowClick(e, dup.id, dup.path)}
                      className={clsx(
                        'cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-accent/20 hover:bg-accent/30'
                          : 'hover:bg-surface-800/50'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(dup.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-accent focus:ring-accent"
                        />
                      </td>

                      {/* Thumbnail */}
                      <td className="px-3 py-2">
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
                                {dup.extension}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Full Path */}
                      <td className="px-3 py-2">
                        <span
                          className="block truncate font-mono text-sm text-surface-300"
                          title={dup.path}
                        >
                          {dup.isCloudPlaceholder && (
                            <span className="mr-1.5 text-sky-400" title="Cloud placeholder">☁️</span>
                          )}
                          {shortenPath(dup.path)}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="px-3 py-2 tabular-nums text-surface-400">
                        {formatBytes(dup.size)}
                      </td>

                      {/* Modified */}
                      <td className="px-3 py-2 text-surface-400">
                        {formatDate(dup.modifiedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

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
        Click to reveal in Finder • ⌘+click to select for deletion
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
                onClick={(e) => handleRowClick(e, photo.id, photo.path)}
                className={clsx(
                  'cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-accent/20 hover:bg-accent/30'
                    : 'hover:bg-surface-800/50'
                )}
              >
                {/* Checkbox */}
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(photo.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-accent focus:ring-accent"
                  />
                </td>

                {/* Thumbnail */}
                <td className="px-3 py-2">
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

                {/* Name */}
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5 font-medium text-surface-200">
                    {photo.isCloudPlaceholder && (
                      <span className="text-sky-400" title="Cloud placeholder">☁️</span>
                    )}
                    {photo.name}
                  </span>
                </td>

                {/* Full Path */}
                <td className="px-3 py-2">
                  <span className="block max-w-[300px] truncate font-mono text-xs text-surface-400" title={photo.path}>
                    {shortenPath(photo.path)}
                  </span>
                </td>

                {/* Type */}
                <td className="px-3 py-2">
                  <span className="rounded bg-surface-800 px-1.5 py-0.5 font-mono text-xs uppercase text-surface-400">
                    {photo.extension}
                  </span>
                </td>

                {/* Size */}
                <td className="px-3 py-2 tabular-nums text-surface-400">
                  {formatBytes(photo.size)}
                </td>

                {/* Modified */}
                <td className="px-3 py-2 text-surface-400">
                  {formatDate(photo.modifiedAt)}
                </td>

                {/* Related files */}
                <td className="px-3 py-2">
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
