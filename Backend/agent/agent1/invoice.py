# invoice_agent_ultramsg.py
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Optional, Dict
import os
import razorpay
import requests
import cloudinary
import cloudinary.uploader
import pdfkit
from dotenv import load_dotenv
import time
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO)

# === Env / clients ===
RAZORPAY_KEY = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUD_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUD_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
ULTRAMSG_TOKEN = os.getenv("ULTRAMSG_TOKEN")
ULTRAMSG_INSTANCE = os.getenv("ULTRAMSG_INSTANCE")  # example: instance152150
SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "https://your-server.com")

print("CLOUD:", os.getenv("CLOUDINARY_CLOUD_NAME"))
print("KEY:", os.getenv("CLOUDINARY_API_KEY"))
print("SECRET:", os.getenv("CLOUDINARY_API_SECRET"))

if not all([RAZORPAY_KEY, RAZORPAY_SECRET, CLOUD_NAME, CLOUD_API_KEY, CLOUD_API_SECRET, ULTRAMSG_TOKEN, ULTRAMSG_INSTANCE]):
    logging.warning("Some environment variables are missing. Ensure Razorpay, Cloudinary and UltraMsg vars are set.")

# Razorpay client - initialize with error handling
try:
    client = razorpay.Client(auth=(RAZORPAY_KEY, RAZORPAY_SECRET))
    logging.info("Razorpay client initialized successfully")
except Exception as e:
    logging.error(f"Failed to initialize Razorpay client: {e}")
    client = None

# Cloudinary config
cloudinary.config(
    cloud_name=CLOUD_NAME,
    api_key=CLOUD_API_KEY,
    api_secret=CLOUD_API_SECRET,
    secure=True
)

# === State typing ===
class InvoiceState(TypedDict):
    invoice_data: Dict
    pdf_path: Optional[str]
    pdf_url: Optional[str]
    payment_status: str
    razorpay_link_id: Optional[str]
    razorpay_payment_url: Optional[str]
    customer_phone: str

# === Utility: UltraMsg endpoints ===
def ultramsg_text_endpoint():
    # UltraMsg chat endpoint (text)
    # Many UltraMsg docs use: https://api.ultramsg.com/instanceXXXX/messages/chat
    return f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/chat"

def ultramsg_document_endpoint():
    # UltraMsg document endpoint
    return f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/document"

# === Node implementations ===

def is_valid_phone_number(phone: str) -> bool:
    """Validate phone number format. Razorpay rejects numbers with repeating digits."""
    if not phone:
        return False
    # Remove common formatting characters
    clean_phone = ''.join(filter(str.isdigit, phone))
    # Check if it's at least 10 digits
    if len(clean_phone) < 10:
        return False
    # Check for too many repeating digits (3+ of the same digit in a row)
    for i in range(len(clean_phone) - 2):
        if clean_phone[i] == clean_phone[i+1] == clean_phone[i+2]:
            return False
    return True

def format_phone_number(phone: str) -> str:
    """Format phone number to international format."""
    if not phone:
        return "+918765432109"  # Fallback test number
    
    # Remove all non-digit characters
    clean_phone = ''.join(filter(str.isdigit, phone))
    
    # If it's 10 digits (Indian format without country code), add +91
    if len(clean_phone) == 10:
        clean_phone = "91" + clean_phone
    
    # Add + prefix if not present
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone
    
    return clean_phone

def create_payment_link(state: InvoiceState):
    data = state["invoice_data"]
    amount_in_paise = int(float(data["amount"]) * 100)

    logging.info("Creating razorpay payment link for invoice %s amount %s", data["invoice_number"], data["amount"])
    
    if client is None:
        raise Exception("Razorpay client not initialized. Check your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file")
    
    # Validate and format phone number
    raw_phone = state.get("customer_phone", "")
    phone = format_phone_number(raw_phone)
    
    if not is_valid_phone_number(phone):
        logging.warning("Phone number %s failed validation. Using fallback.", phone)
        phone = "+918765432109"  # Fallback to a valid test number
    
    logging.info("Using phone number for Razorpay: %s", phone)
    
    try:
        payment = client.payment_link.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "description": f"Invoice #{data['invoice_number']}",
            "customer": {
                "contact": phone
            },
            "notify": {
                "sms": True,
                "email": False
            },
            "callback_url": f"{SERVER_BASE_URL}/payment-success/{data['invoice_number']}",
            "callback_method": "get"
        })
        logging.info("Payment link created successfully: %s", payment.get("id"))
        return {
            "razorpay_link_id": payment.get("id"),
            "razorpay_payment_url": payment.get("short_url"),
            "payment_status": "pending"
        }
    except razorpay.errors.BadRequestError as e:
        error_msg = str(e)
        if "Authentication failed" in error_msg:
            logging.error("Razorpay authentication failed. Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file are valid and not expired.")
        else:
            logging.error("Razorpay BadRequestError: %s", error_msg)
        raise
    except Exception:
        logging.exception("Failed to create Razorpay payment link")
        raise

