use crate::config::AppConfig;
use crate::scanner::{scan_directories_with_progress, PhotoFile};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::Window;

#[derive(Debug, Serialize, Deserialize)]
pub struct MoveOperation {
    pub from: String,
    pub to: String,
}

/// Scan directories for photos with progress reporting
#[tauri::command]
pub async fn scan_directories(
    window: Window,
    directories: Vec<String>,
) -> Result<Vec<PhotoFile>, String> {
    // Use Tauri's async runtime to run blocking code without blocking event processing
    let result = tauri::async_runtime::spawn_blocking(move || {
        scan_directories_with_progress(&directories, window)
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Load app configuration
#[tauri::command]
pub async fn load_config() -> Result<AppConfig, String> {
    Ok(AppConfig::load())
}

/// Save app configuration
#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), String> {
    config.save()
}

/// Move files to a destination folder
#[tauri::command]
pub async fn move_files(
    files: Vec<String>,
    destination: String,
) -> Result<Vec<MoveOperation>, String> {
    let dest_path = Path::new(&destination);

    if !dest_path.exists() {
        fs::create_dir_all(dest_path).map_err(|e| e.to_string())?;
    }

    let mut operations = Vec::new();

    for file in files {
        let source = Path::new(&file);
        if !source.exists() {
            continue;
        }

        let file_name = source.file_name().ok_or("Invalid file name")?;
        let target = dest_path.join(file_name);

        // Handle name conflicts
        let final_target = if target.exists() {
            find_unique_name(&target)?
        } else {
            target
        };

        fs::rename(&source, &final_target).map_err(|e| e.to_string())?;

        operations.push(MoveOperation {
            from: file,
            to: final_target.to_string_lossy().to_string(),
        });
    }

    Ok(operations)
}

/// Move files in batch (for undo operations)
#[tauri::command]
pub async fn move_files_batch(operations: Vec<MoveOperation>) -> Result<(), String> {
    for op in operations {
        let source = Path::new(&op.from);
        let target = Path::new(&op.to);

        // Ensure parent directory exists
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        if source.exists() {
            fs::rename(source, target).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Delete progress event payload
#[derive(Debug, Clone, Serialize)]
pub struct DeleteProgress {
    pub current: usize,
    pub total: usize,
    pub deleted_bytes: u64,
    pub current_file: String,
    pub phase: String,
}

/// Delete completion result
#[derive(Debug, Clone, Serialize)]
pub struct DeleteResult {
    pub deleted_count: usize,
    pub failed_count: usize,
    pub total_bytes: u64,
}

/// Move files to system trash with progress reporting
#[tauri::command]
pub async fn trash_files(window: Window, files: Vec<String>) -> Result<DeleteResult, String> {
    let total = files.len();
    let mut deleted_count = 0;
    let mut failed_count = 0;
    let mut total_bytes: u64 = 0;

    for (i, file) in files.iter().enumerate() {
        let path = Path::new(&file);
        
        // Get file size before deletion
        let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Emit progress event
        let _ = window.emit("delete-progress", DeleteProgress {
            current: i + 1,
            total,
            deleted_bytes: total_bytes,
            current_file: file_name.clone(),
            phase: "deleting".to_string(),
        });

        // Attempt deletion
        match trash::delete(&file) {
            Ok(_) => {
                deleted_count += 1;
                total_bytes += file_size;
            }
            Err(e) => {
                eprintln!("Failed to delete {}: {}", file, e);
                failed_count += 1;
            }
        }
    }

    // Emit completion event
    let _ = window.emit("delete-progress", DeleteProgress {
        current: total,
        total,
        deleted_bytes: total_bytes,
        current_file: String::new(),
        phase: "complete".to_string(),
    });

    Ok(DeleteResult {
        deleted_count,
        failed_count,
        total_bytes,
    })
}

/// Rename a file
#[tauri::command]
pub async fn rename_file(path: String, new_name: String) -> Result<String, String> {
    let source = Path::new(&path);
    if !source.exists() {
        return Err("File not found".to_string());
    }

    let parent = source.parent().ok_or("Invalid path")?;
    let target = parent.join(&new_name);

    if target.exists() && target != source {
        return Err("A file with that name already exists".to_string());
    }

    fs::rename(source, &target).map_err(|e| e.to_string())?;

    Ok(target.to_string_lossy().to_string())
}

/// Create a new folder
#[tauri::command]
pub async fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// Reveal a file in Finder (macOS)
#[tauri::command]
pub async fn reveal_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg("-R")  // Reveal in Finder
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Find a unique name for a file by appending a number
fn find_unique_name(path: &Path) -> Result<std::path::PathBuf, String> {
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid file name")?;
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let parent = path.parent().ok_or("Invalid path")?;

    let mut counter = 1;
    loop {
        let new_name = if ext.is_empty() {
            format!("{} ({})", stem, counter)
        } else {
            format!("{} ({}).{}", stem, counter, ext)
        };

        let new_path = parent.join(&new_name);
        if !new_path.exists() {
            return Ok(new_path);
        }
        counter += 1;

        if counter > 1000 {
            return Err("Could not find unique name".to_string());
        }
    }
}
