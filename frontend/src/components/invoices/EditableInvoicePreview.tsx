import React, { useState } from 'react';
import { Edit, Save, Printer, MessageCircle, Plus, Minus, Download } from 'lucide-react';
import { Invoice, InvoiceItem, User, InvoiceTemplateType } from '../../types';
import { MultiTemplateInvoice } from './MultiTemplateInvoice';
import { TemplateSelector } from './TemplateSelector';
import { WhatsAppShare } from './WhatsAppShare';

interface EditableInvoicePreviewProps {
  invoice: Invoice;
  businessInfo: User;
  onUpdateInvoice: (invoice: Invoice) => void;
  onBack: () => void;
}

export const EditableInvoicePreview: React.FC<EditableInvoicePreviewProps> = ({
  invoice,
  businessInfo,
  items,
  onUpdateInvoice,
  onBack
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplateType>('classic');
  const [editData, setEditData] = useState({
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    customerPhone: invoice.customerPhone,
    items: [...invoice.items],
    dueDate: invoice.dueDate || ''
  });

  const calculateTotals = () => {
    const subtotal = editData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const taxAmount = editData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.price;
      return sum + (itemSubtotal * item.taxRate) / 100;
    }, 0);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSaveChanges = () => {
    const { subtotal, taxAmount, total } = calculateTotals();
    const updatedInvoice: Invoice = {
      ...invoice,
      ...editData,
      subtotal,
      taxAmount,
      total
    };
    onUpdateInvoice(updatedInvoice);
    setIsEditing(false);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setEditData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          if (field === 'itemId') {
            const selectedItem = items.find(it => it.id === value);
            if (selectedItem) {
              updatedItem.name = selectedItem.name;
              updatedItem.price = selectedItem.price;
              updatedItem.taxRate = selectedItem.taxRate;
            }
          }
          
          if (field === 'quantity' || field === 'price' || field === 'taxRate') {
            const subtotal = updatedItem.quantity * updatedItem.price;
            const taxAmount = (subtotal * updatedItem.taxRate) / 100;
            updatedItem.total = subtotal + taxAmount;
          }
          
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const addItem = () => {
    setEditData(prev => ({
      ...prev,
      items: [...prev.items, {
        itemId: '',
        name: '',
        quantity: 1,
        price: 0,
        taxRate: 18,
        total: 0
      }]
    }));
  };

  const removeItem = (index: number) => {
    setEditData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleDownloadPDF = async () => {
    const { subtotal, taxAmount, total } = calculateTotals();
    const pdfInvoice: Invoice = {
      ...invoice,
      ...editData,
      subtotal,
      taxAmount,
      total
    };
    
    const tempDiv = document.createElement('div');
    tempDiv.id = 'temp-pdf-invoice';
    tempDiv.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: #2563eb; margin-bottom: 20px;">${pdfInvoice.type.toUpperCase()} INVOICE</h1>
        <div style="margin-bottom: 20px;">
          <p><strong>Invoice #:</strong> ${pdfInvoice.invoiceNumber}</p>
          <p><strong>Date:</strong> ${new Date(pdfInvoice.date).toLocaleDateString()}</p>
          <p><strong>Customer:</strong> ${pdfInvoice.customerName}</p>
          ${pdfInvoice.customerEmail ? `<p><strong>Email:</strong> ${pdfInvoice.customerEmail}</p>` : ''}
          ${pdfInvoice.customerPhone ? `<p><strong>Phone:</strong> ${pdfInvoice.customerPhone}</p>` : ''}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Item</th>
              <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">Qty</th>
              <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Rate</th>
              <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Tax %</th>
              <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${pdfInvoice.items.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 10px;">${item.name}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${item.quantity}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">₹${item.price.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${item.taxRate}%</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">₹${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="text-align: right; margin-top: 30px;">
          <div style="display: inline-block; min-width: 200px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Subtotal:</span>
              <span>₹${pdfInvoice.subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Tax Amount:</span>
              <span>₹${pdfInvoice.taxAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; border-top: 2px solid #2563eb; padding-top: 10px;">
              <span>Total:</span>
              <span>₹${pdfInvoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(tempDiv);
    
    try {
      const { generateInvoicePDF } = await import('../../utils/pdfGenerator');
      await generateInvoicePDF(pdfInvoice, 'temp-pdf-invoice');
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF generation failed. Please try again.');
    } finally {
      setTimeout(() => document.body.removeChild(tempDiv), 1000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const invoiceElement = document.getElementById('invoice-preview');
      if (invoiceElement) {
        const printContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Invoice - ${currentInvoice.invoiceNumber}</title>
              <meta charset="utf-8">
              <style>
                @page { 
                  margin: 0; 
                  size: A4;
                }
                @media print {
                  html, body {
                    width: 210mm;
                    height: 297mm;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                }
                * {
                  box-sizing: border-box;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                body { 
                  font-family: Arial, sans-serif; 
                  margin: 0; 
                  padding: 15mm;
                  font-size: 12px;
                  line-height: 1.4;
                  color: #000;
                  width: 100%;
                  height: 100%;
                }
                .invoice-container {
                  width: 100%;
                  max-width: none;
                  margin: 0;
                  background: white;
                  height: 100%;
                }
                .header {
                  background-color: #2563eb;
                  color: white;
                  padding: 15px;
                  margin-bottom: 20px;
                }
                .header h1 { margin: 0; font-size: 20px; }
                .header h2 { margin: 5px 0 0 0; font-size: 16px; }
                .header p { margin: 2px 0; font-size: 11px; }
                .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .text-right { text-align: right; }
                .grid-2 { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .grid-2 > div { width: 48%; }
                .bill-to {
                  border-left: 4px solid #2563eb;
                  padding-left: 10px;
                  margin-bottom: 20px;
                }
                table { 
                  width: 100%; 
                  border-collapse: collapse; 
                  margin: 15px 0;
                }
                th, td { 
                  padding: 8px; 
                  border: 1px solid #000; 
                  text-align: left;
                  font-size: 11px;
                }
                th { 
                  background-color: #1f2937; 
                  color: white; 
                  font-weight: bold;
                  text-align: center;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .totals {
                  width: 250px;
                  margin-left: auto;
                  margin-top: 20px;
                }
                .totals div {
                  display: flex;
                  justify-content: space-between;
                  padding: 5px 0;
                }
                .total-line {
                  border-top: 1px solid #000;
                  font-weight: bold;
                  font-size: 14px;
                  color: #2563eb;
                }
                .terms {
                  margin: 20px 0;
                }
                .terms h3 {
                  color: #2563eb;
                  margin-bottom: 10px;
                }
                .terms p {
                  margin: 3px 0;
                  font-size: 10px;
                }
                .signatures {
                  display: flex;
                  justify-content: space-between;
                  margin-top: 40px;
                }
                .signature {
                  width: 45%;
                  text-align: center;
                }
                .signature-line {
                  border-top: 1px solid #000;
                  margin-top: 30px;
                  padding-top: 5px;
                }
                .footer {
                  text-align: center;
                  margin-top: 30px;
                  padding-top: 15px;
                  border-top: 1px solid #ccc;
                  font-size: 10px;
                  color: #666;
                }
                .font-bold { font-weight: bold; }
                .mb-2 { margin-bottom: 8px; }
              </style>
            </head>
            <body>
              <div class="invoice-container">
                <div class="header">
                  <div class="flex justify-between">
                    <div>
                      <h1>${businessInfo.businessName}</h1>
                      <p>${businessInfo.address || ''}</p>
                    </div>
                    <div class="text-right">
                      <h2>${currentInvoice.type === 'sales' ? 'TAX INVOICE' : 
                           currentInvoice.type === 'purchase' ? 'PURCHASE INVOICE' : 'DELIVERY CHALLAN'}</h2>
                      <p>#${currentInvoice.invoiceNumber}</p>
                    </div>
                  </div>
                </div>
                
                <div class="grid-2">
                  <div>
                    <h3 style="color: #2563eb; margin-bottom: 8px;">From:</h3>
                    <p class="font-bold">${businessInfo.name}</p>
                    <p>Phone: ${businessInfo.contactNumber}</p>
                    <p>Email: ${businessInfo.email}</p>
                    ${businessInfo.gstNumber ? `<p>GSTIN: ${businessInfo.gstNumber}</p>` : ''}
                  </div>
                  <div class="text-right">
                    <p><strong>Date:</strong> ${new Date(currentInvoice.date).toLocaleDateString()}</p>
                    ${currentInvoice.dueDate ? `<p><strong>Due Date:</strong> ${new Date(currentInvoice.dueDate).toLocaleDateString()}</p>` : ''}
                    <p><strong>Status:</strong> ${currentInvoice.status.toUpperCase()}</p>
                  </div>
                </div>
                
                <div class="bill-to">
                  <h3 style="color: #2563eb; margin-bottom: 8px;">Bill To:</h3>
                  <p class="font-bold">${currentInvoice.customerName}</p>
                  ${currentInvoice.customerEmail ? `<p>Email: ${currentInvoice.customerEmail}</p>` : ''}
                  ${currentInvoice.customerPhone ? `<p>Phone: ${currentInvoice.customerPhone}</p>` : ''}
                </div>
                
                <table>
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th>QTY</th>
                      <th>RATE</th>
                      <th>TAX</th>
                      <th>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${currentInvoice.items.map(item => `
                      <tr>
                        <td>${item.name}</td>
                        <td class="text-center">${item.quantity}</td>
                        <td class="text-right">₹${item.price.toFixed(2)}</td>
                        <td class="text-right">${item.taxRate}%</td>
                        <td class="text-right font-bold">₹${item.total.toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                
                <div class="totals">
                  <div>
                    <span>Subtotal:</span>
                    <span>₹${currentInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div>
                    <span>Tax Amount:</span>
                    <span>₹${currentInvoice.taxAmount.toFixed(2)}</span>
                  </div>
                  <div class="total-line">
                    <span>Total:</span>
                    <span>₹${currentInvoice.total.toFixed(2)}</span>
                  </div>
                </div>
                
                <div class="terms">
                  <h3>Terms & Conditions:</h3>
                  <p>1. Payment is due within 30 days of invoice date.</p>
                  <p>2. Interest @ 18% per annum will be charged on overdue amounts.</p>
                  <p>3. All disputes are subject to local jurisdiction only.</p>
                  <p>4. Goods once sold will not be taken back.</p>
                </div>
                
                <div class="signatures">
                  <div class="signature">
                    <div class="signature-line">
                      <p style="font-size: 10px; font-weight: bold;">Customer Signature</p>
                    </div>
                  </div>
                  <div class="signature">
                    <div class="signature-line">
                      <p style="font-size: 10px; font-weight: bold;">${businessInfo.signature || businessInfo.name}</p>
                      <p style="font-size: 9px; color: #666;">Authorized Signatory</p>
                      <p style="font-size: 9px; color: #666;">${businessInfo.businessName}</p>
                    </div>
                  </div>
                </div>
                
                <div class="footer">
                  <p>Thank you for your business!</p>
                  <p>This is a computer generated invoice and does not require physical signature.</p>
                </div>
              </div>
            </body>
          </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    }
  };

  const handleWhatsAppShare = (phoneNumber: string, message: string) => {
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const currentInvoice = {
    ...invoice,
    ...editData,
    ...calculateTotals()
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white shadow-md p-4 border-b no-print">
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            ← Back
          </button>
          <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveChanges}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Edit className="w-4 h-4" />
                Edit Invoice
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Printer className="w-4 h-4" />
                Print Invoice
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <WhatsAppShare 
                invoice={currentInvoice} 
                onShare={handleWhatsAppShare} 
              />
            </>
          )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Template Selector */}
        <div className="no-print">
          <TemplateSelector 
            selectedTemplate={selectedTemplate}
            onTemplateChange={setSelectedTemplate}
          />
        </div>

        {/* Edit Form */}
        {isEditing && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6 no-print">
            <h3 className="text-lg font-semibold mb-4">Edit Invoice Details</h3>
          
          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={editData.customerName}
                onChange={(e) => setEditData(prev => ({ ...prev, customerName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={editData.customerEmail}
                onChange={(e) => setEditData(prev => ({ ...prev, customerEmail: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={editData.customerPhone}
                onChange={(e) => setEditData(prev => ({ ...prev, customerPhone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Items */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Items</h4>
              <button
                onClick={addItem}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
            
            <div className="space-y-3">
              {editData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 p-3 border border-gray-200 rounded">
                  <select
                    value={item.itemId}
                    onChange={(e) => updateItem(index, 'itemId', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select Item</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Price"
                  />
                  <input
                    type="number"
                    value={item.taxRate}
                    onChange={(e) => updateItem(index, 'taxRate', parseFloat(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Tax%"
                  />
                  <div className="px-2 py-1 text-sm font-medium">
                    ₹{item.total.toFixed(2)}
                  </div>
                  <button
                    onClick={() => removeItem(index)}
                    className="p-1 text-red-600 hover:text-red-800"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>
        )}

        {/* Invoice Preview */}
        <div id="invoice-preview" className="bg-white rounded-lg shadow-md printable">
          <MultiTemplateInvoice 
            invoice={currentInvoice} 
            businessInfo={businessInfo} 
            template={selectedTemplate}
          />
        </div>
      </div>
    </div>
  );
};