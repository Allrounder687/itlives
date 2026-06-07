use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use rustfft::{num_complex::Complex, FftPlanner};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter};

lazy_static::lazy_static! {
    static ref AUDIO_RUNNING: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

#[tauri::command]
pub fn start_audio_capture(app_handle: AppHandle) -> Result<(), String> {
    if AUDIO_RUNNING.load(Ordering::SeqCst) {
        return Ok(());
    }
    AUDIO_RUNNING.store(true, Ordering::SeqCst);

    std::thread::spawn(move || {
        let host = cpal::default_host();
        let device = match host.default_output_device() {
            Some(d) => d,
            None => {
                log::error!("Failed to find default output device for audio loopback");
                AUDIO_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };

        let config: cpal::StreamConfig = match device.default_output_config() {
            Ok(c) => c.into(),
            Err(e) => {
                log::error!("Failed to get default output config: {}", e);
                AUDIO_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };

        let channels = config.channels as usize;
        let mut planner = FftPlanner::new();
        let fft_size = 1024;
        let fft = planner.plan_fft_forward(fft_size);

        let mut sample_buffer: Vec<f32> = Vec::with_capacity(fft_size * channels);
        let running_flag = AUDIO_RUNNING.clone();

        // Target ~30fps for emit rate. 1024 samples at 48000Hz is ~46 fps.
        let stream_result = device.build_input_stream(
            &config,
            move |data: &[f32], _: &_| {
                if !running_flag.load(Ordering::SeqCst) {
                    return;
                }

                // Accumulate samples
                for &sample in data {
                    sample_buffer.push(sample);
                }

                if sample_buffer.len() >= fft_size * channels {
                    let mut mono_samples: Vec<Complex<f32>> = sample_buffer
                        .chunks(channels)
                        .take(fft_size)
                        .map(|chunk| {
                            let sum: f32 = chunk.iter().sum();
                            let avg = sum / channels as f32;
                            Complex { re: avg, im: 0.0 }
                        })
                        .collect();

                    // Apply Hanning Window to reduce spectral leakage
                    for i in 0..fft_size {
                        let multiplier = 0.5
                            * (1.0
                                - (2.0 * std::f32::consts::PI * i as f32 / (fft_size - 1) as f32)
                                    .cos());
                        mono_samples[i].re *= multiplier;
                    }

                    fft.process(&mut mono_samples);

                    // Compute magnitudes (only first half)
                    let num_bins = 64; // How many bars in visualizer
                    let max_freq_index = fft_size / 2; // Nyquist limit

                    // We want to focus more on lower/mid frequencies, so we use a non-linear scale or just take the lower bins
                    // Let's just evenly space the bins for now over the first 50% of the spectrum (up to ~12kHz)
                    let usable_bins = max_freq_index / 2;
                    let bin_size = (usable_bins / num_bins).max(1);

                    let mut bins = vec![0.0f32; num_bins];
                    for i in 0..num_bins {
                        let mut sum = 0.0;
                        for j in 0..bin_size {
                            let idx = i * bin_size + j;
                            if idx < mono_samples.len() {
                                let mag = mono_samples[idx].norm();
                                sum += mag;
                            }
                        }
                        // Normalize slightly
                        bins[i] = (sum / bin_size as f32) / (fft_size as f32);
                    }

                    // Emit to frontend
                    let _ = app_handle.emit("audio-fft", bins);

                    // Keep any leftover samples (sliding window could be better but this is fine for basic vis)
                    sample_buffer.drain(0..(fft_size * channels));
                }
            },
            |err| log::error!("An error occurred on the audio input stream: {}", err),
            None,
        );

        match stream_result {
            Ok(stream) => {
                if let Err(e) = stream.play() {
                    log::error!("Failed to play audio loopback stream: {}", e);
                    AUDIO_RUNNING.store(false, Ordering::SeqCst);
                    return;
                }
                while AUDIO_RUNNING.load(Ordering::SeqCst) {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            }
            Err(e) => {
                log::error!("Failed to build audio input stream: {}", e);
                AUDIO_RUNNING.store(false, Ordering::SeqCst);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_audio_capture() -> Result<(), String> {
    AUDIO_RUNNING.store(false, Ordering::SeqCst);
    Ok(())
}
