import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface PhotoFile {
  id: string;
  path: string;
  name: string;
  directory: string;
  extension: string;
  size: number;
  modifiedAt: number;
  hash?: string;
  thumbnailPath?: string;
  // Related files (collapsed metadata)
  relatedFiles: RelatedFile[];
  // Duplicate info
  isDuplicate: boolean;
  duplicateOf?: string;
  // Cloud storage status
  isCloudPlaceholder: boolean;
}

export interface RelatedFile {
  path: string;
  name: string;
  type: 'sidecar' | 'jpeg-preview' | 'raw';
}

export interface DirectoryConfig {
  path: string;
  enabled: boolean;
  name: string;
}

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'date' | 'size' | 'path';
export type SortOrder = 'asc' | 'desc';
export type FilterMode = 'duplicates' | 'all';

interface UndoOperation {
  type: 'move';
  timestamp: number;
  operations: Array<{ from: string; to: string }>;
}

export interface ScanProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

interface PhotoState {
  // View state
  viewMode: ViewMode;
  sortField: SortField;
  sortOrder: SortOrder;
  filterMode: FilterMode;

  // Directory management
  directories: DirectoryConfig[];

  // Photos
  photos: PhotoFile[];
  loading: boolean;
  scanProgress: ScanProgress | null;

  // Selection
  selectedIds: Set<string>;

  // Undo stack
  undoStack: UndoOperation[];

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  toggleSortOrder: () => void;
  setFilterMode: (mode: FilterMode) => void;

  addDirectory: (path: string) => Promise<void>;
  removeDirectory: (path: string) => void;
  toggleDirectory: (path: string) => void;

  scanDirectories: () => Promise<void>;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;

  setScanProgress: (progress: ScanProgress | null) => void;

  selectPhoto: (id: string, multi?: boolean) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleSelection: (id: string) => void;

