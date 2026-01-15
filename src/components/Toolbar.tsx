import { useMemo } from 'react';
import { usePhotoStore } from '../store/photoStore';
import { formatBytes } from '../utils/format';
import clsx from 'clsx';

export function Toolbar() {
  const {
    viewMode,
    setViewMode,
    sortField,
    setSortField,
    sortOrder,
    toggleSortOrder,
    filterMode,
    setFilterMode,
    selectedIds,
    deselectAll,
    deletePhotos,
    undo,
    undoStack,
    scanDirectories,
    loading,
    photos,
    isDeleting,
  } = usePhotoStore();

  const duplicateCount = photos.filter((p) => p.isDuplicate).length;

  const hasSelection = selectedIds.size > 0;
  const canUndo = undoStack.length > 0;

  // Calculate total size of selected photos
  const selectedTotalSize = useMemo(() => {
    let total = 0;
    for (const photo of photos) {
      if (selectedIds.has(photo.id)) {
        total += photo.size;
      }
    }
    return total;
  }, [photos, selectedIds]);

  const handleDelete = async () => {
    if (!hasSelection || isDeleting) return;
    
    const sizeStr = formatBytes(selectedTotalSize);
    const count = selectedIds.size;
    const message = `Move ${count} photo${count !== 1 ? 's' : ''} (${sizeStr}) to Trash?\n\nThis will free up ${sizeStr} of storage.`;
    
    if (confirm(message)) {
      await deletePhotos(Array.from(selectedIds));
    }
  };

  return (
    <div className="flex items-center gap-4 border-b border-surface-800 bg-surface-900 px-4 py-2">
      {/* View toggle */}
      <div className="flex rounded-md border border-surface-700 bg-surface-800">
        <button
          onClick={() => setViewMode('grid')}
          className={clsx(
            'flex items-center gap-1.5 rounded-l-md px-3 py-1.5 text-sm transition-colors',
            viewMode === 'grid'
              ? 'bg-accent text-white'
              : 'text-surface-400 hover:text-surface-200'
          )}
          title="Grid view (G)"
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
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          Grid
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={clsx(
            'flex items-center gap-1.5 rounded-r-md px-3 py-1.5 text-sm transition-colors',
            viewMode === 'list'
              ? 'bg-accent text-white'
              : 'text-surface-400 hover:text-surface-200'
          )}
          title="List view"
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          List
        </button>
      </div>

      {/* Filter toggle */}
      <div className="flex rounded-md border border-surface-700 bg-surface-800">
        <button
          onClick={() => setFilterMode('duplicates')}
          className={clsx(
            'flex items-center gap-1.5 rounded-l-md px-3 py-1.5 text-sm transition-colors',
            filterMode === 'duplicates'
              ? 'bg-yellow-600 text-white'
              : 'text-surface-400 hover:text-surface-200'
          )}
          title="Show only duplicates"
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
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Duplicates
          {duplicateCount > 0 && (
            <span className="rounded bg-yellow-700/50 px-1.5 py-0.5 text-xs">
              {duplicateCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilterMode('all')}
          className={clsx(
            'flex items-center gap-1.5 rounded-r-md px-3 py-1.5 text-sm transition-colors',
            filterMode === 'all'
              ? 'bg-accent text-white'
              : 'text-surface-400 hover:text-surface-200'
          )}
          title="Show all photos"
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
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          All
        </button>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-surface-500">Sort by:</label>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as any)}
          className="rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-sm text-surface-200 focus:border-accent focus:outline-none"
        >
          <option value="date">Date</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="path">Path</option>
        </select>
        <button
          onClick={toggleSortOrder}
          className="rounded-md border border-surface-700 bg-surface-800 p-1.5 text-surface-400 hover:text-surface-200"
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          <svg
            className={clsx('h-4 w-4 transition-transform', {
              'rotate-180': sortOrder === 'asc',
            })}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1" />

      {/* Selection actions */}
      {hasSelection && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-surface-400">
            {selectedIds.size} selected
            <span className="ml-1 text-surface-500">
              ({formatBytes(selectedTotalSize)})
            </span>
          </span>
          <button
            onClick={() => deselectAll()}
            disabled={isDeleting}
            className={clsx(
              "text-sm",
              isDeleting 
                ? "cursor-not-allowed text-surface-600" 
                : "text-surface-400 hover:text-surface-200"
            )}
          >
            Clear
          </button>
          <div className="h-4 w-px bg-surface-700" />
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={clsx(
              "flex items-center gap-1 rounded-md px-2 py-1 text-sm",
              isDeleting
                ? "cursor-not-allowed bg-red-600/10 text-red-600"
                : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
            )}
          >
            {isDeleting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            ) : (
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            )}
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      {/* Undo button */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className={clsx(
          'flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors',
          canUndo
            ? 'text-surface-300 hover:bg-surface-800 hover:text-surface-100'
            : 'cursor-not-allowed text-surface-600'
        )}
        title="Undo last operation (⌘Z)"
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
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
        Undo
      </button>

      {/* Refresh button */}
      <button
        onClick={() => scanDirectories()}
        disabled={loading}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-200"
        title="Refresh"
      >
        <svg
          className={clsx('h-4 w-4', { 'animate-spin': loading })}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  );
}

