import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Invoice, User } from '../types';

export const generateFirestoreInvoicePDF = async (
  invoice: Invoice,
  businessInfo: User,
  template: string = 'classic'
) => {
  // Find the invoice preview element
  const element = document.getElementById('invoice-preview');
  if (!element) {
    console.error('Invoice preview element not found');
    return;
  }

  try {
    // Fix currency symbols before generating PDF
    const currencyElements = element.querySelectorAll('*');
    const originalTexts: { element: Element; originalText: string }[] = [];
    
    currencyElements.forEach(el => {
      if (el.textContent && el.textContent.includes('₹')) {
        originalTexts.push({ element: el, originalText: el.textContent });
        el.textContent = el.textContent.replace(/₹/g, 'Rs ');
      }
    });

    // Convert the HTML element to canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      logging: false
    });
    
    // Restore original text
    originalTexts.forEach(({ element, originalText }) => {
      element.textContent = originalText;
    });

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate dimensions
    const imgWidth = pageWidth - 20; // 10mm margin on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Add image to PDF
    const imgData = canvas.toDataURL('image/png');
    
    if (imgHeight <= pageHeight - 20) {
      // Single page
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    } else {
      // Multiple pages
      let yPosition = 0;
      const pageContentHeight = pageHeight - 20;
      
      while (yPosition < imgHeight) {
        const remainingHeight = imgHeight - yPosition;
        const currentPageHeight = Math.min(pageContentHeight, remainingHeight);
        
        // Create a cropped canvas for this page
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d');
        
        croppedCanvas.width = canvas.width;
        croppedCanvas.height = (currentPageHeight * canvas.width) / imgWidth;
        
        croppedCtx?.drawImage(
          canvas,
          0, (yPosition * canvas.width) / imgWidth,
          canvas.width, croppedCanvas.height,
          0, 0,
          canvas.width, croppedCanvas.height
        );
        
        const croppedImgData = croppedCanvas.toDataURL('image/png');
        
        if (yPosition > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(croppedImgData, 'PNG', 10, 10, imgWidth, currentPageHeight);
        yPosition += currentPageHeight;
      }
    }

    // Save PDF
    const filename = `Invoice_${invoice.invoiceId || 'preview'}.pdf`;
    pdf.save(filename);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
};