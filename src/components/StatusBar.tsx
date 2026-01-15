import { useMemo, useEffect } from 'react';
import { usePhotoStore } from '../store/photoStore';
import { formatBytes } from '../utils/format';
import clsx from 'clsx';

export function StatusBar() {
  const { 
    photos, 
    selectedIds, 
    scanProgress, 
    loading, 
    filterMode,
    deleteProgress,
    deleteResult,
    isDeleting,
    clearDeleteResult,
  } = usePhotoStore();

  // Auto-hide delete result after timeout
  useEffect(() => {
    if (deleteResult?.show_until) {
      const remaining = deleteResult.show_until - Date.now();
      if (remaining > 0) {
        const timer = setTimeout(() => {
          clearDeleteResult();
        }, remaining);
        return () => clearTimeout(timer);
      } else {
        clearDeleteResult();
      }
    }
  }, [deleteResult, clearDeleteResult]);

  // Memoize stats calculation - single pass through photos
  const stats = useMemo(() => {
    if (loading || photos.length === 0) {
      return { totalSize: 0, duplicateCount: 0, duplicateSize: 0 };
    }
    
    let totalSize = 0;
    let duplicateCount = 0;
    let duplicateSize = 0;
    
    for (const p of photos) {
      totalSize += p.size;
      if (p.isDuplicate) {
        duplicateCount++;
        duplicateSize += p.size;
      }
    }
    
    return { totalSize, duplicateCount, duplicateSize };
  }, [photos, loading]);

  const { totalSize, duplicateCount, duplicateSize } = stats;

  // Phase display names
  const phaseLabels: Record<string, string> = {
    starting: 'Starting',
    discovery: 'Discovering files',
    grouping: 'Grouping files',
    analyzing: 'Analyzing photos',
    trailing_hash: 'Quick hash (last 1MB)',
    hashing: 'Full hash',
    duplicates: 'Finding duplicates',
    complete: 'Complete',
    preparing: 'Preparing data',
    grouping_duplicates: 'Grouping duplicates',
    rendering: 'Rendering UI',
  };

  return (
    <div className="flex items-center gap-4 border-t border-surface-800 bg-surface-900 px-4 py-2 text-xs">
      {/* Delete progress */}
      {isDeleting && deleteProgress ? (
        <div className="flex flex-1 items-center gap-3">
          {/* Spinner */}
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />

          {/* Phase label */}
          <span className="font-medium text-red-400">
            Deleting
          </span>

          {/* Progress bar */}
          {deleteProgress.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-700">
                <div
                  className="h-full rounded-full bg-red-500 transition-all duration-150"
                  style={{
                    width: `${Math.min(100, (deleteProgress.current / deleteProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-surface-400">
                {deleteProgress.current} / {deleteProgress.total}
              </span>
            </div>
          )}

          {/* Current file and bytes */}
          <span className="truncate text-surface-400">
            {deleteProgress.current_file}
          </span>
          <span className="ml-auto text-surface-500">
            {formatBytes(deleteProgress.deleted_bytes)} freed
          </span>
        </div>
      ) : deleteResult ? (
        /* Delete completion message */
        <div className="flex flex-1 items-center gap-3">
          {/* Success icon */}
          <svg
            className="h-4 w-4 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>

          <span className="font-medium text-green-400">
            Deleted {deleteResult.deleted_count} photo{deleteResult.deleted_count !== 1 ? 's' : ''}
          </span>
          
          <span className="text-surface-700">•</span>
          
          <span className="text-green-400">
            {formatBytes(deleteResult.total_bytes)} reclaimed
          </span>

          {deleteResult.failed_count > 0 && (
            <>
              <span className="text-surface-700">•</span>
              <span className="text-yellow-500">
                {deleteResult.failed_count} failed
              </span>
            </>
          )}

          <button
            onClick={clearDeleteResult}
            className="ml-auto text-surface-500 hover:text-surface-300"
            title="Dismiss"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ) : loading && scanProgress ? (
        <div className="flex flex-1 items-center gap-3">
          {/* Spinner */}
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />

          {/* Phase label */}
          <span className="font-medium text-accent">
            {phaseLabels[scanProgress.phase] || scanProgress.phase}
          </span>

          {/* Progress bar */}
          {scanProgress.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-700">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-300',
                    scanProgress.phase === 'hashing'
                      ? 'bg-yellow-500'
                      : scanProgress.phase === 'trailing_hash'
                      ? 'bg-sky-500'
                      : scanProgress.phase === 'preparing' ||
                        scanProgress.phase === 'grouping_duplicates'
                      ? 'bg-purple-500'
                      : scanProgress.phase === 'rendering'
                      ? 'bg-green-500'
                      : 'bg-accent'
                  )}
                  style={{
                    width: `${Math.min(100, (scanProgress.current / scanProgress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Message */}
          <span className="truncate text-surface-400">{scanProgress.message}</span>
        </div>
      ) : (
        <>
          {filterMode === 'duplicates' ? (
            <>
              <span className="rounded bg-yellow-600/20 px-1.5 py-0.5 text-yellow-500">
                Duplicates View
              </span>
              <span className="text-surface-700">•</span>
              <span className="text-surface-400">
                {duplicateCount.toLocaleString()} duplicate{duplicateCount !== 1 ? 's' : ''}
              </span>
              <span className="text-surface-700">•</span>
              <span className="text-yellow-500">{formatBytes(duplicateSize)} reclaimable</span>
              <span className="text-surface-700">•</span>
              <span className="text-surface-500">
                ({photos.length.toLocaleString()} total photos, {formatBytes(totalSize)})
              </span>
            </>
          ) : (
            <>
              <span className="text-surface-400">
                {photos.length.toLocaleString()} photo{photos.length !== 1 ? 's' : ''}
              </span>
              <span className="text-surface-700">•</span>
              <span className="text-surface-400">{formatBytes(totalSize)} total</span>
              {duplicateCount > 0 && (
                <>
                  <span className="text-surface-700">•</span>
                  <span className="text-yellow-500">
                    {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </>
          )}
          {selectedIds.size > 0 && (
            <>
              <span className="flex-1" />
              <span className="text-accent">
                {selectedIds.size} selected
              </span>
            </>
          )}
        </>
      )}
    </div>
  );
}
