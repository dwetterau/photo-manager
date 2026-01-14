mod commands;
mod config;
mod hash_cache;
mod scanner;

use commands::{
    create_folder, load_config, move_files, move_files_batch, rename_file, reveal_in_finder,
    save_config, scan_directories, trash_files,
};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_directories,
            load_config,
            save_config,
            move_files,
            move_files_batch,
            trash_files,
            rename_file,
            create_folder,
            reveal_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

