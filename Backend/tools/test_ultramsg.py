import os
from dotenv import load_dotenv
import requests

load_dotenv()
ULTRAMSG_TOKEN = os.getenv("ULTRAMSG_TOKEN")
ULTRAMSG_INSTANCE = os.getenv("ULTRAMSG_INSTANCE")

if not ULTRAMSG_TOKEN or not ULTRAMSG_INSTANCE:
    print("ULTRAMSG_TOKEN or ULTRAMSG_INSTANCE not set in .env")
    exit(1)

phone = input("Enter target phone (digits, e.g. 9588423093): ").strip()
digits = ''.join(filter(str.isdigit, phone))
if len(digits) == 10:
    digits = '91' + digits
phone = '+' + digits

url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/chat"
payload = {
    'token': ULTRAMSG_TOKEN,
    'to': phone,
    'body': 'Test message from test_ultramsg.py',
}
headers = {'Content-Type': 'application/x-www-form-urlencoded'}

print(f"Sending test message to {phone} via {url}")
try:
    r = requests.post(url, data=payload, headers=headers, timeout=20)
    print('Status:', r.status_code)
    print('Response:', r.text)
except Exception as e:
    print('Request failed:', e)
