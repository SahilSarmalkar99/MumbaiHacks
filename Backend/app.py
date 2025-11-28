from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from agent.agent1.invoice import workflow
from agent.agent2.AdvCatBot import Bot
from agent.agent3.auto_reminder import start_scheduler
from langchain_core.messages import HumanMessage

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}})



# ------------------------------
# Health Check
# ------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Agent running"})


# ------------------------------
# Create Invoice Endpoint
# ------------------------------
@app.route("/api/invoice", methods=["POST"])
def create_invoice():
    try:
        payload = request.get_json()

        if not payload:
            return jsonify({"error": "Invalid JSON"}), 400

        invoice_data = payload.get("invoice_data")
        customer_phone = payload.get("customer_phone")

        if invoice_data is None or customer_phone is None:
            return jsonify({"error": "Missing required fields"}), 400

        # Build state exactly like your FastAPI version
        state = {
            "invoice_data": invoice_data,
            "pdf_path": None,
            "pdf_url": None,
            "payment_status": "pending",
            "razorpay_link_id": None,
            "razorpay_payment_url": None,
            "customer_phone": customer_phone,
        }

        # workflow.invoke is synchronous
        result = workflow.invoke(state)

        return jsonify(result)

    except Exception as e:
        logging.exception("Workflow failed")
        return jsonify({"error": str(e)}), 500


# ------------------------------
# Razorpay Payment Success Callback
# ------------------------------
@app.route("/api/payment-success/<int:invoice_number>", methods=["GET"])
def payment_success(invoice_number):
    try:
        logging.info(
            "Payment success callback received for invoice %s, query: %s",
            invoice_number,
            dict(request.args)
        )
        return jsonify({"status": "ok", "invoice_number": invoice_number})

    except Exception as e:
        logging.exception("Payment callback error")
        return jsonify({"error": str(e)}), 500

# ------------------------------
# ChatBot
# ------------------------------
@app.route("/agent", methods=["POST"])
def agent_endpoint():
    try:
        data = request.get_json()
        message = data.get("message")

        if not message:
            return jsonify({"error": "message is required"}), 400

        # Run agent workflow
        state_input = {
            "messages": [HumanMessage(content=message)],
            "tool_input": {}
        }

        result = Bot.invoke(
            state_input,
            config={
                "configurable": {
                    "thread_id": "global_user_1"
                }
            }
        )

        reply = result["messages"][-1].content
        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# ------------------------------
# Start Flask App
# ------------------------------
if __name__ == "__main__":
    start_scheduler()
    app.run(host="0.0.0.0", port=8000, debug=True)
