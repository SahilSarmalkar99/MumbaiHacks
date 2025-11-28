import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { firestore } from '../firebase/firebaseClient';
import { Invoice } from '../types';

export const useRealtimeInvoices = (sellerId?: string) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const invoicesRef = collection(firestore, 'invoices');
    const q = query(
      invoicesRef,
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const invoiceData = snapshot.docs.map(doc => ({
            invoiceId: doc.id,
            ...doc.data(),
          })) as Invoice[];
          
          setInvoices(invoiceData);
          setError(null);
        } catch (err) {
          console.error('Error processing invoice data:', err);
          setError('Failed to process invoice data');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to invoices:', err);
        setError('Failed to listen to invoice updates');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sellerId]);

  return { invoices, loading, error };
};