import React from 'react';
import { 
  TrendingUp, 
  Package, 
  FileText, 
  DollarSign,
  Printer,
  Download
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardStats } from '../../types';
import { generateReportPDF, exportToExcel } from '../../utils/pdfGenerator';
import { useRealtimeDashboard } from '../../hooks/useRealtimeDashboard';
import { useRealtimeInvoices } from '../../hooks/useRealtimeInvoices';
import { useAuth } from '../../context/AuthContext';
import { RealtimeInvoiceCounter } from './RealtimeInvoiceCounter';

interface DashboardProps {
  stats?: DashboardStats;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats: propStats }) => {
  const { user } = useAuth();
  const { stats: realtimeStats, invoiceCount, loading, error } = useRealtimeDashboard(user?.id);
  
  // Use real-time stats if available, otherwise fall back to prop stats
  const stats = realtimeStats || propStats || {
    totalSales: 0,
    totalPurchases: 0,
    totalItems: 0,
    pendingInvoices: 0,
    monthlyRevenue: [0, 0, 0, 0, 0, 0],
    recentTransactions: [],
  };
  const currentDate = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Use real-time invoice data for chart
  const { invoices } = useRealtimeInvoices(user?.id);
  
  // Removed development debug logging for invoices to reduce console noise in production.
  
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const monthRevenue = invoices
      .filter(invoice => {
        // Use buyerInfo.date first (the selected date), then fallback to createdAt
        let invoiceDate;
        
        if (invoice.buyerInfo?.date) {
          invoiceDate = new Date(invoice.buyerInfo.date);
        } else if (invoice.createdAt?.toDate) {
          invoiceDate = invoice.createdAt.toDate();
        } else if (invoice.createdAt?.seconds) {
          invoiceDate = new Date(invoice.createdAt.seconds * 1000);
        } else {
          invoiceDate = new Date();
        }
        
        return invoiceDate >= monthStart && invoiceDate <= monthEnd;
      })
      .reduce((sum, invoice) => sum + (invoice.total || 0), 0);
    
    return {
      month: monthNames[date.getMonth()],
      revenue: monthRevenue,
      fullMonth: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
  });

  const handleDownloadReport = (format: 'pdf' | 'csv') => {
    const reportData = {
      generatedOn: new Date().toISOString(),
      period: `${chartData[0].fullMonth} - ${chartData[5].fullMonth}`,
      stats,
      recentTransactions: stats.recentTransactions,
      summary: {
        totalRevenue: stats.totalSales,
        totalExpenses: stats.totalPurchases,
        netProfit: stats.totalSales - stats.totalPurchases,
        profitMargin: stats.totalSales > 0 ? ((stats.totalSales - stats.totalPurchases) / stats.totalSales * 100).toFixed(2) + '%' : '0%'
      }
    };

    if (format === 'pdf') {
      generateReportPDF([reportData], 'Dashboard Report');
    } else {
      // Export to CSV
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += `Dashboard Report - ${reportData.period}\n\n`;
      csvContent += "Summary\n";
      csvContent += `Total Revenue,₹${stats.totalSales.toLocaleString()}\n`;
      csvContent += `Total Expenses,₹${stats.totalPurchases.toLocaleString()}\n`;
      csvContent += `Net Profit,₹${(stats.totalSales - stats.totalPurchases).toLocaleString()}\n\n`;
      csvContent += "Monthly Revenue\n";
      csvContent += "Month,Revenue\n";
      chartData.forEach((data) => {
        csvContent += `${data.month},₹${data.revenue.toLocaleString()}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `dashboard-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const netProfit = stats.totalSales - stats.totalPurchases;
  const profitMargin = stats.totalSales > 0 ? ((netProfit / stats.totalSales) * 100).toFixed(1) : '0';

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 text-sm mt-1">
            Business overview for {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          {loading && (
            <div className="flex items-center mt-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-xs text-blue-600">Loading real-time data...</span>
            </div>
          )}
          {!loading && invoiceCount !== undefined && (
            <div className="flex items-center mt-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-xs text-green-600">Live tracking • {invoiceCount} invoices</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button
            onClick={() => handleDownloadReport('pdf')}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            <Download className="w-4 h-4" />
            PDF Report
          </button>
          <button
            onClick={() => handleDownloadReport('csv')}
            className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
          >
            <Download className="w-4 h-4" />
            CSV Export
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 text-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Real-time Dashboard */}
      <div className="printable">
        <RealtimeInvoiceCounter />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md printable">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900">Monthly Revenue Trend</h2>
          <div className="text-sm text-gray-600 mt-2 sm:mt-0">
            Last 6 months
          </div>
        </div>
        <div className="h-64 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                axisLine={{ stroke: '#e0e0e0' }}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value, name) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                labelFormatter={(label, payload) => {
                  const data = payload?.[0]?.payload;
                  return data?.fullMonth || label;
                }}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#9333ea" 
                strokeWidth={3}
                dot={{ fill: '#9333ea', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#9333ea', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Invoices */}
      {stats.recentTransactions.length > 0 && (
        <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md printable">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-4">Recent Invoices</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentTransactions.slice(0, 5).map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">{transaction.customerName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{transaction.total.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.status === 'paid' ? 'bg-green-100 text-green-800' :
                        transaction.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};