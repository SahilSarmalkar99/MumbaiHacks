from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from typing_extensions import TypedDict, Annotated
from dotenv import load_dotenv
import os
import logging
import requests
from firebase_utils import db
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.tools import tool
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage
import razorpay
import cloudinary
import threading
from langgraph.checkpoint.memory import MemorySaver




# ---- Memory (Persistent) ----
checkpointer = MemorySaver()


load_dotenv()
logging.basicConfig(level=logging.INFO)

# ---- Load environment variables ----
RAZORPAY_KEY = os.getenv("RAZORPAY_KEY")
RAZORPAY_SECRET = os.getenv("RAZORPAY_SECRET")
CLOUD_NAME = os.getenv("CLOUD_NAME")
CLOUD_API_KEY = os.getenv("CLOUD_API_KEY")
CLOUD_API_SECRET = os.getenv("CLOUD_API_SECRET")
ULTRAMSG_TOKEN = os.getenv("ULTRAMSG_TOKEN")
ULTRAMSG_INSTANCE = os.getenv("ULTRAMSG_INSTANCE")
SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "https://your-server.com")


# ---- Razorpay client ----
client = razorpay.Client(auth=(RAZORPAY_KEY, RAZORPAY_SECRET))

# ---- Cloudinary config ----
cloudinary.config(
    cloud_name=CLOUD_NAME,
    api_key=CLOUD_API_KEY,
    api_secret=CLOUD_API_SECRET,
    secure=True
)

# ---- LLM ----
os.environ["OPENAI_API_KEY"] = os.getenv("OPENROUTER")
os.environ["OPENAI_API_BASE"] = "https://openrouter.ai/api/v1"

llm = ChatOpenAI(
    model="x-ai/grok-4.1-fast",
    temperature=0,
)



# ---- State typing ----
class InputState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    tool_input: dict


# threading the razorpay
logging.basicConfig(level=logging.INFO)

