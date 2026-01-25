#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{Manager, PhysicalPosition, Position, WindowEvent};

#[derive(Serialize)]
struct EvalResponse {
    result: String,
}

#[derive(Deserialize, Serialize)]
struct WindowPosition {
    x: i32,
    y: i32,
}

#[tauri::command]
fn evaluate_expression(expression: String) -> Result<EvalResponse, String> {
    let normalized = expression.replace(',', ".");
    let value = orcal_core::evaluate(&normalized).map_err(|error| error.to_string())?;
    Ok(EvalResponse {
        result: orcal_core::format_result(value),
    })
}

fn window_position_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut dir = tauri::api::path::app_config_dir(&app.config())?;
    dir.push("orcal");
    let _ = fs::create_dir_all(&dir);
    dir.push("window-position.json");
    Some(dir)
}

fn load_window_position(app: &tauri::AppHandle) -> Option<PhysicalPosition<i32>> {
    let path = window_position_path(app)?;
    let contents = fs::read_to_string(path).ok()?;
    let saved: WindowPosition = serde_json::from_str(&contents).ok()?;
    Some(PhysicalPosition::new(saved.x, saved.y))
}

fn save_window_position(app: &tauri::AppHandle, window: &tauri::Window) {
    let Some(path) = window_position_path(app) else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };
    let saved = WindowPosition {
        x: position.x,
        y: position.y,
    };
    let Ok(payload) = serde_json::to_string(&saved) else {
        return;
    };
    let _ = fs::write(path, payload);
}

fn position_within_monitor(position: PhysicalPosition<i32>, monitor: &tauri::Monitor) -> bool {
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let max_x = monitor_position.x + monitor_size.width as i32;
    let max_y = monitor_position.y + monitor_size.height as i32;

    position.x >= monitor_position.x
        && position.x < max_x
        && position.y >= monitor_position.y
        && position.y < max_y
}

fn position_within_available_monitors(
    window: &tauri::Window,
    position: PhysicalPosition<i32>,
) -> bool {
    if let Ok(Some(monitor)) = window.current_monitor() {
        if position_within_monitor(position, &monitor) {
            return true;
        }
    }

    if let Ok(monitors) = window.available_monitors() {
        return monitors
            .iter()
            .any(|monitor| position_within_monitor(position, monitor));
    }

    false
}

fn reset_invalid_window_position(app: &tauri::AppHandle, window: &tauri::Window) {
    log::debug!("Saved window position is invalid; resetting to centered.");
    if let Some(path) = window_position_path(app) {
        let _ = fs::remove_file(path);
    }
    let _ = window.center();
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            let window = app.get_window("main").expect("main window");
            if let Some(position) = load_window_position(&app_handle) {
                if position_within_available_monitors(&window, position) {
                    let _ = window.set_position(Position::Physical(position));
                } else {
                    reset_invalid_window_position(&app_handle, &window);
                }
            }
            let app_handle_for_event = app_handle.clone();
            let window_for_event = window.clone();
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::CloseRequested { .. } | WindowEvent::Moved(_) => {
                        save_window_position(&app_handle_for_event, &window_for_event);
                    }
                    _ => {}
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![evaluate_expression])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
