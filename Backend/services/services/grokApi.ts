// === API CONFIGURATION ===
// Uncomment the API you want to use and comment out the others

// GROK API (Alternative - needs credits)
// const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
// const API_KEY = '';
// const MODEL = 'grok-beta';

// GEMINI API (Current)
const GROK_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const API_KEY = '';

// OPENAI API (Alternative)
// const GROK_API_URL = 'https://api.openai.com/v1/chat/completions';
// const API_KEY = 'YOUR_OPENAI_API_KEY_HERE';
// const MODEL = 'gpt-3.5-turbo';

// OPENAI TTS API
const OPENAI_TTS_KEY = 'YOUR_OPENAI_API_KEY_HERE';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  choices?: {
    message: {
      content: string;
    };
  }[];
  candidates?: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

const isBusinessRelated = (text: string): boolean => {
  const keywords = [
    // Core Accounting & GST
    'gst', 'gst number', 'gst filing', 'gst return', 'gstr', 'gstr1', 'gstr3b',
    'igst', 'cgst', 'sgst', 'hsn', 'sac code', 'tax', 'input tax credit',
    'itc', 'eway bill', 'e-invoice', 'einvoice', 'gst portal', 'valuation',

    // Billing & Invoicing
    'invoice', 'tax invoice', 'bill', 'billing', 'estimate', 'quotation',
    'proforma invoice', 'credit note', 'debit note', 'receipt', 'pos invoice',
    'invoice template', 'round off', 'discount', 'additional charges',

    // Business Operations
    'business', 'bms', 'business management', 'accounting', 'finance',
    'sales', 'purchase', 'purchase order', 'po', 'grn', 'goods receipt',
    'customer', 'client', 'supplier', 'vendor',

    // Inventory & Stock
    'inventory', 'stock', 'stock in', 'stock out', 'opening stock',
    'closing stock', 'sku', 'barcode', 'batch number', 'expiry date',
    'warehouse', 'godown', 'low stock alert', 'item master',

    // Payments & Transactions
    'payment', 'upi', 'cash', 'cheque', 'bank transfer', 'ledger',
    'balance', 'transaction', 'due date', 'receivable', 'payable',
    'outstanding balance', 'payment reminder',

    // Financial Statements
    'profit', 'loss', 'revenue', 'expense', 'budget', 'cash flow',
    'balance sheet', 'income statement', 'trial balance', 'ledger report',

    // Reports
    'report', 'analytics', 'dashboard', 'sales report', 'purchase report',
    'gst report', 'item report', 'stock summary', 'party report',

    // ERP / CRM / Systems
    'crm', 'erp', 'software', 'business software', 'accounting software',
    'billing software', 'erp system', 'workflow', 'automation',

    // Vyapar-like features
    'vyapar', 'vyapar app', 'vyapar billing', 'mybillbook', 'khatabook',
    'instabill', 'zoho invoice', 'tally', 'quickbooks', 'profitbooks',

    // HR & Payroll
    'hr', 'payroll', 'employee', 'attendance', 'salary slip',

    // Compliance & Legal
    'audit', 'compliance', 'legal', 'msme', 'company registration',
    'pan', 'tan', 'gst compliance',

    // Business Strategy
    'management', 'strategy', 'marketing', 'operations', 'sop',

    // POS & Retail
    'pos', 'barcode scanner', 'cash register', 'thermal printer',
    'retail billing', 'mrp', 'unit price',

    // Misc
    'contract', 'agreement', 'subscription', 'renewal'
  ];
  const lower = text.toLowerCase();
  return keywords.some(word => lower.includes(word));
};

const formatChatResponse = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

// Voice Recognition Setup
export const initVoiceRecognition = (onResult: (text: string) => void, onStart: () => void) => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.log('Speech recognition not supported');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    onStart();
    console.log('Voice recognition started');
  };

  recognition.onresult = async (event: any) => {
    const transcript = event.results[0][0].transcript;
    console.log(`You said: ${transcript}`);
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
  };

  return recognition;
};

// OpenAI TTS Function
export const speakWithOpenAI = async (text: string): Promise<void> => {
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_TTS_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS failed: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Create audio element and play
    const audio = new Audio(audioUrl);
    await audio.play();
  } catch (error) {
    console.error('TTS Error:', error);
    // Fallback to browser TTS
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
  }
};

export const sendMessageToGrok = async (messages: GrokMessage[]): Promise<string> => {
  try {
    const userMessage = messages[messages.length - 1]?.content || 'Hello';
    
    if (!isBusinessRelated(userMessage)) {
      return "Sorry, I can only help with business management topics. 😊 Ask me about invoices, GST, accounting, sales, etc.";
    }
    
    const body = {
      system_instruction: {
        parts: [{
          text: "You are an AI Business Assistant. Your name is BizBot. User interacts with you via voice and the text is a transcription of what they said. Reply with short, helpful business advice that can be converted to voice. Add friendly emotions to your text. Keep under 50 words."
        }]
      },
      contents: [{
        parts: [{ text: userMessage }]
      }],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.7
      }
    };
    
    const response = await fetch(`${GROK_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    // GROK/OPENAI FORMAT (Alternative)
    // const response = await fetch(GROK_API_URL, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     messages: [
    //       {
    //         role: 'system',
    //         content: 'You are a helpful AI assistant for a business management system. Provide concise, helpful responses.'
    //       },
    //       ...messages
    //     ],
    //     model: MODEL,
    //     stream: false,
    //     temperature: 0.7
    //   })
    // });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data: GrokResponse = await response.json();
    
    // GEMINI RESPONSE FORMAT (Current)
    const rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    return formatChatResponse(rawResponse);
    
    // GROK/OPENAI RESPONSE FORMAT (Alternative)
    // return data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
    
  } catch (error) {
    console.error('AI API error:', error);
    return 'Sorry, I am currently unavailable. Please try again later.';
  }
};