import React, { useState } from 'react';
import { Calculator, Download, FileText, Edit3, Save, X, Plus, MessageCircle } from 'lucide-react';
import { Invoice } from '../../types';
import { generateReportPDF, exportToExcel } from '../../utils/pdfGenerator';
import { WhatsAppShare } from './WhatsAppShare';
import { generateGSTReportMessage } from '../../utils/whatsappShare';
import { generateGSTReportPDF } from '../../utils/pdfGenerator';

interface EditableGSTFilingProps {
  invoices: Invoice[];
  onUpdateInvoice?: (id: string, updatedInvoice: Partial<Invoice>) => void;
}

interface GSTEntry {
  id: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  type: 'sales' | 'purchase';
  isEditable?: boolean;
}

export const EditableGSTFiling: React.FC<EditableGSTFilingProps> = ({ invoices, onUpdateInvoice }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [gstEntries, setGstEntries] = useState<GSTEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<GSTEntry>>({
    type: 'sales',
    date: new Date().toISOString().split('T')[0]
  });

  React.useEffect(() => {
    const filteredInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.date);
      const invoiceYear = invoiceDate.getFullYear().toString();
      const invoiceMonth = (invoiceDate.getMonth() + 1).toString().padStart(2, '0');
      
      return invoiceYear === selectedYear && 
             (selectedPeriod === '' || invoiceMonth === selectedPeriod);
    });

    const entries: GSTEntry[] = filteredInvoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      date: invoice.date,
      taxableAmount: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.total,
      type: invoice.type as 'sales' | 'purchase'
    }));

    setGstEntries(entries);
  }, [invoices, selectedPeriod, selectedYear]);

  const calculateGSTSummary = () => {
    const salesEntries = gstEntries.filter(entry => entry.type === 'sales');
    const purchaseEntries = gstEntries.filter(entry => entry.type === 'purchase');

    const totalSales = salesEntries.reduce((sum, entry) => sum + entry.taxableAmount, 0);
    const totalPurchases = purchaseEntries.reduce((sum, entry) => sum + entry.taxableAmount, 0);
    const outputTax = salesEntries.reduce((sum, entry) => sum + entry.taxAmount, 0);
    const inputTax = purchaseEntries.reduce((sum, entry) => sum + entry.taxAmount, 0);
    const netTax = outputTax - inputTax;

    return {
      totalSales,
      totalPurchases,
      outputTax,
      inputTax,
      netTax,
      salesEntries,
      purchaseEntries
    };
  };

  const gstSummary = calculateGSTSummary();

  const handleEditEntry = (entryId: string) => {
    setEditingEntry(entryId);
  };

  const handleSaveEntry = (entryId: string, updatedData: Partial<GSTEntry>) => {
    setGstEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        const updated = { ...entry, ...updatedData };
        // Recalculate total if amounts changed
        if (updatedData.taxableAmount !== undefined || updatedData.taxAmount !== undefined) {
          updated.totalAmount = (updated.taxableAmount || 0) + (updated.taxAmount || 0);
        }
        
        // Update original invoice if it exists
        if (onUpdateInvoice && !entryId.startsWith('custom-')) {
          onUpdateInvoice(entryId, {
            subtotal: updated.taxableAmount,
            taxAmount: updated.taxAmount,
            total: updated.totalAmount,
            customerName: updated.customerName,
            invoiceNumber: updated.invoiceNumber,
            date: updated.date
          });
        }
        
        return updated;
      }
      return entry;
    }));
  };

  const handleAddEntry = () => {
    if (!newEntry.invoiceNumber || !newEntry.customerName || !newEntry.taxableAmount) {
      alert('Please fill all required fields');
      return;
    }

    const entry: GSTEntry = {
      id: `custom-${Date.now()}`,
      invoiceNumber: newEntry.invoiceNumber!,
      customerName: newEntry.customerName!,
      date: newEntry.date!,
      taxableAmount: newEntry.taxableAmount!,
      taxAmount: newEntry.taxAmount || 0,
      totalAmount: (newEntry.taxableAmount || 0) + (newEntry.taxAmount || 0),
      type: newEntry.type as 'sales' | 'purchase',
      isEditable: true
    };

    setGstEntries(prev => [...prev, entry]);
    setNewEntry({ type: 'sales', date: new Date().toISOString().split('T')[0] });
    setShowAddForm(false);
  };

  const handleDeleteEntry = (entryId: string) => {
    setGstEntries(prev => prev.filter(entry => entry.id !== entryId));
  };

  const handleDownloadGSTReport = (format: 'pdf' | 'excel') => {
    const reportData = {
      period: selectedPeriod ? `${selectedYear}-${selectedPeriod}` : selectedYear,
      summary: gstSummary,
      entries: gstEntries,
      generatedOn: new Date().toISOString()
    };

    if (format === 'pdf') {
      generateGSTReportPDF(reportData);
    } else {
      exportToExcel(reportData);
    }
  };

  const createDummyInvoiceForSharing = (): Invoice => ({
    id: 'gst-report',
    invoiceNumber: `GST-${selectedPeriod ? `${selectedYear}-${selectedPeriod}` : selectedYear}`,
    type: 'sales',
    customerName: 'GST Filing Report',
    customerEmail: '',
    customerPhone: '',
    items: [],
    subtotal: gstSummary.totalSales,
    taxAmount: gstSummary.outputTax,
    total: gstSummary.totalSales + gstSummary.outputTax,
    date: new Date().toISOString(),
    status: 'sent'
  });

  const handleGSTReportShare = async (phoneNumber: string, message: string, format: 'text' | 'pdf' | 'jpg' = 'text') => {
    const period = selectedPeriod ? `${selectedYear}-${selectedPeriod}` : selectedYear;
    const reportData = {
      period,
      summary: gstSummary,
      entries: gstEntries,
      generatedOn: new Date().toISOString()
    };
    
    if (format === 'pdf') {
      generateGSTReportPDF(reportData);
    }
    
    const gstMessage = generateGSTReportMessage(period, gstSummary);
    console.log('GST Report shared to:', phoneNumber, 'Message:', gstMessage);
  };

  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const EditableCell: React.FC<{
    value: string | number;
    onSave: (value: string | number) => void;
    type?: 'text' | 'number' | 'date';
    isEditing: boolean;
  }> = ({ value, onSave, type = 'text', isEditing }) => {
    const [editValue, setEditValue] = useState(value);

    React.useEffect(() => {
      setEditValue(value);
    }, [value, isEditing]);

    if (!isEditing) {
      return <span>{type === 'number' ? `₹${Number(value).toLocaleString()}` : value}</span>;
    }

    const handleSave = () => {
      onSave(editValue);
    };

    return (
      <input
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(type === 'number' ? Number(e.target.value) : e.target.value)}
        onBlur={handleSave}
        onKeyPress={(e) => e.key === 'Enter' && handleSave()}
        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        autoFocus
      />
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Editable GST Filing</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleDownloadGSTReport('pdf')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            PDF Report
          </button>
          <button
            onClick={() => handleDownloadGSTReport('excel')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Excel Report
          </button>
          <WhatsAppShare 
            invoice={createDummyInvoiceForSharing()} 
            onShare={handleGSTReportShare}
            elementId="gst-summary-report"
          />
        </div>
      </div>

      {/* Period Selection */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Select Period</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month (Optional)</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Months</option>
              {months.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>
        </div>
      </div>

      {/* GST Summary */}
      <div id="gst-summary-report" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-green-600">₹{gstSummary.totalSales.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Purchases</p>
              <p className="text-2xl font-bold text-blue-600">₹{gstSummary.totalPurchases.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Tax Liability</p>
              <p className={`text-2xl font-bold ${gstSummary.netTax >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{Math.abs(gstSummary.netTax).toLocaleString()}
                {gstSummary.netTax < 0 && ' (Refund)'}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Calculator className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Add New Entry Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Add New GST Entry</h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newEntry.type}
                onChange={(e) => setNewEntry(prev => ({ ...prev, type: e.target.value as 'sales' | 'purchase' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="sales">Sales</option>
                <option value="purchase">Purchase</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
              <input
                type="text"
                value={newEntry.invoiceNumber || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="INV-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={newEntry.customerName || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, customerName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Customer Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={newEntry.date || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taxable Amount</label>
              <input
                type="number"
                value={newEntry.taxableAmount || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, taxableAmount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label>
              <input
                type="number"
                value={newEntry.taxAmount || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, taxAmount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="0"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleAddEntry}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Save className="w-4 h-4" />
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editable GST Entries Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">GST Entries ({gstEntries.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxable Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {gstEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                      entry.type === 'sales' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingEntry === entry.id ? (
                      <input
                        type="text"
                        value={entry.invoiceNumber}
                        onChange={(e) => handleSaveEntry(entry.id, { invoiceNumber: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      <span>{entry.invoiceNumber}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingEntry === entry.id ? (
                      <input
                        type="text"
                        value={entry.customerName}
                        onChange={(e) => handleSaveEntry(entry.id, { customerName: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      <span>{entry.customerName}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingEntry === entry.id ? (
                      <input
                        type="date"
                        value={entry.date.split('T')[0]}
                        onChange={(e) => handleSaveEntry(entry.id, { date: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      <span>{new Date(entry.date).toLocaleDateString('en-IN')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingEntry === entry.id ? (
                      <input
                        type="number"
                        value={entry.taxableAmount}
                        onChange={(e) => handleSaveEntry(entry.id, { taxableAmount: Number(e.target.value) })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      <span>₹{entry.taxableAmount.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingEntry === entry.id ? (
                      <input
                        type="number"
                        value={entry.taxAmount}
                        onChange={(e) => handleSaveEntry(entry.id, { taxAmount: Number(e.target.value) })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      <span>₹{entry.taxAmount.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ₹{entry.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      {editingEntry === entry.id ? (
                        <button
                          onClick={() => setEditingEntry(null)}
                          className="text-green-600 hover:text-green-900"
                          title="Save"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingEntry(entry.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {entry.isEditable && (
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {gstEntries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No GST entries found for the selected period.</p>
          </div>
        )}
      </div>

      {/* Detailed GST Calculation */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">GST Calculation Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Output Tax (Sales)</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Taxable Sales:</span>
                <span className="font-medium">₹{gstSummary.totalSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Output Tax:</span>
                <span className="font-medium">₹{gstSummary.outputTax.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Input Tax (Purchases)</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Taxable Purchases:</span>
                <span className="font-medium">₹{gstSummary.totalPurchases.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Input Tax:</span>
                <span className="font-medium">₹{gstSummary.inputTax.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Net Tax Liability:</span>
            <span className={`text-xl font-bold ${gstSummary.netTax >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{Math.abs(gstSummary.netTax).toLocaleString()}
              {gstSummary.netTax < 0 && ' (Refund Due)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};