def send_reminder(invoice_data, invoice_id=None):
    try:
        logging.info("===== send_reminder called =====")
        logging.info("invoice_data: %s", invoice_data)
        logging.info("================================")

        # Write to debug file
        debug_file = os.path.join(os.getcwd(), "debug_invoice.txt")
        with open(debug_file, "a") as f:
            f.write(str(invoice_data) + "\n")
        logging.info(f"Invoice data written to {debug_file}")

        # Prepare phone number
        raw_phone = str(invoice_data["buyerInfo"]["contact"]).strip()
        digits = "".join(filter(str.isdigit, raw_phone))
        if len(digits) == 10:
            digits = "91" + digits
        elif len(digits) == 12 and digits.startswith("91"):
            pass
        else:
            logging.error("[PHONE ERROR] Invalid phone number: %s", raw_phone)
            return
        phone = "+" + digits
        logging.info("[DEBUG] Final phone: %s", phone)

        # Use invoice_id if provided, else fallback to Firestore doc ID
        invoice_number = invoice_id or invoice_data.get("meta", {}).get("createdBy", "N/A")

        # Razorpay payment link
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
        logging.info("[DEBUG] Razorpay Link: %s", payment_url)

        # Message to customer
        msg = (
            f"⚠️ Payment Reminder\n"
            f"Invoice #{invoice_number}\n"
            f"Amount: ₹{invoice_data['total']}\n"
            f"Pay now: {payment_url}"
        )

        # Send WhatsApp via UltraMsg
        url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/chat"
        payload = {
            "token": ULTRAMSG_TOKEN,
            "to": phone,
            "body": msg,
            "priority": "10"
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        response = requests.post(url, data=payload, headers=headers, timeout=20)

        logging.info("[UltraMsg] Status: %s", response.status_code)
        logging.info("[UltraMsg] Response: %s", response.text)
        if "error" in response.text.lower():
            logging.error("[UltraMsg ERROR] %s", response.text)

        logging.info("========== REMINDER END ==========\n")

    except Exception as e:
        logging.error("[Reminder ERROR] %s", e)


# ---- Tools ----
@tool
def tool_pending_invoices(state: InputState) -> dict:
    """Return all invoices with status 'sent' or 'pending'."""
    docs = db.collection("invoices").stream()
    pending = []
    for d in docs:
        data = d.to_dict()
        buyer = data.get("buyerInfo", {})
        if data.get("status") in ["sent", "pending"]:
            pending.append({
                "name": buyer.get("name"),
                "contact": buyer.get("contact"),
                "total": data.get("total"),
                "invoice_id": d.id,
                "status": data.get("status")
            })
    return {"result": pending}


@tool
def tool_list_products(state: InputState) -> dict:
    """Returns the list of products."""
    docs = db.collection("products").stream()
    products = [d.to_dict() for d in docs]
    return {"result": products}

@tool
def get_customer_info(customer_name: str, trigger_reminder: bool = False):
    """
    Fetch customer invoice information from Firestore by name.
    If send_reminder=True -> send WhatsApp reminder.
    Otherwise NEVER send reminder automatically.
    """

    logging.info(f"[Tool] Looking for customer: {customer_name}")
    print(f"[DEBUG] get_customer_info called with {customer_name}")

    if not customer_name or customer_name.strip() == "":
        return {"error": "Customer name missing."}

    customer_name = customer_name.strip().lower()

    invoices = db.collection("invoices").stream()

    results = []
    for doc in invoices:
        data = doc.to_dict()
        buyer = data.get("buyerInfo", {})
        name = buyer.get("name", "").lower()

        if name == customer_name:
            results.append(data)

            # ONLY SEND REMINDER IF USER EXPLICITLY ASKED
            if trigger_reminder:
                send_reminder(data)

    if not results:
        return {"message": f"No customer found with name '{customer_name}'."}

    return {"invoices": results}

@tool
def tool_send_payment_reminder(invoice_id: str) -> dict:
    """
    Send a payment reminder (WhatsApp + Razorpay payment link)
    for a given invoice_id coming from Firestore.
    """

    try:
        logging.info(f"[Tool] Sending payment reminder for invoice: {invoice_id}")

        # Fetch invoice from Firestore
        doc_ref = db.collection("invoices").document(invoice_id)
        doc = doc_ref.get()

        if not doc.exists:
            logging.error("[Reminder Tool] Invoice not found.")
            return {"error": f"Invoice '{invoice_id}' not found in Firestore."}

        invoice_data = doc.to_dict()

        # Call the same reminder function you already built
        threading.Thread(
            target=send_reminder, 
            args=(invoice_data, invoice_id),
            daemon=True
        ).start()

        logging.info("[Tool] Reminder thread started successfully.")

        return {
            "status": "success",
            "message": f"Reminder sent to customer for invoice {invoice_id}.",
            "customer": invoice_data.get("buyerInfo", {}).get("name"),
            "contact": invoice_data.get("buyerInfo", {}).get("contact"),
            "total": invoice_data.get("total")
        }

    except Exception as e:
        logging.error(f"[Reminder Tool ERROR] {e}")
        return {"error": str(e)}


# ---- LangGraph setup ----
tools = [get_customer_info, tool_list_products, tool_pending_invoices , tool_send_payment_reminder]
tool_node = ToolNode(tools)

llm_with_tools = llm.bind_tools(tools)


def chat_node(state: InputState):
    messages = state["messages"]
    res = llm_with_tools.invoke(messages)
    return {"messages": [res]}

graph = StateGraph(InputState, checkpointer=checkpointer)
graph.add_node("chat_node", chat_node)
graph.add_node("tools", tool_node)
graph.add_edge(START, "chat_node")
graph.add_conditional_edges("chat_node", tools_condition)
graph.add_edge("tools", "chat_node")
Bot = graph.compile()


# while True:
#     query = input("You: ")
#     if query.lower() in ["exit", "quit"]:
#         break
#     customer_name = query.split()[-1] 
#     out = workflow.invoke({
#         "messages": [HumanMessage(content=query)],
#         "tool_input": {}
#     })
#     print("Bot:", out["messages"][-1].content)

# if __name__ == "__main__":
#     test_invoice = {
#         "invoice_number": "TEST123",
#         "total": "499",
#         "buyerInfo": {"contact": "9588423093"}
#     }
#     send_reminder(test_invoice)
