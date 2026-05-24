import { useCallback, useRef } from "react";
import { cacheAudio, getCachedAudio } from "./audioCache";

export function useKokoroTTS(muted: boolean) {
  const isInitializing = useRef(false);

  const initTTS = useCallback(async () => {
    if (typeof window !== "undefined" && !(window as any).kokoroTTS && !isInitializing.current) {
      try {
        isInitializing.current = true;
        console.log("Loading Kokoro TTS model...");
        const kokoro = await import("kokoro-js");
        (window as any).kokoroTTS = await kokoro.KokoroTTS.from_pretrained(
          "onnx-community/Kokoro-82M-v1.0-ONNX",
          {
            dtype: "q8",
            device: "wasm",
          }
        );
      } catch (err) {
        console.error("Failed to init Kokoro TTS:", err);
      } finally {
        isInitializing.current = false;
      }
    }
  }, []);

  const playVoiceLine = useCallback(
    async (text: string) => {
      if (muted) return;

      try {
        if (!(window as any).kokoroTTS && !isInitializing.current) {
           await initTTS();
        }

        if ((window as any).kokoroTTS) {
          // Check cache first
          let float32Data = await getCachedAudio(text);
          let sampleRate = 24000; // Kokoro default

          if (!float32Data) {
            console.log("Generating fresh audio for:", text);
            const audioData = await (window as any).kokoroTTS.generate(text, { voice: "af_heart" });
            float32Data = audioData.audio;
            sampleRate = audioData.sampling_rate;
            
            // Save to cache asynchronously
            cacheAudio(text, float32Data).catch(e => console.error("Cache error", e));
          } else {
            console.log("Playing cached audio for:", text);
          }

          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = audioContext.createBuffer(1, float32Data.length, sampleRate);
          audioBuffer.getChannelData(0).set(float32Data);

          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.start();
        } else {
            throw new Error("Kokoro TTS not initialized");
        }
      } catch (err) {
        console.error("Kokoro TTS fallback:", err);
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.pitch = 2.0;
          utterance.rate = 1.3;
          utterance.volume = 0.5;
          window.speechSynthesis.speak(utterance);
        }
      }
    },
    [muted, initTTS]
  );

  return { playVoiceLine, initTTS };
}
