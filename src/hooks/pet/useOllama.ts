import { useState, useCallback } from "react";

interface OllamaResponse {
  response: string;
}

export function useOllama() {
  const [isThinking, setIsThinking] = useState(false);

  const generateResponse = useCallback(async (prompt: string, context?: number[]): Promise<{ text: string, sentiment: string, context: number[] } | null> => {
    setIsThinking(true);
    try {
      // System prompt to instruct the LLM on its persona and output format
      const systemPrompt = `You are a tiny, mischievous, but friendly magical creature living on a user's desktop screen. 
Keep your responses VERY short (1-2 sentences max). 
You must begin your response with a sentiment tag in brackets, choosing from: [happy], [sad], [angry], [surprised], [neutral], [magic].
Example: "[happy] I love it when you click on me!"`;

      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2:3b",
          prompt: `${systemPrompt}\n\nUser: ${prompt}\nPet:`,
          stream: false,
          context: context
        })
      });

      if (!response.ok) {
        let errorMsg = "Ollama API failed";
        try {
          const errData = await response.json();
          if (errData.error) errorMsg = errData.error;
        } catch(e) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      let text = data.response.trim();
      let sentiment = "neutral";
      
      // Parse sentiment tag
      const match = text.match(/^\[(.*?)\]/);
      if (match) {
        sentiment = match[1].toLowerCase();
        text = text.replace(/^\[.*?\]\s*/, "");
      }

      setIsThinking(false);
      return { text, sentiment, context: data.context };
    } catch (e: any) {
      console.error("Failed to connect to Ollama", e);
      setIsThinking(false);
      return { text: `[System Error] ${e.message}. If you just started the app, the model is likely still downloading in the background.`, sentiment: "neutral", context: [] };
    }
  }, []);

  return { generateResponse, isThinking };
}
