#![windows_subsystem = "windows"]
use clap::{Parser, Subcommand};
use reqwest::blocking::Client;
use std::time::Duration;

#[derive(Parser)]
#[command(name = "itlives-cli")]
#[command(about = "Command line interface for the itlives live wallpaper engine", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Get the current status of the engine
    Status,
    /// Play the current wallpaper
    Play,
    /// Pause the current wallpaper
    Pause,
    /// Toggle play/pause
    Toggle,
    /// Skip to the next wallpaper in the queue
    Next,
    /// Go back to the previous wallpaper
    Prev,
    /// Stop the wallpaper engine entirely
    Stop,
    /// Start or resume the last played wallpaper
    Start,
    /// Set a specific local video file as wallpaper
    Set {
        /// Absolute path to the local video file
        path: String,
    },
    /// Set the slideshow source
    SetSource {
        /// Source to use (local, online, discover)
        val: String,
    },
    /// Set the discover provider
    SetProvider {
        /// Provider to use (unified, wallhaven, alphacoders, etc.)
        val: String,
    },
}

fn main() {
    let cli = Cli::parse();
    let client = Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .expect("Failed to build HTTP client");

    let base_url = "http://127.0.0.1:3030";

    let result = match cli.command {
        Commands::Status => send_request(&client, &format!("{}/status", base_url)),
        Commands::Play => send_request(&client, &format!("{}/play", base_url)),
        Commands::Pause => send_request(&client, &format!("{}/pause", base_url)),
        Commands::Toggle => send_request(&client, &format!("{}/toggle", base_url)),
        Commands::Next => send_request(&client, &format!("{}/next", base_url)),
        Commands::Prev => send_request(&client, &format!("{}/prev", base_url)),
        Commands::Stop => send_request(&client, &format!("{}/stop", base_url)),
        Commands::Start => send_request(&client, &format!("{}/start", base_url)),
        Commands::Set { path } => {
            let encoded = urlencoding::encode(&path);
            send_request(&client, &format!("{}/set?path={}", base_url, encoded))
        }
        Commands::SetSource { val } => {
            let encoded = urlencoding::encode(&val);
            send_request(&client, &format!("{}/set_source?val={}", base_url, encoded))
        }
        Commands::SetProvider { val } => {
            let encoded = urlencoding::encode(&val);
            send_request(&client, &format!("{}/set_provider?val={}", base_url, encoded))
        }
    };

    match result {
        Ok(body) => {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
                println!("{}", serde_json::to_string_pretty(&parsed).unwrap());
            } else {
                println!("{}", body);
            }
        }
        Err(e) => {
            eprintln!("Error connecting to itlives background engine: {}", e);
            eprintln!("Make sure the itlives app is currently running in the system tray.");
            std::process::exit(1);
        }
    }
}

fn send_request(client: &Client, url: &str) -> Result<String, reqwest::Error> {
    let response = client.get(url).send()?;
    response.text()
}
