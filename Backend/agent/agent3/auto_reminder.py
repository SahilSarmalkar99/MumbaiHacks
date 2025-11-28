import firebase_admin
from firebase_admin import credentials, firestore
import requests
import logging
import os
import schedule
import time
from datetime import datetime, timedelta
import razorpay
import json
from firebase_utils import db
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
# ===== CONFIG =====
ULTRAMSG_TOKEN = os.getenv("ULTRAMSG_TOKEN")
ULTRAMSG_INSTANCE = os.getenv("ULTRAMSG_INSTANCE")
SERVER_BASE_URL = "https://your-server.com"
RAZORPAY_API_KEY = os.getenv("RAZORPAY_KEY")
RAZORPAY_API_SECRET = os.getenv("RAZORPAY_SECRET")
print("ULTRAMSG TOKEN:", ULTRAMSG_TOKEN)
print("ULTRAMSG INSTANCE:", ULTRAMSG_INSTANCE)


# Scheduler interval (minutes)
INTERVAL = 60

# File to track already sent reminders
REMINDER_TRACK_FILE = "sent_reminders.json"

def ultramsg_text_endpoint():
    # Correct UltraMsg text message endpoint
    return f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/text"



# Razorpay client
client = razorpay.Client(auth=(RAZORPAY_API_KEY, RAZORPAY_API_SECRET))

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


# ===== Helper: Load/Save sent reminders =====
def load_sent_reminders():
    if os.path.exists(REMINDER_TRACK_FILE):
        with open(REMINDER_TRACK_FILE, "r") as f:
            return json.load(f)
    return {}


def save_sent_reminders(data):
    with open(REMINDER_TRACK_FILE, "w") as f:
        json.dump(data, f, indent=4)


# ===== Send Reminder =====
def send_reminder(invoice_data, invoice_id=None):
    try:
        logging.info("Sending reminder for invoice: %s", invoice_id)

        raw_phone = str(invoice_data["buyerInfo"]["contact"]).strip()
        digits = "".join(filter(str.isdigit, raw_phone))

        if len(digits) == 10:
            digits = "91" + digits
        phone = "+" + digits  # UltraMsg requires + prefix

        invoice_number = invoice_id or "N/A"
        amount_in_paise = int(float(invoice_data["total"]) * 100)

        payment = client.payment_link.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "description": f"Invoice #{invoice_number}",
            "customer": {"contact": phone},
            "notify": {"sms": True, "email": False},
            "callback_url": f"{SERVER_BASE_URL}/payment-success/{invoice_number}",
            "callback_method": "get"
        })

        payment_url = payment.get("short_url")

        msg = (
            f"⚠️ Payment Reminder\n"
            f"Invoice #{invoice_number}\n"
            f"Amount: ₹{invoice_data['total']}\n"
            f"Pay now: {payment_url}"
        )

        url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/chat"
        
        payload = {
            "token": ULTRAMSG_TOKEN,
            "to": phone,
            "body": msg,
            "priority": "10"
        }

        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        response = requests.post(url, data=payload, headers=headers, timeout=20)

        logging.info("UltraMsg response: %s %s", response.status_code, response.text)

        if "error" in response.text.lower():
            return False

        return True

    except Exception as e:
        logging.error("[Reminder ERROR] %s", e)
        return False






# ===== Fetch pending invoices and send reminders =====
def process_pending_invoices():
    logging.info("==== Checking pending invoices ====")
    sent_reminders = load_sent_reminders()
    invoices_ref = db.collection('invoices')
    docs = invoices_ref.stream()

    sent_count = 0
    sent_list = []

    for doc in docs:
        data = doc.to_dict()
        invoice_id = doc.id
        buyer_info = data.get("buyerInfo", {})
        status = buyer_info.get("status", "").lower()

        # Send only if pending and not already sent
        if status == "pending" and invoice_id not in sent_reminders:
            success = send_reminder(data, invoice_id=invoice_id)
            if success:
                sent_reminders[invoice_id] = datetime.now().isoformat()
                sent_count += 1
                sent_list.append(invoice_id)

    save_sent_reminders(sent_reminders)
    logging.info(f"==== Completed. Total reminders sent: {sent_count} ====")
    if sent_list:
        logging.info("Invoices reminded: %s", sent_list)


# ===== Scheduler =====
# ===== Scheduler =====
def start_scheduler(interval_seconds=5):  # change to seconds for testing
    schedule.every(interval_seconds).seconds.do(process_pending_invoices)
    logging.info(f"Scheduler started. Reminders will run every {interval_seconds} seconds.")

    while True:
        schedule.run_pending()
        time.sleep(1)

