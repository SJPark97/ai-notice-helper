use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

mod ai;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard::init()) // 클립보드 감시 플러그인
        // 닫기(X) 버튼을 가로채 종료 대신 창 숨김 → 트레이 최소화
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
                // 트레이로 최소화 시 모델 언로드(RAM 반납)
                tauri::async_runtime::spawn(async { let _ = ai::unload_model().await; });
            }
        })
        .setup(|app| {
            // 앱 시작 시 모델 미리 로드(첫 생성 체감 속도 향상)
            tauri::async_runtime::spawn(async { let _ = ai::preload_model().await; });

            // 트레이 우클릭 메뉴: 열기 / 종료
            let open_i = MenuItem::with_id(app, "open", "열기", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false) // 좌클릭은 창 열기, 우클릭에서만 메뉴
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                        // 창을 열 때 모델 미리 로드
                        tauri::async_runtime::spawn(async { let _ = ai::preload_model().await; });
                    }
                    "quit" => {
                        app.exit(0); // 진짜 종료 (사이드카는 후속 Plan에서 여기 정리)
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                        // 트레이에서 다시 열 때 모델 미리 로드
                        tauri::async_runtime::spawn(async { let _ = ai::preload_model().await; });
                    }
                })
                .build(app)?;

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            ai::generate_notice,
            ai::refine_notice,
            ai::generate_notice_stream,
            ai::refine_notice_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
