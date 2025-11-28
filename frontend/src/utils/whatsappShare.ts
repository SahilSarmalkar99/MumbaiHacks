import { Invoice } from '../types';
import { generateInvoicePDF, generateGSTReportPDF } from './pdfGenerator';
import html2canvas from 'html2canvas';

export interface ShareOptions {
  format: 'text' | 'pdf' | 'jpg';
  phoneNumber: string;
  message: string;
  elementId?: string;
}

export const shareToWhatsApp = (phoneNumber: string, message: string) => {
  const cleanPhone = phoneNumber.replace(/[^\\d]/g, '');
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
};

export const generateJPGFromElement = async (elementId: string): Promise<string | null> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found:', elementId);
    return null;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          clonedElement.style.width = '210mm';
          clonedElement.style.padding = '20px';
          clonedElement.style.fontFamily = 'Arial, sans-serif';
          clonedElement.style.backgroundColor = '#ffffff';
        }
      }
    });
    
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error('Error generating JPG:', error);
    return null;
  }
};

export const downloadJPG = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.download = `${filename}.jpg`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const shareInvoiceToWhatsApp = async (options: ShareOptions, invoice: Invoice, gstReportData?: any): Promise<boolean> => {
  const { format, phoneNumber, message, elementId = 'invoice-preview' } = options;

  try {
    if (format === 'text') {
      shareToWhatsApp(phoneNumber, message);
      return true;
    }

    if (format === 'pdf') {
      if (gstReportData) {
        generateGSTReportPDF(gstReportData);
      } else {
        await generateInvoicePDF(invoice, elementId);
      }
      const fileMessage = `${message}\\n\\n📎 PDF file has been downloaded. Please attach it to your WhatsApp message.`;
      shareToWhatsApp(phoneNumber, fileMessage);
      return true;
    }

    if (format === 'jpg') {
      const jpgData = await generateJPGFromElement(elementId);
      if (jpgData) {
        downloadJPG(jpgData, invoice.invoiceNumber);
        const fileMessage = `${message}\\n\\n📎 JPG file has been downloaded. Please attach it to your WhatsApp message.`;
        shareToWhatsApp(phoneNumber, fileMessage);
        return true;
      }
      return false;
    }

    return false;
  } catch (error) {
    console.error('Error sharing to WhatsApp:', error);
    return false;
  }
};

export const generateDefaultMessage = (invoice: Invoice): string => {
  const invoiceType = invoice.type === 'delivery' ? 'Delivery Challan' : 
                     invoice.type === 'sales' ? 'Sales Invoice' : 
                     invoice.type === 'purchase' ? 'Purchase Invoice' : 'Invoice';

  return `Hi ${invoice.customerName},

Your ${invoiceType} is ready!

Invoice #: ${invoice.invoiceNumber}
Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}
Amount: ₹${invoice.total.toLocaleString()}

${invoice.type !== 'delivery' && invoice.dueDate ? 
  `Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}` : ''}

Thank you for your business!`;
};

export const generateGSTReportMessage = (period: string, summary: any): string => {
  return `GST Report - ${period}

📊 Summary:
• Total Sales: ₹${summary.totalSales.toLocaleString()}
• Total Purchases: ₹${summary.totalPurchases.toLocaleString()}
• Output Tax: ₹${summary.outputTax.toLocaleString()}
• Input Tax: ₹${summary.inputTax.toLocaleString()}
• Net Tax Liability: ₹${Math.abs(summary.netTax).toLocaleString()}${summary.netTax < 0 ? ' (Refund)' : ''}

Generated on: ${new Date().toLocaleDateString('en-IN')}`;
};