def generate_pdf(state: InvoiceState):
    data = state["invoice_data"]
    invoice_no = data["invoice_number"]
    logging.info("Generating in-memory PDF for invoice %s", invoice_no)

    payment_url = state.get("razorpay_payment_url", "Not Generated Yet")
    data["payment_url"] = payment_url

    # === HTML content for PDF ===
    html_content = f"""
    <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          body {{ font-family: Arial, sans-serif; padding: 20px; }}
          h1 {{ border-bottom: 1px solid #ddd; padding-bottom: 10px; }}
          .total {{ font-size: 20px; font-weight: bold; margin-top: 20px; }}
        </style>
      </head>
      <body>
        <h1>Invoice #{invoice_no}</h1>
        <p>Amount: ₹{data['amount']}</p>
        <p>Payment Link: <a href="{payment_url}">{payment_url}</a></p>
        <div class="total">Total: ₹{data['amount']}</div>
      </body>
    </html>
    """

    # === Generate PDF IN MEMORY ===
    try:
        pdf_bytes = pdfkit.from_string(html_content, False)
        logging.info("Generated PDF in memory (type=%s, size=%d bytes)", type(pdf_bytes), len(pdf_bytes))
    except Exception:
        logging.exception("PDFKit in-memory generation failed")
        raise

    # === Upload PDF bytes to Cloudinary (pass credentials explicitly) ===
    try:
        upload_resp = cloudinary.uploader.upload(
            pdf_bytes,
            resource_type="raw",
            public_id=f"invoices/invoice_{invoice_no}",
            overwrite=True,
            api_key=CLOUD_API_KEY,
            api_secret=CLOUD_API_SECRET,
            cloud_name=CLOUD_NAME
        )
        pdf_url = upload_resp.get("secure_url")
        logging.info("Uploaded in-memory PDF to Cloudinary: %s", pdf_url)
    except Exception:
        logging.exception("Cloudinary upload failed")
        raise

    # Update state with PDF info
    state["pdf_path"] = None
    state["pdf_url"] = pdf_url

    return {"pdf_path": None, "pdf_url": pdf_url}




def send_whatsapp_invoice(state: InvoiceState):
    phone = state["customer_phone"]
    data = state["invoice_data"]
    payment_url = state.get("razorpay_payment_url")

    # Construct the message exactly as you want
    msg = (
        f"📄 Invoice #{data['invoice_number']}\n\n"
        f"Amount: ₹{data['amount']}\n"
        f"Payment Link: {payment_url}\n\n"
        "Please complete the payment using the above link."
    )

    text_payload = {
        "token": ULTRAMSG_TOKEN,
        "to": phone,
        "body": msg
    }

    text_url = ultramsg_text_endpoint()
    try:
        logging.info("Sending WhatsApp text via UltraMsg to %s", phone)
        r = requests.post(text_url, data=text_payload, timeout=20)
        logging.info("UltraMsg text response: %s %s", r.status_code, r.text)
    except Exception:
        logging.exception("UltraMsg text send failed")
    
    return {}

def wait_for_payment(state: InvoiceState):
    link_id = state.get("razorpay_link_id")
    if not link_id:
        logging.error("No razorpay_link_id in state.")
        return {"payment_status": "error", "payment_status_reason": "no_link_id"}

    max_attempts = 6
    delay_seconds = 5
    for attempt in range(1, max_attempts + 1):
        try:
            logging.info("Polling Razorpay link status (attempt %s/%s)", attempt, max_attempts)
            resp = client.payment_link.fetch(link_id)
            status = resp.get("status")
            logging.info("Razorpay link status: %s", status)
            if status in ("paid", "paid_partially"):
                return {"payment_status": "paid"}
            elif status in ("cancelled", "expired"):
                return {"payment_status": status}
        except Exception:
            logging.exception("Error fetching Razorpay payment link status")
        time.sleep(delay_seconds)

    return {"payment_status": "pending"}

def send_payment_confirmation(state: InvoiceState):
    phone = state["customer_phone"]
    msg = "✅ Payment Received! Thank you — your invoice is settled."

    text_payload = {
        "token": ULTRAMSG_TOKEN,
        "to": phone,
        "body": msg
    }
    text_url = ultramsg_text_endpoint()
    try:
        logging.info("Sending payment confirmation via UltraMsg to %s", phone)
        r = requests.post(text_url, data=text_payload, timeout=20)
        logging.info("UltraMsg confirmation response: %s %s", r.status_code, r.text)
    except Exception:
        logging.exception("UltraMsg confirmation send failed")

    return {}

# === LangGraph wiring ===
graph = StateGraph(InvoiceState)
graph.add_node("create_payment_link", create_payment_link)
graph.add_node("generate_pdf", generate_pdf)
graph.add_node("send_whatsapp_invoice", send_whatsapp_invoice)
graph.add_node("wait_for_payment", wait_for_payment)
graph.add_node("send_payment_confirmation", send_payment_confirmation)

graph.add_edge(START, "create_payment_link")
graph.add_edge("create_payment_link", "generate_pdf")
graph.add_edge("generate_pdf", "send_whatsapp_invoice")
graph.add_edge("send_whatsapp_invoice", "wait_for_payment")
graph.add_edge("wait_for_payment", "send_payment_confirmation")
graph.add_edge("send_payment_confirmation", END)

workflow = graph.compile()

# === Test harness ===
if __name__ == "__main__":
    test_state: InvoiceState = {
        "invoice_data": {
            "invoice_number": 202,
            "amount": "249.50"
        },
        "pdf_path": None,
        "pdf_url": None,
        "payment_status": "pending",
        "razorpay_link_id": None,
        "razorpay_payment_url": None,
        "customer_phone": "9588423093"  # replace with a test number registered / reachable
    }

    logging.info("Starting workflow test with UltraMsg.")
    result = workflow.invoke(test_state)
    logging.info("Workflow result: %s", result)

    print("\n--- SUMMARY ---")
    print("Razorpay Link ID:", result.get("razorpay_link_id"))
    print("Razorpay Payment URL:", result.get("razorpay_payment_url"))
    print("PDF URL (Cloudinary):", result.get("pdf_url"))
    print("Payment status:", result.get("payment_status"))
    print("If pending: open the payment url and complete test payment to observe confirmation.")
