use rusqlite::{Connection, params};
use std::path::PathBuf;

/// Cache for file hashes stored in SQLite
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
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS file_hashes (
                path TEXT PRIMARY KEY,
                size INTEGER NOT NULL,
                modified_at INTEGER NOT NULL,
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

    /// Get cached hashes for a file if they exist and are still valid
    /// Returns (trailing_hash, full_hash) if cache hit, None if miss or stale
    pub fn get(&self, path: &str, size: u64, modified_at: i64) -> Option<(Option<String>, Option<String>)> {
        let result = self.conn.query_row(
            "SELECT trailing_hash, full_hash FROM file_hashes 
             WHERE path = ?1 AND size = ?2 AND modified_at = ?3",
            params![path, size as i64, modified_at],
            |row| {
                let trailing: Option<String> = row.get(0)?;
                let full: Option<String> = row.get(1)?;
                Ok((trailing, full))
            }
        );
        result.ok()
    }

    /// Update just the trailing hash
    pub fn set_trailing_hash(&self, path: &str, size: u64, modified_at: i64, trailing_hash: &str) {
        // Try update first
        let updated = self.conn.execute(
            "UPDATE file_hashes SET trailing_hash = ?1 WHERE path = ?2",
            params![trailing_hash, path],
        ).unwrap_or(0);

        // If no row existed, insert
        if updated == 0 {
            let _ = self.conn.execute(
                "INSERT INTO file_hashes (path, size, modified_at, trailing_hash) VALUES (?1, ?2, ?3, ?4)",
                params![path, size as i64, modified_at, trailing_hash],
            );
        }
    }

    /// Update just the full hash
    pub fn set_full_hash(&self, path: &str, size: u64, modified_at: i64, full_hash: &str) {
        // Try update first
        let updated = self.conn.execute(
            "UPDATE file_hashes SET full_hash = ?1 WHERE path = ?2",
            params![full_hash, path],
        ).unwrap_or(0);

        // If no row existed, insert
        if updated == 0 {
            let _ = self.conn.execute(
                "INSERT INTO file_hashes (path, size, modified_at, full_hash) VALUES (?1, ?2, ?3, ?4)",
                params![path, size as i64, modified_at, full_hash],
            );
        }
    }
}

