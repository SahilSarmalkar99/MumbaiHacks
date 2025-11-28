# Backend Agent - LangGraph Invoice Automation

This backend agent automates the invoice workflow using LangGraph:
1. Creates Razorpay payment links
2. Generates PDF invoices
3. Sends invoices via WhatsApp (UltraMsg)
4. Polls for payment confirmation
5. Sends payment confirmation messages

## Prerequisites

- Python 3.8+
- wkhtmltopdf installed (for PDF generation)
- Active accounts for:
  - Razorpay (payment links)
  - Cloudinary (PDF hosting)
  - UltraMsg (WhatsApp messaging)

## Installation

### 1. Install wkhtmltopdf

**Windows:**
Download and install from: https://wkhtmltopdf.org/downloads.html

**Linux:**
```bash
sudo apt-get install wkhtmltopdf
```

**Mac:**
```bash
brew install wkhtmltopdf
```

### 2. Install Python Dependencies

```bash
cd Backend/agent/agent
pip install -r requirements.txt
```

## Configuration

Edit the `.env` file in `Backend/agent/agent/.env`:

```env
# Razorpay Credentials
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Cloudinary Credentials
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# UltraMsg WhatsApp Credentials
ULTRAMSG_TOKEN=your_ultramsg_token
ULTRAMSG_INSTANCE=your_instance_id

# Server Configuration
SERVER_BASE_URL=https://your-server.com
```

## Running the Agent

```bash
cd Backend/agent/agent
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The agent API will be available at: `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /api/health
```

### Trigger Invoice Workflow
```
POST /api/invoice
Content-Type: application/json

{
  "invoice_data": {
    "invoice_number": "INV-001",
    "amount": "249.50"
  },
  "customer_phone": "919876543210"
}
```

Response:
```json
{
  "invoice_data": {
    "invoice_number": "INV-001",
    "amount": "249.50"
  },
  "pdf_path": "invoices/invoice_INV-001.pdf",
  "pdf_url": "https://cloudinary.com/...",
  "payment_status": "pending",
  "razorpay_link_id": "plink_xxx",
  "razorpay_payment_url": "https://rzp.io/l/xxx",
  "customer_phone": "919876543210"
}
```

## Integration with Frontend

The frontend automatically triggers this agent when a sale is confirmed in the POS system. The integration happens in `frontend/src/components/sale/SaleCheckout.tsx` after successful invoice creation.

## Troubleshooting

### PDF Generation Fails
- Ensure wkhtmltopdf is installed and in PATH
- Check permissions for `invoices/` directory

### WhatsApp Messages Not Sending
- Verify UltraMsg credentials
- Check phone number format (must include country code)
- Ensure UltraMsg instance is active

### Payment Link Creation Fails
- Verify Razorpay API credentials
- Check Razorpay account status
- Ensure amount is in valid format

## Testing

Test the workflow directly:
```bash
cd Backend/agent/agent
python invoice.py
```

This will run a test invoice with hardcoded data.
