import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Invoice } from '../types';

export const generateInvoicePDF = async (invoice: Invoice, elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found:', elementId);
    return;
  }

  try {
    // Wait for any images to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get full height including all content
    const fullHeight = Math.max(
      element.scrollHeight,
      element.offsetHeight,
      element.clientHeight
    );
    
    // Configure html2canvas for better quality and table handling
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: fullHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1200,
      windowHeight: fullHeight,
      onclone: (clonedDoc) => {
        // Ensure all styles are applied to cloned document
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          clonedElement.style.width = '210mm';
          clonedElement.style.padding = '20px';
          clonedElement.style.fontFamily = 'Arial, sans-serif';
          clonedElement.style.minHeight = '297mm';
          clonedElement.style.overflow = 'visible';
          
          // Fix table styles
          const tables = clonedElement.querySelectorAll('table');
          tables.forEach(table => {
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.fontSize = '12px';
            table.style.pageBreakInside = 'avoid';
          });
          
          const cells = clonedElement.querySelectorAll('td, th');
          cells.forEach(cell => {
            cell.style.padding = '8px';
            cell.style.border = '1px solid #000';
            cell.style.wordWrap = 'break-word';
            cell.style.verticalAlign = 'top';
          });
          
          // Ensure signatures and terms are visible
          const signatures = clonedElement.querySelectorAll('.grid-cols-2');
          signatures.forEach(sig => {
            sig.style.pageBreakInside = 'avoid';
            sig.style.marginTop = '20px';
          });
        }
      }
    });
    
    const imgData = canvas.toDataURL('image/png', 1.0);
    
    // A4 size in mm
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    
    // Calculate image dimensions to fit A4 with margins
    const availableWidth = pdfWidth - (2 * margin);
    const imgWidth = availableWidth;
    const imgHeight = (canvas.height * availableWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = margin;
    
    // Add first page
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 2 * margin);
    
    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 2 * margin);
    }
    
    // Save with proper filename
    const filename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    pdf.save(filename);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
  }
};

export const generateGSTReportPDF = (reportData: any) => {
  const { period, summary, entries } = reportData;
  
  const pdf = new jsPDF();
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('GST Filing Report', 20, 20);
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Period: ${period}`, 20, 35);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);
  
  // Summary Table
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary', 20, 65);
  
  let y = 80;
  // Summary table with borders
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.rect(20, y - 5, 170, 10);
  pdf.text('Description', 25, y);
  pdf.text('Amount', 160, y);
  
  y += 10;
  pdf.setFont('helvetica', 'normal');
  
  // Summary rows with borders
  const summaryData = [
    ['Total Sales', `Rs.${summary.totalSales.toLocaleString()}`],
    ['Total Purchases', `Rs.${summary.totalPurchases.toLocaleString()}`],
    ['Output Tax', `Rs.${summary.outputTax.toLocaleString()}`],
    ['Input Tax', `Rs.${summary.inputTax.toLocaleString()}`],
    ['Net Tax Liability', `Rs.${Math.abs(summary.netTax).toLocaleString()}${summary.netTax < 0 ? ' (Refund)' : ''}`]
  ];
  
  summaryData.forEach((row, index) => {
    pdf.rect(20, y - 5, 170, 10);
    pdf.text(row[0], 25, y);
    pdf.text(row[1], 160, y);
    y += 10;
  });
  
  y += 20;
  
  // Entries Table with proper borders
  if (entries && entries.length > 0) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('GST Entries', 20, y);
    y += 15;
    
    // Table header with borders
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.rect(20, y - 5, 30, 10);
    pdf.rect(50, y - 5, 40, 10);
    pdf.rect(90, y - 5, 40, 10);
    pdf.rect(130, y - 5, 30, 10);
    pdf.rect(160, y - 5, 30, 10);
    
    pdf.text('Type', 25, y);
    pdf.text('Invoice #', 55, y);
    pdf.text('Customer', 95, y);
    pdf.text('Taxable', 135, y);
    pdf.text('Tax', 165, y);
    y += 10;
    
    pdf.setFont('helvetica', 'normal');
    entries.forEach((entry: any) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      
      // Table rows with borders
      pdf.rect(20, y - 5, 30, 10);
      pdf.rect(50, y - 5, 40, 10);
      pdf.rect(90, y - 5, 40, 10);
      pdf.rect(130, y - 5, 30, 10);
      pdf.rect(160, y - 5, 30, 10);
      
      pdf.text(entry.type, 25, y);
      pdf.text(entry.invoiceNumber.substring(0, 12), 55, y);
      pdf.text(entry.customerName.substring(0, 12), 95, y);
      pdf.text(`Rs.${entry.taxableAmount.toLocaleString()}`, 135, y);
      pdf.text(`Rs.${entry.taxAmount.toLocaleString()}`, 165, y);
      y += 10;
    });
  }
  
  pdf.save(`GST-Report-${period}.pdf`);
};

export const generateReportPDF = (data: any[], title: string) => {
  if (title === 'GST Filing Report' && data[0]) {
    generateGSTReportPDF(data[0]);
    return;
  }
  
  const pdf = new jsPDF();
  pdf.setFontSize(20);
  pdf.text(title, 20, 20);
  
  let yPosition = 40;
  data.forEach((item, index) => {
    if (yPosition > 270) {
      pdf.addPage();
      yPosition = 20;
    }
    pdf.setFontSize(12);
    pdf.text(`${index + 1}. ${JSON.stringify(item)}`, 20, yPosition);
    yPosition += 10;
  });
  
  pdf.save(`${title.toLowerCase().replace(/\s+/g, '-')}-report.pdf`);
};

export const exportToExcel = (reportData: any) => {
  const { period, summary, entries } = reportData;
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += `GST Report - ${period}\n\n`;
  csvContent += "Summary\n";
  csvContent += `Total Sales,₹${summary.totalSales.toLocaleString()}\n`;
  csvContent += `Total Purchases,₹${summary.totalPurchases.toLocaleString()}\n`;
  csvContent += `Output Tax,₹${summary.outputTax.toLocaleString()}\n`;
  csvContent += `Input Tax,₹${summary.inputTax.toLocaleString()}\n`;
  csvContent += `Net Tax Liability,₹${Math.abs(summary.netTax).toLocaleString()}${summary.netTax < 0 ? ' (Refund)' : ''}\n\n`;
  
  if (entries && entries.length > 0) {
    csvContent += "Invoice Details\n";
    csvContent += "Type,Invoice Number,Customer Name,Date,Taxable Amount,Tax Amount,Total Amount\n";
    
    entries.forEach((entry: any) => {
      csvContent += `${entry.type},${entry.invoiceNumber},${entry.customerName},${new Date(entry.date).toLocaleDateString()},₹${entry.taxableAmount.toLocaleString()},₹${entry.taxAmount.toLocaleString()},₹${entry.totalAmount.toLocaleString()}\n`;
    });
  }
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `GST-Report-${period}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};