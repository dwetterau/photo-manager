use rusqlite::{Connection, params};
use std::path::PathBuf;

/// Cached file info - size and hashes
pub struct CachedFileInfo {
    pub size: u64,
    pub trailing_hash: Option<String>,
    pub full_hash: Option<String>,
}

/// Cache for file metadata and hashes stored in SQLite
/// Uses path as the only key since files are immutable
pub struct HashCache {
    conn: Connection,
}

impl HashCache {
    /// Open or create the hash cache database
    pub fn open() -> Result<Self, String> {
        let db_path = Self::db_path();
        
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        
        // Create tables if they don't exist
        // Note: We key by path only since files are immutable
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS file_hashes (
                path TEXT PRIMARY KEY,
                size INTEGER NOT NULL,
                trailing_hash TEXT,
                full_hash TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_size ON file_hashes(size);
            CREATE INDEX IF NOT EXISTS idx_trailing_hash ON file_hashes(trailing_hash);
            CREATE INDEX IF NOT EXISTS idx_full_hash ON file_hashes(full_hash);
            "
        ).map_err(|e| e.to_string())?;

        Ok(Self { conn })
    }

    fn db_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("photo-manager")
            .join("hash_cache.db")
    }

    /// Get cached info for a file by path only (files are immutable)
    pub fn get(&self, path: &str) -> Option<CachedFileInfo> {
        self.conn.query_row(
            "SELECT size, trailing_hash, full_hash FROM file_hashes WHERE path = ?1",
            params![path],
            |row| {
                Ok(CachedFileInfo {
                    size: row.get::<_, i64>(0)? as u64,
                    trailing_hash: row.get(1)?,
                    full_hash: row.get(2)?,
                })
            }
        ).ok()
    }

    /// Store size only (during analyze phase, no hashing yet)
    pub fn set_size(&self, path: &str, size: u64) {
        let _ = self.conn.execute(
            "INSERT OR IGNORE INTO file_hashes (path, size) VALUES (?1, ?2)",
            params![path, size as i64],
        );
    }

    /// Store trailing hash, also stores/updates size
    pub fn set_trailing_hash(&self, path: &str, size: u64, trailing_hash: &str) {
        // First try to get existing full_hash if any
        let existing_full: Option<String> = self.conn.query_row(
            "SELECT full_hash FROM file_hashes WHERE path = ?1",
            params![path],
            |row| row.get(0)
        ).ok().flatten();

        // Insert or replace with all current values
        let _ = self.conn.execute(
            "INSERT OR REPLACE INTO file_hashes (path, size, trailing_hash, full_hash) 
             VALUES (?1, ?2, ?3, ?4)",
            params![path, size as i64, trailing_hash, existing_full],
        );
    }

    /// Store full hash, also stores/updates size
    pub fn set_full_hash(&self, path: &str, size: u64, full_hash: &str) {
        // First try to get existing trailing_hash if any
        let existing_trailing: Option<String> = self.conn.query_row(
            "SELECT trailing_hash FROM file_hashes WHERE path = ?1",
            params![path],
            |row| row.get(0)
        ).ok().flatten();

        // Insert or replace with all current values
        let _ = self.conn.execute(
            "INSERT OR REPLACE INTO file_hashes (path, size, trailing_hash, full_hash) 
             VALUES (?1, ?2, ?3, ?4)",
            params![path, size as i64, existing_trailing, full_hash],
        );
    }
}
