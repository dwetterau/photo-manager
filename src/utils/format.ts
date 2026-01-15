import { format } from 'date-fns';

// Path prefixes to shorten for display
export const PATH_SHORTCUTS: [string, string][] = [
  ['/Users/davidw/Library/CloudStorage/Dropbox/', '/Dropbox/'],
  ['/Users/davidw/Desktop/', '/Desktop/'],
];

// Shorten a path for display
export function shortenPath(path: string): string {
  for (const [prefix, replacement] of PATH_SHORTCUTS) {
    if (path.startsWith(prefix)) {
      return replacement + path.slice(prefix.length);
    }
  }
  return path;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'MMM d, yyyy HH:mm');
}

