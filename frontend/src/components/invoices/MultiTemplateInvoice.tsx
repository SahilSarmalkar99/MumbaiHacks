import React from 'react';
import { Invoice, User, InvoiceTemplateType } from '../../types';

interface MultiTemplateInvoiceProps {
  invoice: Invoice;
  businessInfo: User;
  template: InvoiceTemplateType;
}

export const MultiTemplateInvoice: React.FC<MultiTemplateInvoiceProps> = ({ invoice, businessInfo, template }) => {
  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    let dateObj: Date;
    if (date.toDate) {
      dateObj = date.toDate();
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }
    return dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Helper functions to handle both old and new invoice structures
  const getInvoiceNumber = () => {
    return invoice.invoiceId || invoice.invoiceNumber || invoice.id || 'N/A';
  };

  const getInvoiceDate = () => {
    if (invoice.buyerInfo?.date) return invoice.buyerInfo.date;
    if (invoice.createdAt) return formatDate(invoice.createdAt);
    if (invoice.date) return formatDate(invoice.date);
    return new Date().toISOString().split('T')[0];
  };

  const getBuyerName = () => {
    return invoice.buyerInfo?.name || invoice.customerName || 'N/A';
  };

  const getBuyerContact = () => {
    return invoice.buyerInfo?.contact || invoice.customerPhone || '';
  };

  const getBuyerAddress = () => {
    return invoice.buyerInfo?.address || '';
  };

  const getStatus = () => {
    return invoice.buyerInfo?.status || invoice.status || 'draft';
  };

  const getTaxAmount = () => {
    return invoice.totalTax ?? invoice.taxAmount ?? 0;
  };

  const getCurrency = () => {
    return 'Rs';
  };

  const currencySymbol = 'Rs';

  const getTemplateStyles = () => {
    switch (template) {
      case 'modern':
        return {
          headerBg: 'bg-purple-600',
          accentColor: 'text-purple-600',
          borderColor: 'border-purple-200'
        };
      case 'minimal':
        return {
          headerBg: 'bg-gray-800',
          accentColor: 'text-gray-800',
          borderColor: 'border-gray-300'
        };
      case 'professional':
        return {
          headerBg: 'bg-green-600',
          accentColor: 'text-green-600',
          borderColor: 'border-green-200'
        };
      case 'colorful':
        return {
          headerBg: 'bg-gradient-to-r from-orange-500 to-red-500',
          accentColor: 'text-orange-600',
          borderColor: 'border-orange-200'
        };
      case 'elegant':
        return {
          headerBg: 'bg-indigo-600',
          accentColor: 'text-indigo-600',
          borderColor: 'border-indigo-200'
        };
      case 'bold':
        return {
          headerBg: 'bg-red-600',
          accentColor: 'text-red-600',
          borderColor: 'border-red-200'
        };
      case 'simple':
        return {
          headerBg: 'bg-teal-600',
          accentColor: 'text-teal-600',
          borderColor: 'border-teal-200'
        };
      default: // classic
        return {
          headerBg: 'bg-blue-600',
          accentColor: 'text-blue-600',
          borderColor: 'border-blue-200'
        };
    }
  };

  const styles = getTemplateStyles();

  return (
    <div id="invoice-template" className="bg-white p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className={`${styles.headerBg} text-white p-6 sm:p-8 rounded-t-lg mb-4 sm:mb-6`}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{businessInfo.businessName}</h1>
            <p className="text-xs sm:text-sm opacity-90">{businessInfo.address}</p>
          </div>
          <div className="text-left sm:text-right">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold">
              TAX INVOICE
            </h2>
            <p className="text-xs sm:text-sm">#{getInvoiceNumber()}</p>
          </div>
        </div>
      </div>

      {/* Business & Invoice Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-4 sm:mb-6">
        <div>
          <h3 className={`font-bold ${styles.accentColor} mb-2 text-sm sm:text-base`}>From:</h3>
          <div className="text-xs sm:text-sm space-y-1">
            <p><strong>{businessInfo.name}</strong></p>
            <p>Phone: {businessInfo.contactNumber}</p>
            <p className="break-all">Email: {businessInfo.email}</p>
            {businessInfo.gstNumber && <p>GSTIN: {businessInfo.gstNumber}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-xs sm:text-sm space-y-1 mb-3">
            <p><strong>Date:</strong> {formatDate(getInvoiceDate())}</p>
            <p><strong>Status:</strong> 
              <span className={`ml-1 px-2 py-1 rounded text-xs ${
                getStatus() === 'paid' ? 'bg-green-100 text-green-800' :
                getStatus() === 'sent' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getStatus().toUpperCase()}
              </span>
            </p>
          </div>
          {businessInfo.paymentQRCode && (
            <div className="border border-gray-300 p-3 rounded bg-gray-50 inline-block">
              <p className={`text-sm font-bold ${styles.accentColor} mb-2`}>Scan to Pay</p>
              <img src={businessInfo.paymentQRCode} alt="Payment QR" className="w-24 h-24 mx-auto" />
            </div>
          )}
        </div>
      </div>

      {/* Bill To */}
      <div className={`border-l-4 ${styles.borderColor} pl-3 sm:pl-4 mb-4 sm:mb-6`}>
        <h3 className={`font-bold ${styles.accentColor} mb-2 text-sm sm:text-base`}>Bill To:</h3>
        <div className="text-xs sm:text-sm space-y-1">
          <p className="font-bold">{getBuyerName()}</p>
          {getBuyerContact() && <p>Contact: {getBuyerContact()}</p>}
          {getBuyerAddress() && <p>Address: {getBuyerAddress()}</p>}
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse border border-gray-800">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="border border-gray-800 p-3 text-left text-xs font-bold text-white w-2/5">ITEM</th>
              <th className="border border-gray-800 p-3 text-center text-xs font-bold text-white w-1/12">QTY</th>
              <th className="border border-gray-800 p-3 text-right text-xs font-bold text-white w-1/6">RATE</th>
              <th className="border border-gray-800 p-3 text-right text-xs font-bold text-white w-1/12">TAX</th>
              <th className="border border-gray-800 p-3 text-right text-xs font-bold text-white w-1/6">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => {
              const unitPrice = item.unitPrice ?? item.price;
              const taxPercent = item.taxPercent ?? item.taxRate ?? 0;
              const lineTotal = item.lineTotal ?? item.total;
              
              return (
                <tr key={index}>
                  <td className="border border-gray-800 p-3 text-sm break-words">{item.name}</td>
                  <td className="border border-gray-800 p-3 text-center text-sm">{item.quantity}</td>
                  <td className="border border-gray-800 p-3 text-right text-sm whitespace-nowrap">Rs {unitPrice.toFixed(2)}</td>
                  <td className="border border-gray-800 p-3 text-right text-sm">{taxPercent}%</td>
                  <td className="border border-gray-800 p-3 text-right text-sm font-medium whitespace-nowrap">Rs {lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-80 bg-gray-50 p-4 rounded">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium">Subtotal:</span>
              <span className="font-medium">Rs {invoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Tax Amount:</span>
              <span className="font-medium">Rs {getTaxAmount().toFixed(2)}</span>
            </div>
            <div className="border-t pt-3">
              <div className={`flex justify-between items-center font-bold text-lg ${styles.accentColor}`}>
                <span>Total:</span>
                <span>Rs {invoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="mb-4 sm:mb-6">
        <h3 className={`font-bold ${styles.accentColor} mb-2 text-sm sm:text-base`}>Terms & Conditions:</h3>
        <div className="text-xs space-y-1 text-gray-700">
          <p>1. Payment is due within 30 days of invoice date.</p>
          <p>2. Interest @ 18% per annum will be charged on overdue amounts.</p>
          <p>3. All disputes are subject to local jurisdiction only.</p>
          <p>4. Goods once sold will not be taken back.</p>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-4 sm:mb-6">
        <div className="text-center">
          <div className="border-t border-gray-400 mt-8 sm:mt-12 pt-2">
            <p className="text-xs font-medium">Customer Signature</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-400 mt-8 sm:mt-12 pt-2">
            {businessInfo.signature && businessInfo.signature.startsWith('data:image') ? (
              <img src={businessInfo.signature} alt="Signature" className="h-6 sm:h-8 mx-auto mb-1" />
            ) : (
              <p className="text-xs font-medium">{businessInfo.signature || businessInfo.name}</p>
            )}
            <p className="text-xs text-gray-600">Authorized Signatory</p>
            <p className="text-xs text-gray-600 truncate">{businessInfo.businessName}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 border-t pt-4">
        <p>Thank you for your business!</p>
        <p>This is a computer generated invoice and does not require physical signature.</p>
      </div>
    </div>
  );
};