# Photo Manager

A local-only desktop application for managing photos across multiple directories (including Dropbox). Built with Tauri + React + TypeScript.

## Features

- **Multi-directory scanning**: Add any local folder paths (Dropbox, external drives, etc.)
- **Dual view modes**: Dense sortable list or thumbnail grid
- **Bulk operations**: Multi-select files for move, rename, delete operations
- **Undo support**: Undo move operations; deletes go to system Trash
- **Smart duplicate detection**: Multi-pass hashing with caching for fast, accurate deduplication
- **Metadata collapsing**: Groups related files (e.g., `.ARW` + `.jpg`, photo + `.xml` sidecar)
- **Smart naming**: Suggests filenames based on dominant date-based naming patterns
- **Folder management**: Create folders and organize photos with clear location indicators

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Runtime | [Tauri](https://tauri.app/) (Rust) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand |
| File Operations | Tauri FS API + custom Rust commands |
| Hash Caching | SQLite (`rusqlite`) |
| Hashing | `sha2` crate (Rust) for SHA-256 |

## Prerequisites

- **macOS** 10.15 (Catalina) or later
- **Node.js** 18+ and npm/pnpm
- **Rust** (latest stable) - [Install via rustup](https://rustup.rs/)
- **Xcode Command Line Tools**: `xcode-select --install`

## Getting Started

### 1. Clone and install dependencies

```bash
cd photo-manager
npm install
```

### 2. Development mode

```bash
npm run tauri dev
```

This starts both the Vite dev server (hot reload) and the Tauri desktop window.

### 3. Build for production

```bash
npm run tauri build
```

Outputs a `.app` bundle and `.dmg` installer in `src-tauri/target/release/bundle/macos/`.

## Project Structure

```
photo-manager/
├── src/                      # React frontend
│   ├── components/           # UI components
│   │   ├── PhotoGrid.tsx     # Thumbnail grid view
│   │   ├── PhotoList.tsx     # Dense list view
│   │   ├── Sidebar.tsx       # Directory management
│   │   ├── Toolbar.tsx       # Actions & view toggle
│   │   └── StatusBar.tsx     # Scan progress & stats
│   ├── hooks/                # React hooks
│   │   └── useSortedPhotos.ts
│   ├── store/                # Zustand stores
│   │   └── photoStore.ts     # Global state
│   ├── utils/                # Frontend utilities
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── main.rs           # Tauri entry point
│   │   ├── commands.rs       # Tauri commands (IPC)
│   │   ├── scanner.rs        # File scanning & duplicate detection
│   │   ├── hash_cache.rs     # SQLite hash cache
│   │   └── config.rs         # App configuration
│   ├── Cargo.toml
│   └── tauri.conf.json       # Tauri configuration
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Architecture

### File Scanning & Indexing

1. User adds directory paths via the sidebar
2. Rust backend recursively scans for supported image formats:
   - RAW: `.arw`, `.cr2`, `.cr3`, `.nef`, `.dng`, `.raf`, `.orf`, `.rw2`, `.pef`
   - Standard: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`, `.heif`, `.tiff`, `.bmp`
   - Metadata: `.xmp`, `.xml` (sidecars)
3. RAW files take precedence over JPEGs with the same name
4. Related files are grouped (e.g., `IMG_001.ARW` + `IMG_001.jpg` + `IMG_001.xmp`)

### Metadata Collapsing Rules

| Primary | Collapsed (shown as badges) |
|---------|----------------------------|
| `.ARW`, `.CR2`, `.NEF` (RAW) | Corresponding `.jpg`/`.jpeg` (used as thumbnail) |
| Any image | `.xmp`, `.xml` sidecars with same base name |

### Duplicate Detection (Multi-Pass)

The app uses a progressive hashing strategy to minimize disk I/O while maintaining accuracy:

```
┌─────────────────────────────────────────────────────────────────┐
│ Pass 1: File Size Grouping (instant)                            │
│   - Group all photos by exact file size                         │
│   - Files with unique sizes → not duplicates                    │
│   - Files sharing a size → potential duplicates                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Pass 2: Trailing Hash (fast - last 1MB only)                    │
│   - For potential duplicates, hash only the last 1MB            │
│   - Different trailing hashes → not duplicates                  │
│   - Same trailing hash → likely duplicates                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Pass 3: Full Hash (slow - only when needed)                     │
│   - For likely duplicates, compute full SHA-256                 │
│   - Identical hashes → confirmed duplicates                     │
└─────────────────────────────────────────────────────────────────┘
```

**Why trailing hash?** Photos often differ at the start (headers, metadata) but identical content will have identical endings. Hashing just the last 1MB catches most false positives while being ~10-50x faster than full file hashing.

### Hash Cache (SQLite)

All computed hashes are cached in a SQLite database at:
```
~/Library/Application Support/photo-manager/hash_cache.db
```

Schema:
```sql
CREATE TABLE file_hashes (
    path TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    modified_at INTEGER NOT NULL,
    trailing_hash TEXT,    -- SHA-256 of last 1MB
    full_hash TEXT         -- SHA-256 of entire file
);
```

Cache invalidation: If a file's size or modification time changes, cached hashes are considered stale and recomputed.

### Undo System

- Move operations push to an undo stack with original/new paths
- Delete operations use macOS Trash (recoverable via Finder)
- Undo stack persists during session, cleared on app restart

### Naming Suggestions

The app analyzes existing filenames in a directory to detect patterns:
- `YYYY-MM-DD_NNNN` → Date-based with sequence
- `IMG_NNNN` → Camera default
- Custom patterns detected via regex

When renaming, suggests names matching the dominant pattern.

## Configuration

Settings and data are stored in `~/Library/Application Support/photo-manager/`:

| File | Purpose |
|------|---------|
| `config.json` | User preferences (directories, view settings) |
| `hash_cache.db` | SQLite database of computed file hashes |

### config.json

```json
{
  "directories": [
    { "path": "/Users/you/Dropbox/Photos", "enabled": true, "name": "Photos" },
    { "path": "/Volumes/External/Camera", "enabled": true, "name": "Camera" }
  ],
  "viewMode": "grid",
  "sortField": "date",
  "sortOrder": "desc"
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘A` | Select all |
| `⌘D` | Deselect all |
| `⌘Z` | Undo last operation |
| `⌘⌫` | Move selected to Trash |
| `Space` | Quick preview |
| `G` | Toggle grid/list view |
| `⌘⇧N` | New folder |

## Development Notes

### Adding a new Tauri command

1. Define the command in `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub async fn my_command(path: String) -> Result<String, String> {
    // Implementation
    Ok("result".to_string())
}
```

2. Register in `main.rs`:

```rust
.invoke_handler(tauri::generate_handler![my_command])
```

3. Call from React:

```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke<string>('my_command', { path: '/some/path' });
```

### Running tests

```bash
# Frontend tests
npm test

# Rust tests
cd src-tauri && cargo test
```

## License

MIT