  movePhotos: (ids: string[], destFolder: string) => Promise<void>;
  deletePhotos: (ids: string[]) => Promise<void>;
  renamePhoto: (id: string, newName: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  revealInFinder: (path: string) => Promise<void>;

  undo: () => Promise<void>;
}

// Set up progress listener
let unlistenProgress: UnlistenFn | null = null;

async function setupProgressListener(
  setScanProgress: (progress: ScanProgress | null) => void
) {
  if (unlistenProgress) {
    unlistenProgress();
  }
  unlistenProgress = await listen<ScanProgress>('scan-progress', (event) => {
    setScanProgress(event.payload);
  });
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  // Initial state
  viewMode: 'grid',
  sortField: 'date',
  sortOrder: 'desc',
  filterMode: 'duplicates', // Default to showing only duplicates
  directories: [],
  photos: [],
  loading: false,
  scanProgress: null,
  selectedIds: new Set(),
  undoStack: [],

  // View actions
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortField: (field) => set({ sortField: field }),
  setSortOrder: (order) => set({ sortOrder: order }),
  toggleSortOrder: () =>
    set((state) => ({
      sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc',
    })),
  setFilterMode: (mode) => set({ filterMode: mode }),

  setScanProgress: (progress) => set({ scanProgress: progress }),

  // Directory actions
  addDirectory: async (path) => {
    const directories = get().directories;
    if (directories.some((d) => d.path === path)) return;

    const name = path.split('/').pop() || path;
    set({
      directories: [...directories, { path, enabled: true, name }],
    });
    await get().saveConfig();
    // Don't auto-scan - let user add multiple directories first
  },

  removeDirectory: (path) => {
    set((state) => ({
      directories: state.directories.filter((d) => d.path !== path),
    }));
    get().saveConfig();
  },

  toggleDirectory: (path) => {
    set((state) => ({
      directories: state.directories.map((d) =>
        d.path === path ? { ...d, enabled: !d.enabled } : d
      ),
    }));
    get().saveConfig();
  },

  // Scanning
  scanDirectories: async () => {
    const { directories } = get();
    const enabledDirs = directories.filter((d) => d.enabled).map((d) => d.path);

    if (enabledDirs.length === 0) {
      set({ photos: [] });
      return;
    }

    // Set up progress listener before starting scan
    await setupProgressListener(get().setScanProgress);

    set({
      loading: true,
      scanProgress: { phase: 'starting', current: 0, total: 0, message: 'Starting scan...' },
    });

    try {
      const photos = await invoke<PhotoFile[]>('scan_directories', {
        directories: enabledDirs,
      });
      
      // Count duplicates with a single pass (no intermediate array)
      let duplicateCount = 0;
      for (let i = 0; i < photos.length; i++) {
        if (photos[i].isDuplicate) duplicateCount++;
      }
      
      // Show preparing phase while processing data for UI
      set({
        scanProgress: {
          phase: 'preparing',
          current: 0,
          total: photos.length,
          message: `Received ${photos.length} photos, ${duplicateCount} duplicates...`,
        },
      });
      
      // Use requestAnimationFrame to allow the status update to render
      await new Promise((resolve) => requestAnimationFrame(resolve));
      
      // Update status
      set({
        scanProgress: {
          phase: 'rendering',
          current: photos.length,
          total: photos.length,
          message: `Rendering ${duplicateCount} duplicates...`,
        },
      });
      
      await new Promise((resolve) => requestAnimationFrame(resolve));
      
      set({ photos, loading: false, scanProgress: null });
    } catch (error) {
      console.error('Failed to scan directories:', error);
      set({ loading: false, scanProgress: null });
    }
  },

  // Config persistence
  loadConfig: async () => {
    try {
      const config = await invoke<{
        directories: DirectoryConfig[];
        viewMode: ViewMode;
        sortField: SortField;
        sortOrder: SortOrder;
        filterMode?: FilterMode;
      }>('load_config');

      set({
        directories: config.directories || [],
        viewMode: config.viewMode || 'grid',
        sortField: config.sortField || 'date',
        sortOrder: config.sortOrder || 'desc',
        filterMode: config.filterMode || 'duplicates',
      });

      // Don't auto-scan on load - let user click Scan button
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  },

  saveConfig: async () => {
    const { directories, viewMode, sortField, sortOrder, filterMode } = get();
    try {
      await invoke('save_config', {
        config: { directories, viewMode, sortField, sortOrder, filterMode },
      });
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  },

  // Selection
  selectPhoto: (id, multi = false) => {
    set((state) => {
      const newSelected = new Set(multi ? state.selectedIds : []);
      newSelected.add(id);
      return { selectedIds: newSelected };
    });
  },

  selectAll: () => {
    set((state) => ({
      selectedIds: new Set(state.photos.map((p) => p.id)),
    }));
  },

  deselectAll: () => set({ selectedIds: new Set() }),

  toggleSelection: (id) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedIds: newSelected };
    });
  },

  // File operations
  movePhotos: async (ids, destFolder) => {
    const { photos } = get();
    const toMove = photos.filter((p) => ids.includes(p.id));

    try {
      const operations = await invoke<Array<{ from: string; to: string }>>(
        'move_files',
        {
          files: toMove.map((p) => p.path),
          destination: destFolder,
        }
      );

      // Add to undo stack
      set((state) => ({
        undoStack: [
          ...state.undoStack,
          { type: 'move', timestamp: Date.now(), operations },
        ],
      }));

      await get().scanDirectories();
    } catch (error) {
      console.error('Failed to move files:', error);
    }
  },

  deletePhotos: async (ids) => {
    const { photos } = get();
    const toDelete = photos.filter((p) => ids.includes(p.id));

    try {
      await invoke('trash_files', {
        files: toDelete.map((p) => p.path),
      });
      set({ selectedIds: new Set() });
      await get().scanDirectories();
    } catch (error) {
      console.error('Failed to delete files:', error);
    }
  },

  renamePhoto: async (id, newName) => {
    const photo = get().photos.find((p) => p.id === id);
    if (!photo) return;

    try {
      await invoke('rename_file', {
        path: photo.path,
        newName,
      });
      await get().scanDirectories();
    } catch (error) {
      console.error('Failed to rename file:', error);
    }
  },

  createFolder: async (path) => {
    try {
      await invoke('create_folder', { path });
      await get().scanDirectories();
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  },

  revealInFinder: async (path) => {
    try {
      await invoke('reveal_in_finder', { path });
    } catch (error) {
      console.error('Failed to reveal in Finder:', error);
    }
  },

  // Undo
  undo: async () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;

    const lastOp = undoStack[undoStack.length - 1];

    try {
      if (lastOp.type === 'move') {
        // Reverse the move operations
        await invoke('move_files_batch', {
          operations: lastOp.operations.map((op) => ({
            from: op.to,
            to: op.from,
          })),
        });
      }

      set((state) => ({
        undoStack: state.undoStack.slice(0, -1),
      }));

      await get().scanDirectories();
    } catch (error) {
      console.error('Failed to undo:', error);
    }
  },
}));
