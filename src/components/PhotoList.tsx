import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePhotoStore } from '../store/photoStore';
import { useSortedPhotos } from '../hooks/useSortedPhotos';
import { formatBytes, formatDate } from '../utils/format';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import clsx from 'clsx';

const ROW_HEIGHT = 56; // Height of each row in pixels

export function PhotoList() {
  const { loading, photos, selectedIds, toggleSelection, selectPhoto } =
    usePhotoStore();
  const sortedPhotos = useSortedPhotos();
  const parentRef = useRef<HTMLDivElement>(null);

  // Helper to get duplicate original name
  const getDuplicateOfName = (duplicateOf: string | undefined) => {
    if (!duplicateOf) return null;
    const original = photos.find((p) => p.id === duplicateOf);
    return original?.name || duplicateOf.split('/').pop();
  };

  const virtualizer = useVirtualizer({
    count: sortedPhotos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // Render 10 extra rows above/below viewport
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
        <p className="text-surface-400">No photos found</p>
      </div>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Fixed header */}
      <div className="flex-shrink-0 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-surface-900 text-xs uppercase text-surface-500">
            <tr>
              <th className="w-8 px-3 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="w-12 px-3 py-2">
                <span className="sr-only">Thumbnail</span>
              </th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Folder</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Modified</th>
              <th className="px-3 py-2">Duplicate Of</th>
              <th className="w-16 px-3 py-2">Related</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Virtualized scrollable body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
      >
        <div
          className="relative w-full min-w-[900px]"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          <table className="w-full text-left text-sm">
            <tbody>
              {virtualRows.map((virtualRow) => {
                const photo = sortedPhotos[virtualRow.index];
                const isSelected = selectedIds.has(photo.id);
                const duplicateOfName = getDuplicateOfName(photo.duplicateOf);
                const thumbnailSrc = photo.thumbnailPath
                  ? convertFileSrc(photo.thumbnailPath)
                  : null;

                return (
                  <tr
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey) {
                        toggleSelection(photo.id);
                      } else {
                        selectPhoto(photo.id);
                      }
                    }}
                    className={clsx(
                      'absolute left-0 right-0 cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-accent/20 hover:bg-accent/30'
                        : 'hover:bg-surface-800/50'
                    )}
                    style={{
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {/* Checkbox */}
                    <td className="w-8 flex-shrink-0 px-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(photo.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-accent focus:ring-accent"
                      />
                    </td>

                    {/* Thumbnail */}
                    <td className="w-12 flex-shrink-0 px-3">
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
                    <td className="min-w-0 flex-1 px-3">
                      <span className="block truncate font-medium text-surface-200">
                        {photo.name}
                      </span>
                    </td>

                    {/* Folder */}
                    <td className="min-w-0 flex-1 px-3">
                      <span className="block truncate text-surface-400">
                        {photo.directory}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="w-16 flex-shrink-0 px-3">
                      <span className="rounded bg-surface-800 px-1.5 py-0.5 font-mono text-xs uppercase text-surface-400">
                        {photo.extension}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="w-20 flex-shrink-0 px-3 tabular-nums text-surface-400">
                      {formatBytes(photo.size)}
                    </td>

                    {/* Modified */}
                    <td className="w-28 flex-shrink-0 px-3 text-surface-400">
                      {formatDate(photo.modifiedAt)}
                    </td>

                    {/* Duplicate Of */}
                    <td className="w-36 flex-shrink-0 px-3">
                      {photo.isDuplicate && duplicateOfName ? (
                        <span
                          className="inline-flex max-w-[130px] items-center gap-1 truncate rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-400"
                          title={`Same size as: ${duplicateOfName}`}
                        >
                          <span className="text-yellow-500">≈</span>
                          {duplicateOfName}
                        </span>
                      ) : (
                        <span className="text-surface-600">—</span>
                      )}
                    </td>

                    {/* Related files */}
                    <td className="w-16 flex-shrink-0 px-3">
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
        </div>
      </div>
    </div>
  );
}
