export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  contactNumber: string;
  address?: string;
  gstNumber?: string;
  signature?: string;
  paymentQRCode?: string;
}



// New Product interface matching Firestore schema
export interface Product {
  productId: string; // Document ID in Firestore
  name: string;
  sku?: string;
  price: number; // Unit price
  currency: string; // e.g., "INR"
  stock: number;
  taxPercent?: number;
  unit?: string; // e.g., "kg", "pcs", "liters"
  imageUrl?: string;
  metadata?: Record<string, any>;
  deleted?: boolean;
  createdAt?: any;
  updatedAt?: any;
  deletedAt?: any;
}

// Cart item for sale flow
export interface CartItem {
  productId: string;
  name: string;
  sku?: string;
  unitPrice: number;
  quantity: number;
  taxPercent?: number;
  lineTotal: number;
  taxAmount: number;
}

// Buyer information
export interface BuyerInfo {
  name: string;
  contact: string;
  address?: string;
  date?: string;
  status?: 'draft' | 'sent' | 'paid';
}

// Invoice item matching Firestore schema
export interface InvoiceItem {
  productId: string;
  name: string;
  sku?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  taxPercent?: number;
  taxAmount: number;
}

// Invoice interface matching Firestore schema
export interface Invoice {
  invoiceId: string;
  createdAt: any; // Firestore Timestamp
  sellerId: string;
  buyerInfo: BuyerInfo;
  items: InvoiceItem[];
  subtotal: number;
  totalTax: number;
  total: number;
  currency: string;
  paymentMethod: string;
  templateId: string;
  meta?: {
    createdBy?: string;
    deviceInfo?: string;
    saleType?: string;
  };
  // Legacy fields for backward compatibility
  id?: string;
  invoiceNumber?: string;
  type?: 'sales' | 'purchase' | 'delivery';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  taxAmount?: number;
  date?: string;
  dueDate?: string;
  status?: 'draft' | 'sent' | 'paid' | 'overdue';
}

// Inventory log entry
export interface InventoryLog {
  productId: string;
  change: number; // Positive for addition, negative for deduction
  previousStock: number;
  newStock: number;
  reason: string;
  userId: string;
  timestamp: any; // Firestore Timestamp
}

// Checkout request
export interface CheckoutRequest {
  sellerId: string;
  buyerInfo: BuyerInfo;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: string;
  templateId?: string;
}

// Checkout response
export interface CheckoutResponse {
  invoiceId?: string;
  status: 'success' | 'failed';
  reason?: string;
  failedItems?: Array<{
    productId: string;
    requested: number;
    available: number;
  }>;
}

// Add stock request
export interface AddStockRequest {
  productId: string;
  delta: number;
  reason: string;
  userId: string;
}

export interface DashboardStats {
  totalSales: number;
  totalPurchases: number;
  totalItems: number;
  pendingInvoices: number;
  monthlyRevenue: number[];
  recentTransactions: any[];
}

// Invoice template types
export type InvoiceTemplateType = 'classic' | 'modern' | 'minimal' | 'professional' | 'colorful' | 'elegant' | 'bold' | 'simple';