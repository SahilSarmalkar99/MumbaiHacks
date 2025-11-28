import React from 'react';
import { FileText, TrendingUp, DollarSign, Package } from 'lucide-react';
import { useRealtimeInvoices } from '../../hooks/useRealtimeInvoices';
import { useAuth } from '../../context/AuthContext';

export const RealtimeInvoiceCounter: React.FC = () => {
  const { user } = useAuth();
  const { invoices, loading, error } = useRealtimeInvoices(user?.id);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-md animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
        <div className="flex items-center">
          <FileText className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700 text-sm">Error loading data</span>
        </div>
      </div>
    );
  }

  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter(inv => 
    inv.buyerInfo?.status === 'paid' || inv.status === 'paid'
  ).length;
  const pendingInvoices = invoices.filter(inv => 
    inv.buyerInfo?.status === 'sent' || inv.status === 'sent'
  ).length;
  const draftInvoices = invoices.filter(inv => 
    inv.buyerInfo?.status === 'draft' || inv.status === 'draft' || 
    (!inv.buyerInfo?.status && !inv.status)
  ).length;
  
  const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalItems = invoices.reduce((sum, inv) => 
    sum + (inv.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0), 0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-900">{totalInvoices}</p>
            <div className="flex items-center mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <p className="text-xs text-green-600">Live</p>
            </div>
          </div>
          <FileText className="w-8 h-8 text-blue-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Paid</p>
            <p className="text-2xl font-bold text-green-600">{paidInvoices}</p>
          </div>
          <TrendingUp className="w-8 h-8 text-green-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-orange-600">{pendingInvoices}</p>
          </div>
          <FileText className="w-8 h-8 text-orange-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Sales</p>
            <p className="text-2xl font-bold text-purple-600">₹{totalSales.toLocaleString()}</p>
          </div>
          <DollarSign className="w-8 h-8 text-purple-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Items</p>
            <p className="text-2xl font-bold text-indigo-600">{totalItems}</p>
          </div>
          <Package className="w-8 h-8 text-indigo-600" />
        </div>
      </div>
    </div>
  );
};