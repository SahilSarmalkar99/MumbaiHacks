import React, { useState, useEffect } from 'react';
import { Eye, Printer, Trash2, Search, Filter } from 'lucide-react';
import { Invoice, User, InvoiceTemplateType } from '../../types';
import { firestoreService } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import { MultiTemplateInvoice } from './MultiTemplateInvoice';
import { TemplateSelector } from './TemplateSelector';
import { generateFirestoreInvoicePDF } from '../../utils/firestoreInvoicePDF';

export const FirebaseInvoiceList: React.FC = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplateType>('classic');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'sent' | 'paid'>('all');

  useEffect(() => {
    loadInvoices();
  }, [user]);

  const loadInvoices = async () => {
    if (!user) {
      console.log('No user found');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Loading invoices for user:', user.id);
      const allInvoices = await firestoreService.getInvoicesBySeller(user.id);
      console.log('Loaded invoices:', allInvoices);
      setInvoices(allInvoices);
    } catch (error) {
      console.error('Failed to load invoices:', error);
      alert(`Failed to load invoices: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) {
      return;
    }
    
    try {
      console.log('Deleting invoice:', invoiceId);
      await firestoreService.deleteInvoice(invoiceId);
      console.log('Invoice deleted successfully from Firebase');
      
      // Update local state
      setInvoices(prev => prev.filter(inv => inv.invoiceId !== invoiceId));
      alert('Invoice deleted successfully!');
    } catch (error: any) {
      console.error('Failed to delete invoice:', error);
      alert(`Failed to delete invoice: ${error.message || 'Unknown error'}`);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.buyerInfo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.buyerInfo.contact.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || invoice.buyerInfo.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  if (selectedInvoice && user) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[70] overflow-auto">
        <div className="sticky top-0 z-[80] bg-white shadow-md p-3 sm:p-4 border-b no-print">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              ← Back to List
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  try {
                    await generateFirestoreInvoicePDF(selectedInvoice, user, selectedTemplate);
                  } catch (error) {
                    console.error('PDF generation failed:', error);
                    alert('Failed to generate PDF. Please try again.');
                  }
                }}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Printer className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-3 sm:p-6">
          <div className="no-print mb-6">
            <TemplateSelector 
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
            />
          </div>
          
          <div className="w-full overflow-x-auto">
            <div id="invoice-preview" className="printable min-w-0" style={{
              fontFamily: 'Arial, sans-serif',
              width: '210mm',
              minHeight: '297mm',
              padding: '15mm',
              fontSize: '12px',
              lineHeight: '1.4',
              color: '#000000',
              backgroundColor: 'white'
            }}>
              <MultiTemplateInvoice 
                invoice={selectedInvoice} 
                businessInfo={user} 
                template={selectedTemplate}
              />

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">All Invoices</h1>
        <button
          onClick={loadInvoices}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by buyer name or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          
          <div className="flex items-center text-sm text-gray-600">
            <Filter className="w-4 h-4 mr-2" />
            {filteredInvoices.length} of {invoices.length} invoices
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice ID
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Buyer
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.invoiceId} className="hover:bg-gray-50">
                  <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoiceId.slice(-8)}
                  </td>
                  <td className="px-3 lg:px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{invoice.buyerInfo.name}</div>
                      <div className="text-sm text-gray-500">{invoice.buyerInfo.contact}</div>
                    </div>
                  </td>
                  <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {invoice.buyerInfo.date ? new Date(invoice.buyerInfo.date).toLocaleDateString() : 
                     invoice.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                  </td>
                  <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.currency} {invoice.total.toFixed(2)}
                  </td>
                  <td className="px-3 lg:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(invoice.buyerInfo.status || 'draft')}`}>
                      {invoice.buyerInfo.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!user) return;
                          try {
                            // First open the preview to ensure the element exists
                            setSelectedInvoice(invoice);
                            // Wait a moment for the element to render
                            setTimeout(async () => {
                              try {
                                await generateFirestoreInvoicePDF(invoice, user, 'classic');
                                setSelectedInvoice(null); // Close preview after PDF generation
                              } catch (error) {
                                console.error('PDF generation failed:', error);
                                alert('Failed to generate PDF. Please try again.');
                                setSelectedInvoice(null);
                              }
                            }, 500);
                          } catch (error) {
                            console.error('PDF generation failed:', error);
                            alert('Failed to generate PDF. Please try again.');
                          }
                        }}
                        className="text-green-600 hover:text-green-900 p-1"
                        title="Download PDF"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice.invoiceId)}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredInvoices.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No invoices found.</p>
          </div>
        )}
      </div>
    </div>
  );
};