import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase/firebaseClient';
import type { Product, Invoice, InventoryLog, CheckoutRequest, CheckoutResponse, AddStockRequest } from '../types';

// Products collection
const PRODUCTS_COLLECTION = 'products';
const INVOICES_COLLECTION = 'invoices';
const INVENTORY_LOGS_COLLECTION = 'inventoryLogs';

export const firestoreService = {
  // ========== PRODUCTS ==========
  
  async getProduct(productId: string): Promise<Product | null> {
    const docRef = doc(firestore, PRODUCTS_COLLECTION, productId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { productId: docSnap.id, ...docSnap.data() } as Product;
    }
    return null;
  },

  async getAllProducts(businessId?: string): Promise<Product[]> {
    const productsRef = collection(firestore, PRODUCTS_COLLECTION);
    let q = query(productsRef, orderBy('name'));
    
    if (businessId) {
      q = query(productsRef, where('businessId', '==', businessId), orderBy('name'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      productId: doc.id,
      ...doc.data(),
    }) as Product);
  },

  async createProduct(product: Omit<Product, 'productId'>): Promise<string> {
    const docRef = doc(collection(firestore, PRODUCTS_COLLECTION));
    await setDoc(docRef, {
      ...product,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    const docRef = doc(firestore, PRODUCTS_COLLECTION, productId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteProduct(productId: string): Promise<void> {
    const docRef = doc(firestore, PRODUCTS_COLLECTION, productId);
    await deleteDoc(docRef);
  },

  // ========== INVENTORY STOCK MANAGEMENT ==========

  async addStock(request: AddStockRequest): Promise<void> {
    const { productId, delta, reason, userId } = request;
    
    return runTransaction(firestore, async (transaction) => {
      const productRef = doc(firestore, PRODUCTS_COLLECTION, productId);
      const productSnap = await transaction.get(productRef);
      
      if (!productSnap.exists()) {
        throw new Error(`Product ${productId} not found`);
      }
      
      const currentStock = productSnap.data().stock || 0;
      const newStock = currentStock + delta;
      
      if (newStock < 0 && !productSnap.data().metadata?.allowNegativeStock) {
        throw new Error(`Cannot set stock to negative. Current: ${currentStock}, Delta: ${delta}`);
      }
      
      // Update product stock
      transaction.update(productRef, {
        stock: newStock,
        updatedAt: serverTimestamp(),
      });
      
      // Log inventory change
      const logRef = doc(collection(firestore, INVENTORY_LOGS_COLLECTION));
      transaction.set(logRef, {
        productId,
        change: delta,
        previousStock: currentStock,
        newStock,
        reason,
        userId,
        timestamp: serverTimestamp(),
      });
    });
  },

  // ========== CHECKOUT / INVOICE CREATION ==========

  async checkout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const { sellerId, buyerInfo, items, paymentMethod, templateId = 'classic' } = request;
    
    try {
      return await runTransaction(firestore, async (transaction) => {
        const failedItems: CheckoutResponse['failedItems'] = [];
        const productUpdates: Array<{ ref: any; newStock: number; previousStock: number }> = [];
        
        // Step 1: Validate all products and check stock availability
        for (const item of items) {
          const productRef = doc(firestore, PRODUCTS_COLLECTION, item.productId);
          const productSnap = await transaction.get(productRef);
          
          if (!productSnap.exists()) {
            failedItems.push({
              productId: item.productId,
              requested: item.quantity,
              available: 0,
            });
            continue;
          }
          
          const product = productSnap.data() as Product;
          const currentStock = product.stock || 0;
          
          if (currentStock < item.quantity) {
            failedItems.push({
              productId: item.productId,
              requested: item.quantity,
              available: currentStock,
            });
            continue;
          }
          
          const newStock = currentStock - item.quantity;
          productUpdates.push({
            ref: productRef,
            newStock,
            previousStock: currentStock,
          });
        }
        
        // Step 2: If any items failed, abort transaction
        if (failedItems.length > 0) {
          throw new Error('Insufficient stock for one or more items');
        }
        
        // Step 3: Calculate invoice totals
        const invoiceItems = await Promise.all(
          items.map(async (item) => {
            const productSnap = await transaction.get(
              doc(firestore, PRODUCTS_COLLECTION, item.productId)
            );
            const product = productSnap.data() as Product;
            const unitPrice = product.price;
            const taxPercent = product.taxPercent || 0;
            const lineSubtotal = unitPrice * item.quantity;
            const taxAmount = (lineSubtotal * taxPercent) / 100;
            const lineTotal = lineSubtotal + taxAmount;
            
            return {
              productId: item.productId,
              name: product.name,
              sku: product.sku,
              unitPrice,
              quantity: item.quantity,
              lineTotal,
              taxPercent,
              taxAmount,
            };
          })
        );
        
        const subtotal = invoiceItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const totalTax = invoiceItems.reduce((sum, item) => sum + item.taxAmount, 0);
        const total = subtotal + totalTax;
        const currency = invoiceItems[0]?.unitPrice ? 'INR' : 'INR'; // Default to INR
        
        // Step 4: Deduct stock atomically
        for (const update of productUpdates) {
          transaction.update(update.ref, {
            stock: update.newStock,
            updatedAt: serverTimestamp(),
          });
          
          // Log inventory change
          const logRef = doc(collection(firestore, INVENTORY_LOGS_COLLECTION));
          transaction.set(logRef, {
            productId: update.ref.id,
            change: -(update.previousStock - update.newStock),
            previousStock: update.previousStock,
            newStock: update.newStock,
            reason: 'Sale checkout',
            userId: sellerId,
            timestamp: serverTimestamp(),
          });
        }
        
        // Step 5: Create invoice document
        const invoiceRef = doc(collection(firestore, INVOICES_COLLECTION));
        const invoiceId = invoiceRef.id;
        
        // Use the selected date from buyerInfo, fallback to current timestamp
        const invoiceDate = buyerInfo.date ? new Date(buyerInfo.date) : new Date();
        
        const invoice: Omit<Invoice, 'invoiceId'> = {
          createdAt: Timestamp.fromDate(invoiceDate),
          sellerId,
          buyerInfo,
          items: invoiceItems,
          subtotal,
          totalTax,
          total,
          currency,
          paymentMethod,
          templateId,
          meta: {
            createdBy: sellerId,
            deviceInfo: navigator.userAgent,
            saleType: 'point_of_sale',
          },
        };
        
        transaction.set(invoiceRef, invoice);
        
        return {
          invoiceId,
          status: 'success',
        };
      });
    } catch (error: any) {
      console.error('Checkout failed:', error);
      
      // Try to extract failed items from error or re-validate
      if (error.message?.includes('Insufficient stock')) {
        // Re-validate to get failed items
        const failedItems: CheckoutResponse['failedItems'] = [];
        for (const item of items) {
          try {
            const product = await this.getProduct(item.productId);
            if (!product || (product.stock || 0) < item.quantity) {
              failedItems.push({
                productId: item.productId,
                requested: item.quantity,
                available: product?.stock || 0,
              });
            }
          } catch {
            failedItems.push({
              productId: item.productId,
              requested: item.quantity,
              available: 0,
            });
          }
        }
        
        return {
          status: 'failed',
          reason: error.message || 'Insufficient stock',
          failedItems,
        };
      }
      
      return {
        status: 'failed',
        reason: error.message || 'Checkout failed',
      };
    }
  },

  // ========== INVOICES ==========

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const docRef = doc(firestore, INVOICES_COLLECTION, invoiceId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { invoiceId: docSnap.id, ...docSnap.data() } as Invoice;
    }
    return null;
  },

  async getInvoicesBySeller(sellerId: string, limitCount: number = 100): Promise<Invoice[]> {
    try {
      console.log('Fetching all invoices from database');
      const invoicesRef = collection(firestore, INVOICES_COLLECTION);
      
      // Get all invoices without sellerId filter
      const q = query(
        invoicesRef,
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      console.log('Found total invoices:', snapshot.docs.length);
      
      const invoices = snapshot.docs.map(doc => ({
        invoiceId: doc.id,
        ...doc.data(),
      })) as Invoice[];
      
      console.log('All invoices:', invoices);
      return invoices;
    } catch (error) {
      console.error('Error fetching all invoices:', error);
      throw error;
    }
  },

  // ========== INVENTORY LOGS ==========

  async getInventoryLogs(productId?: string, limitCount: number = 100): Promise<InventoryLog[]> {
    const logsRef = collection(firestore, INVENTORY_LOGS_COLLECTION);
    let q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    
    if (productId) {
      q = query(
        logsRef,
        where('productId', '==', productId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
    })) as InventoryLog[];
  },

  async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      console.log('Attempting to delete invoice from Firebase:', invoiceId);
      const docRef = doc(firestore, INVOICES_COLLECTION, invoiceId);
      
      // Check if document exists before deleting
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Invoice not found in database');
      }
      
      await deleteDoc(docRef);
      console.log('Invoice successfully deleted from Firebase:', invoiceId);
    } catch (error: any) {
      console.error('Error deleting invoice from Firebase:', error);
      throw new Error(`Failed to delete invoice: ${error.message}`);
    }
  },
};

