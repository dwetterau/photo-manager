use crate::hash_cache::HashCache;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use tauri::Window;
use walkdir::WalkDir;

/// Supported image extensions (primary files)
const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "tiff", "tif", "bmp",
];

/// RAW image extensions
const RAW_EXTENSIONS: &[&str] = &["arw", "cr2", "cr3", "nef", "dng", "raf", "orf", "rw2", "pef"];

/// Sidecar/metadata extensions
const SIDECAR_EXTENSIONS: &[&str] = &["xmp", "xml"];

/// Size of trailing hash in bytes (1 MB)
const TRAILING_HASH_SIZE: u64 = 1024 * 1024;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RelatedFile {
    pub path: String,
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String, // "sidecar", "jpeg-preview", "raw"
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PhotoFile {
    pub id: String,
    pub path: String,
    pub name: String,
    pub directory: String,
    pub extension: String,
    pub size: u64,
    pub modified_at: i64,
    pub hash: Option<String>,
    pub thumbnail_path: Option<String>,
    pub related_files: Vec<RelatedFile>,
    pub is_duplicate: bool,
    pub duplicate_of: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub phase: String,
    pub current: usize,
    pub total: usize,
    pub message: String,
}

/// Scan multiple directories for photos with progress reporting
pub fn scan_directories_with_progress(directories: &[String], window: Window) -> Vec<PhotoFile> {
    let emit_progress = |phase: &str, current: usize, total: usize, message: &str| {
        let _ = window.emit(
            "scan-progress",
            ScanProgress {
                phase: phase.to_string(),
                current,
                total,
                message: message.to_string(),
            },
        );
    };

    // Open hash cache
    let cache = HashCache::open().ok();

    // Phase 1: Discover files
    emit_progress("discovery", 0, 0, "Discovering files...");
    
    let mut all_files: Vec<PathBuf> = Vec::new();

    for (dir_idx, dir) in directories.iter().enumerate() {
        emit_progress(
            "discovery",
            dir_idx,
            directories.len(),
            &format!("Scanning: {}", dir),
        );

        let path = Path::new(dir);
        if !path.exists() {
            continue;
        }

        for entry in WalkDir::new(path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                all_files.push(entry.path().to_path_buf());
            }
        }
    }

    emit_progress(
        "discovery",
        directories.len(),
        directories.len(),
        &format!("Found {} files", all_files.len()),
    );

    // Phase 2: Group files
    emit_progress("grouping", 0, all_files.len(), "Grouping related files...");
    
    let mut file_groups: HashMap<String, Vec<PathBuf>> = HashMap::new();

    for file_path in &all_files {
        if let Some(stem) = file_path.file_stem().and_then(|s| s.to_str()) {
            if let Some(parent) = file_path.parent() {
                let key = format!("{}:{}", parent.display(), stem.to_lowercase());
                file_groups.entry(key).or_default().push(file_path.clone());
            }
        }
    }

    // Phase 3: Identify primary files (RAW files take precedence)
    emit_progress("analyzing", 0, all_files.len(), "Analyzing photos...");
    
    let mut photos: Vec<PhotoFile> = Vec::new();
    let mut processed: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();

    // Sort files so RAW files come first - they take precedence over JPEGs
    let mut sorted_files = all_files.clone();
    sorted_files.sort_by(|a, b| {
        let a_ext = a.extension().and_then(|e| e.to_str()).unwrap_or("");
        let b_ext = b.extension().and_then(|e| e.to_str()).unwrap_or("");
        let a_is_raw = RAW_EXTENSIONS.contains(&a_ext.to_lowercase().as_str());
        let b_is_raw = RAW_EXTENSIONS.contains(&b_ext.to_lowercase().as_str());
        // RAW files come first
        b_is_raw.cmp(&a_is_raw)
    });

    for (idx, file_path) in sorted_files.iter().enumerate() {
        if idx % 100 == 0 {
            emit_progress(
                "analyzing",
                idx,
                sorted_files.len(),
                &format!("Processing file {} of {}", idx, sorted_files.len()),
            );
        }

        if processed.contains(file_path) {
            continue;
        }

        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        // Skip sidecar files as primary
        if SIDECAR_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }

        let is_raw = RAW_EXTENSIONS.contains(&ext.as_str());
        let is_image = IMAGE_EXTENSIONS.contains(&ext.as_str());

        // Check if this is a primary file
        if !is_raw && !is_image {
            continue;
        }

        // Find related files in the same group
        let stem = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        let parent = file_path.parent().unwrap_or(Path::new(""));
        let key = format!("{}:{}", parent.display(), stem.to_lowercase());

        // If this is a JPEG/image and there's a RAW file with the same name, skip it
        // The RAW will be processed first and claim this JPEG as a related file
        if is_image && !is_raw {
            if let Some(group) = file_groups.get(&key) {
                let has_raw_sibling = group.iter().any(|p| {
                    let p_ext = p.extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.to_lowercase())
                        .unwrap_or_default();
                    RAW_EXTENSIONS.contains(&p_ext.as_str())
                });
                if has_raw_sibling {
                    // Skip this JPEG - it will be added as a related file to the RAW
                    continue;
                }
            }
        }

        processed.insert(file_path.clone());

        // Find related files
        let mut related_files: Vec<RelatedFile> = Vec::new();
        let mut jpeg_preview_path: Option<String> = None;

        if let Some(group) = file_groups.get(&key) {
            for related_path in group {
                if related_path == file_path {
                    continue;
                }

                let related_ext = related_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_default();

                let file_type = if SIDECAR_EXTENSIONS.contains(&related_ext.as_str()) {
                    "sidecar"
                } else if is_raw && IMAGE_EXTENSIONS.contains(&related_ext.as_str()) {
                    // RAW file with a JPEG companion = JPEG is a preview
                    // Use this as the thumbnail source
                    jpeg_preview_path = Some(related_path.to_string_lossy().to_string());
                    "jpeg-preview"
                } else {
                    continue;
                };

                processed.insert(related_path.clone());

                related_files.push(RelatedFile {
                    path: related_path.to_string_lossy().to_string(),
                    name: related_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string(),
                    file_type: file_type.to_string(),
                });
            }
        }

        // For RAW files, use JPEG preview as thumbnail; for regular images, use the file itself
        let thumbnail_path = if is_raw {
            jpeg_preview_path
        } else {
            Some(file_path.to_string_lossy().to_string())
        };

        // Get file metadata
        if let Ok(metadata) = fs::metadata(file_path) {
            let modified_at = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);

            let directory = parent
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            photos.push(PhotoFile {
                id: file_path.to_string_lossy().to_string(),
                path: file_path.to_string_lossy().to_string(),
                name: file_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string(),
                directory,
                extension: ext,
                size: metadata.len(),
                modified_at,
                hash: None,
                thumbnail_path,
                related_files,
                is_duplicate: false,
                duplicate_of: None,
            });
        }
    }

    let photo_count = photos.len();
    emit_progress(
        "analyzing",
        photo_count,
        photo_count,
        &format!("Found {} photos", photo_count),
    );

    // Phase 4: Find potential duplicates by file size (fast)
    emit_progress("duplicates", 0, photo_count, "Finding potential duplicates by file size...");
    
    // Group photos by file size
    let mut size_groups: HashMap<u64, Vec<usize>> = HashMap::new();
    for (idx, photo) in photos.iter().enumerate() {
        size_groups.entry(photo.size).or_default().push(idx);
    }

    // Find size groups with more than one file (potential duplicates)
    let size_collision_groups: Vec<Vec<usize>> = size_groups
        .into_values()
        .filter(|group| group.len() > 1)
        .collect();

    let potential_count: usize = size_collision_groups.iter().map(|g| g.len()).sum();
    
    if potential_count == 0 {
        emit_progress(
            "complete",
            photo_count,
            photo_count,
            &format!("Done! {} photos, no duplicates found", photo_count),
        );
        return photos;
    }

    // Phase 5: Compute trailing hash for potential duplicates (fast - only last 1MB)
    emit_progress(
        "trailing_hash",
        0,
        potential_count,
        &format!("Computing trailing hashes for {} candidates...", potential_count),
    );

    let mut trailing_hashes: HashMap<usize, String> = HashMap::new();
    let mut progress_idx = 0;

    for group in &size_collision_groups {
        for &photo_idx in group {
            if progress_idx % 20 == 0 {
                emit_progress(
                    "trailing_hash",
                    progress_idx,
                    potential_count,
                    &format!("Trailing hash {} of {}", progress_idx + 1, potential_count),
                );
            }

            let photo = &photos[photo_idx];
            
            // Check cache first for trailing hash
            let cached_trailing: Option<String> = cache.as_ref()
                .and_then(|c| c.get(&photo.path, photo.size, photo.modified_at))
                .and_then(|(t, _)| t);

            let trailing_hash: String = cached_trailing.unwrap_or_else(|| {
                let hash = compute_trailing_hash(&photo.path, photo.size);
                // Cache it
                if let (Some(c), Some(h)) = (cache.as_ref(), hash.as_ref()) {
                    c.set_trailing_hash(&photo.path, photo.size, photo.modified_at, h);
                }
                hash.unwrap_or_default()
            });

            if !trailing_hash.is_empty() {
                trailing_hashes.insert(photo_idx, trailing_hash);
            }
            progress_idx += 1;
        }
    }

    // Phase 6: Group by trailing hash to find likely duplicates
    emit_progress("duplicates", 0, photo_count, "Grouping by trailing hash...");

    let mut trailing_hash_groups: HashMap<(&u64, &String), Vec<usize>> = HashMap::new();
    for group in &size_collision_groups {
        for &photo_idx in group {
            if let Some(trailing_hash) = trailing_hashes.get(&photo_idx) {
                let size = &photos[photo_idx].size;
                trailing_hash_groups
                    .entry((size, trailing_hash))
                    .or_default()
                    .push(photo_idx);
            }
        }
    }

    // Files that need full hash: those in trailing hash groups with 2+ files
    let needs_full_hash: Vec<usize> = trailing_hash_groups
        .values()
        .filter(|group| group.len() > 1)
        .flatten()
        .copied()
        .collect();

    if needs_full_hash.is_empty() {
        emit_progress(
            "complete",
            photo_count,
            photo_count,
            &format!("Done! {} photos, no duplicates found (trailing hashes differ)", photo_count),
        );
        return photos;
    }

    // Phase 7: Compute full hash only for files with matching trailing hashes
    emit_progress(
        "hashing",
        0,
        needs_full_hash.len(),
        &format!("Full hashing {} likely duplicates...", needs_full_hash.len()),
    );

    for (progress_idx, &photo_idx) in needs_full_hash.iter().enumerate() {
        if progress_idx % 5 == 0 {
            emit_progress(
                "hashing",
                progress_idx,
                needs_full_hash.len(),
                &format!("Full hash {} of {}", progress_idx + 1, needs_full_hash.len()),
            );
        }

        let photo = &photos[photo_idx];

        // Check cache first for full hash
        let cached_full: Option<String> = cache.as_ref()
            .and_then(|c| c.get(&photo.path, photo.size, photo.modified_at))
            .and_then(|(_, f)| f);

        let full_hash: Option<String> = cached_full.or_else(|| {
            let hash = compute_full_hash(&photo.path);
            // Cache it
            if let (Some(c), Some(h)) = (cache.as_ref(), hash.as_ref()) {
                c.set_full_hash(&photo.path, photo.size, photo.modified_at, h);
            }
            hash
        });

        photos[photo_idx].hash = full_hash;
    }

    // Phase 8: Use full hashes to identify confirmed duplicates
    emit_progress("duplicates", 0, photo_count, "Confirming duplicates by full content hash...");
    
    let mut hash_map: HashMap<String, usize> = HashMap::new();
    let mut duplicate_count = 0;

    for &photo_idx in &needs_full_hash {
        if let Some(ref hash) = photos[photo_idx].hash {
            if let Some(&original_idx) = hash_map.get(hash) {
                photos[photo_idx].is_duplicate = true;
                photos[photo_idx].duplicate_of = Some(photos[original_idx].id.clone());
                duplicate_count += 1;
            } else {
                hash_map.insert(hash.clone(), photo_idx);
            }
        }
    }

    emit_progress(
        "complete",
        photo_count,
        photo_count,
        &format!("Done! {} photos, {} confirmed duplicates", photo_count, duplicate_count),
    );

    photos
}

/// Compute SHA-256 hash of the last 1MB of a file (or whole file if smaller)
fn compute_trailing_hash(path: &str, file_size: u64) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536]; // 64KB buffer

    // Seek to position for trailing hash
    let start_pos = if file_size > TRAILING_HASH_SIZE {
        file_size - TRAILING_HASH_SIZE
    } else {
        0
    };
    
    file.seek(SeekFrom::Start(start_pos)).ok()?;
    let mut reader = BufReader::new(file);

    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buffer[..n]),
            Err(_) => return None,
        }
    }

    Some(format!("{:x}", hasher.finalize()))
}

/// Compute SHA-256 hash of entire file
fn compute_full_hash(path: &str) -> Option<String> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536]; // 64KB buffer

    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buffer[..n]),
            Err(_) => return None,
        }
    }

    Some(format!("{:x}", hasher.finalize()))
}
