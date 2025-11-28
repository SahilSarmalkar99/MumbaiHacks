const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Format AI response for better chat display
const formatChatResponse = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
    .replace(/\*(.*?)\*/g, '$1')   // Remove italic markdown
    .replace(/#{1,6}\s/g, '')      // Remove markdown headers
    .replace(/\n\s*\n/g, '\n\n')  // Clean up extra line breaks
    .trim();
};

export const sendMessageToGrok = async (messages: Array<{role: 'user' | 'assistant', content: string}>): Promise<string> => {
  // Try Gemini first (works in browser), then fallback to others
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    return await sendToGemini(messages);
  } else if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
    return await sendToOpenAI(messages);
  } else if (GROK_API_KEY && GROK_API_KEY !== 'your_grok_api_key_here') {
    return await sendToGrok(messages);
  } else {
    throw new Error('Please add your API key to .env file');
  }
};

const sendToOpenAI = async (messages: Array<{role: 'user' | 'assistant', content: string}>): Promise<string> => {
  try {
    console.log('Sending to OpenAI:', { messages, apiKey: OPENAI_API_KEY?.substring(0, 10) + '...' });
    
    const response = await fetch('https://cors-anywhere.herokuapp.com/https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    console.log('OpenAI Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI Response:', data);
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI request failed:', error);
    throw error;
  }
};

const sendToGemini = async (messages: Array<{role: 'user' | 'assistant', content: string}>): Promise<string> => {
  const lastMessage = messages[messages.length - 1];
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: lastMessage.content }]
      }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.candidates[0].content.parts[0].text;
  return formatChatResponse(rawText);
};

const sendToGrok = async (messages: Array<{role: 'user' | 'assistant', content: string}>): Promise<string> => {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'grok-beta',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`Grok API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

export const initVoiceRecognition = (
  onResult: (transcript: string) => void,
  onStart: () => void
) => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn('Speech recognition not supported');
    return null;
  }

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = onStart;
  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
  };

  return recognition;
};

export const speakWithOpenAI = async (text: string): Promise<void> => {
  // Use OpenAI TTS if API key available, otherwise fallback to browser TTS
  if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: 'alloy'
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        await audio.play();
        return;
      }
    } catch (error) {
      console.error('OpenAI TTS error:', error);
    }
  }

  // Fallback to browser speech synthesis
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.8;
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
  }
};