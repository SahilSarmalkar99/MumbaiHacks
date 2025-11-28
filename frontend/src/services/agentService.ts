// Agent Service - Communicates with the backend LangGraph agent
const AGENT_BASE_URL = import.meta.env.VITE_AGENT_API_URL || 'http://localhost:8000';

export interface AgentInvoiceRequest {
  invoice_data: {
    invoice_number: string;
    amount: string;
  };
  customer_phone: string;
}

export interface AgentInvoiceResponse {
  invoice_data: {
    invoice_number: string;
    amount: string;
  };
  pdf_path: string | null;
  pdf_url: string | null;
  payment_status: string;
  razorpay_link_id: string | null;
  razorpay_payment_url: string | null;
  customer_phone: string;
}

class AgentService {
  private baseURL: string;

  constructor(baseURL: string = AGENT_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Trigger the invoice agent workflow
   * This will create a Razorpay payment link, generate PDF, send WhatsApp, and poll for payment
   */
  async triggerInvoiceAgent(
    invoiceId: string,
    totalAmount: number,
    customerPhone: string
  ): Promise<AgentInvoiceResponse> {
    const url = `${this.baseURL}/api/invoice`;

    // Format phone number - ensure it starts with country code
    const formattedPhone = this.formatPhoneNumber(customerPhone);

    const payload: AgentInvoiceRequest = {
      invoice_data: {
        invoice_number: invoiceId,
        amount: totalAmount.toFixed(2),
      },
      customer_phone: formattedPhone,
    };

    console.log('Triggering agent workflow:', { url, payload });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Agent response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Agent API error:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText || `HTTP error! status: ${response.status}` };
        }
        
        throw new Error(errorData.detail || `Agent API failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Agent workflow response:', data);
      return data;
    } catch (error) {
      console.error('Agent workflow failed:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Cannot connect to agent backend at ${this.baseURL}. Please ensure the agent server is running.`);
      }
      throw error;
    }
  }

  /**
   * Check agent health
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Agent health check failed:', error);
      throw error;
    }
  }

  /**
   * Format phone number for WhatsApp & Razorpay
   * Ensures proper international format (e.g., +919876543210)
   * Razorpay requires '+' prefix for phone numbers
   */
  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If it starts with country code (91 for India), add + prefix if not present
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return '+' + cleaned;
    }
    
    // If it's a 10-digit number, add India country code and + prefix
    if (cleaned.length === 10) {
      return '+91' + cleaned;
    }
    
    // Otherwise add + prefix to cleaned version
    return '+' + cleaned;
  }
}

export const agentService = new AgentService();
