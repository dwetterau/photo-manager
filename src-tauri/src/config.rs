use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirectoryConfig {
    pub path: String,
    pub enabled: bool,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub directories: Vec<DirectoryConfig>,
    #[serde(default = "default_view_mode")]
    pub view_mode: String,
    #[serde(default = "default_sort_field")]
    pub sort_field: String,
    #[serde(default = "default_sort_order")]
    pub sort_order: String,
    #[serde(default = "default_filter_mode")]
    pub filter_mode: String,
}

fn default_view_mode() -> String {
    "grid".to_string()
}

fn default_sort_field() -> String {
    "date".to_string()
}

fn default_sort_order() -> String {
    "desc".to_string()
}

fn default_filter_mode() -> String {
    "duplicates".to_string()
}

impl AppConfig {
    pub fn config_path() -> PathBuf {
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("photo-manager");

        fs::create_dir_all(&config_dir).ok();
        config_dir.join("config.json")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            fs::read_to_string(&path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            Self::default()
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path();
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())
    }
}

