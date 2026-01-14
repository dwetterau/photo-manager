import { useState } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { usePhotoStore } from '../store/photoStore';
import clsx from 'clsx';

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

export function Sidebar() {
  const {
    directories,
    addDirectory,
    removeDirectory,
    toggleDirectory,
    scanDirectories,
    loading,
  } = usePhotoStore();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddDirectory = async () => {
    setIsAdding(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Photo Directory',
      });
      if (selected && typeof selected === 'string') {
        await addDirectory(selected);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const enabledCount = directories.filter((d) => d.enabled).length;

  return (
    <aside className="flex w-64 flex-col border-r border-surface-800 bg-surface-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
        <h1 className="font-semibold text-accent">Photo Manager</h1>
      </div>

      {/* Directories section */}
      <div className="flex-1 overflow-auto p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-500">
            Directories
          </h2>
          <button
            onClick={handleAddDirectory}
            disabled={isAdding}
            className="rounded p-1 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
            title="Add directory"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {directories.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mb-2 text-surface-600">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-surface-500">No directories added</p>
            <button
              onClick={handleAddDirectory}
              className="mt-2 text-sm text-accent hover:text-accent-light"
            >
              Add your first directory
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {directories.map((dir) => (
              <li
                key={dir.path}
                className={clsx(
                  'group flex items-center gap-2 rounded-md px-2 py-1.5',
                  dir.enabled
                    ? 'bg-surface-800/50'
                    : 'opacity-50 hover:opacity-75'
                )}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleDirectory(dir.path)}
                  className={clsx(
                    'flex h-4 w-4 items-center justify-center rounded border',
                    dir.enabled
                      ? 'border-accent bg-accent text-white'
                      : 'border-surface-600'
                  )}
                >
                  {dir.enabled && (
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>

                {/* Directory name */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{dir.name}</p>
                  <p className="truncate text-xs text-surface-500" title={dir.path}>
                    {shortenPath(dir.path)}
                  </p>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeDirectory(dir.path)}
                  className="rounded p-1 text-surface-500 opacity-0 transition-all hover:bg-surface-700 hover:text-red-400 group-hover:opacity-100"
                  title="Remove directory"
                >
                  <svg
                    className="h-3.5 w-3.5"
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
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer with scan button */}
      <div className="border-t border-surface-800 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-surface-500">
            {enabledCount} of {directories.length} directories active
          </p>
        </div>
        {enabledCount > 0 && (
          <button
            onClick={() => scanDirectories()}
            disabled={loading}
            className={clsx(
              'flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              loading
                ? 'cursor-not-allowed bg-surface-800 text-surface-500'
                : 'bg-accent text-white hover:bg-accent-light'
            )}
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Scanning...
              </>
            ) : (
              <>
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Scan Directories
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
