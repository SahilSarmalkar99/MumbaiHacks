// TypeScript declaration for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const API_KEY = '';

export const startVoiceRecognition = (onResult: (text: string) => void, onStart: () => void) => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.log("Speech recognition not supported");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    onStart();
  };

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
  };

  return recognition;
};

export const callGeminiVoice = async (text: string): Promise<string> => {
  const body = {
    system_instruction: {
      parts: [{
        text: "You are an AI assistant for a business management system. Give short, helpful responses that can be spoken aloud. Keep answers under 30 words."
      }]
    },
    contents: [{
      parts: [{ text }]
    }]
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't understand that.";
};

export const speakText = (text: string) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  speechSynthesis.speak(utterance);
};