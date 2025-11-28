import { useState, useEffect, useMemo } from 'react';
import { useRealtimeInvoices } from './useRealtimeInvoices';
import { DashboardStats, Invoice } from '../types';

export const useRealtimeDashboard = (sellerId?: string) => {
  const { invoices, loading, error } = useRealtimeInvoices(sellerId);

  const stats: DashboardStats = useMemo(() => {
    if (!invoices.length) {
      return {
        totalSales: 0,
        totalPurchases: 0,
        totalItems: 0,
        pendingInvoices: 0,
        monthlyRevenue: [0, 0, 0, 0, 0, 0],
        recentTransactions: [],
      };
    }

    // Calculate total sales
    const totalSales = invoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);

    // Count pending invoices
    const pendingInvoices = invoices.filter(
      invoice => invoice.buyerInfo?.status === 'sent' || invoice.status === 'sent'
    ).length;

    // Calculate monthly revenue for last 6 months
    const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      return invoices
        .filter(invoice => {
          // Use buyerInfo.date first (the selected date)
          const invoiceDate = invoice.buyerInfo?.date ? 
            new Date(invoice.buyerInfo.date) : 
            (invoice.createdAt?.toDate?.() || new Date());
          return invoiceDate >= monthStart && invoiceDate <= monthEnd;
        })
        .reduce((sum, invoice) => sum + (invoice.total || 0), 0);
    });

    // Get recent transactions (last 5)
    const recentTransactions = invoices
      .slice(0, 5)
      .map(invoice => ({
        id: invoice.invoiceId,
        invoiceNumber: invoice.invoiceId.slice(-8),
        customerName: invoice.buyerInfo?.name || 'Unknown',
        type: 'sales',
        total: invoice.total || 0,
        status: invoice.buyerInfo?.status || invoice.status || 'draft',
        date: invoice.buyerInfo?.date || invoice.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      }));

    // Count total items from all invoices
    const totalItems = invoices.reduce((sum, invoice) => {
      return sum + (invoice.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
    }, 0);

    return {
      totalSales,
      totalPurchases: 0, // Not tracking purchases in this implementation
      totalItems,
      pendingInvoices,
      monthlyRevenue,
      recentTransactions,
    };
  }, [invoices]);

  return {
    stats,
    invoiceCount: invoices.length,
    loading,
    error,
  };
};