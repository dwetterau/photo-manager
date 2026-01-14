import { usePhotoStore } from '../store/photoStore';
import { formatBytes } from '../utils/format';
import clsx from 'clsx';

export function StatusBar() {
  const { photos, selectedIds, scanProgress, loading } = usePhotoStore();

  const totalSize = photos.reduce((acc, p) => acc + p.size, 0);
  const duplicateCount = photos.filter((p) => p.isDuplicate).length;

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
  };

  return (
    <div className="flex items-center gap-4 border-t border-surface-800 bg-surface-900 px-4 py-2 text-xs">
      {loading && scanProgress ? (
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
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-700">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-300',
                    scanProgress.phase === 'hashing'
                      ? 'bg-yellow-500'
                      : 'bg-accent'
                  )}
                  style={{
                    width: `${Math.min(100, (scanProgress.current / scanProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <span className="tabular-nums text-surface-400">
                {scanProgress.current.toLocaleString()} / {scanProgress.total.toLocaleString()}
              </span>
            </div>
          )}

          {/* Message */}
          <span className="truncate text-surface-400">{scanProgress.message}</span>
        </div>
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
