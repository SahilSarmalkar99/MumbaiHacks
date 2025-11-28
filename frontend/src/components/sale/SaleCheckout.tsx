import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, X, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { Product, CartItem, BuyerInfo, CheckoutResponse, Invoice, InvoiceTemplateType } from '../../types';
import { firestoreService } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { generateFirestoreInvoicePDF } from '../../utils/firestoreInvoicePDF';
import { MultiTemplateInvoice } from '../invoices/MultiTemplateInvoice';
import { agentService } from '../../services/agentService';

export const SaleCheckout: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    name: '',
    contact: '',
    address: '',
    date: new Date().toISOString().split('T')[0],
    status: 'draft',
  });

  const [paymentMethod, setPaymentMethod] = useState('cash');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const allProducts = await firestoreService.getAllProducts();
      setProducts(allProducts);
    } catch (error) {
      console.error('Failed to load products:', error);
      alert('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const existing = cart.get(product.productId);
    const currentStock = product.stock || 0;
    
    if (existing) {
      const newQuantity = existing.quantity + 1;
      if (newQuantity > currentStock) {
        alert(`Only ${currentStock} units available in stock`);
        return;
      }
      updateCartItem(product, newQuantity);
    } else {
      if (currentStock < 1) {
        alert('Product out of stock');
        return;
      }
      const taxPercent = product.taxPercent || 0;
      const lineSubtotal = product.price;
      const taxAmount = (lineSubtotal * taxPercent) / 100;
      const lineTotal = lineSubtotal + taxAmount;

      const newCartItem: CartItem = {
        productId: product.productId,
        name: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: 1,
        taxPercent,
        lineTotal,
        taxAmount,
      };

      setCart(new Map(cart).set(product.productId, newCartItem));
    }
  };

  const updateCartItem = (product: Product, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(product.productId);
      return;
    }

    const currentStock = product.stock || 0;
    if (quantity > currentStock) {
      alert(`Only ${currentStock} units available in stock`);
      return;
    }

    const existing = cart.get(product.productId);
    if (!existing) return;

    const taxPercent = product.taxPercent || 0;
    const lineSubtotal = product.price * quantity;
    const taxAmount = (lineSubtotal * taxPercent) / 100;
    const lineTotal = lineSubtotal + taxAmount;

    const updated: CartItem = {
      ...existing,
      quantity,
      lineTotal,
      taxAmount,
    };

    setCart(new Map(cart).set(product.productId, updated));
  };

  const removeFromCart = (productId: string) => {
    const newCart = new Map(cart);
    newCart.delete(productId);
    setCart(newCart);
  };

  const getCartTotals = () => {
    const subtotal = Array.from(cart.values()).reduce(
      (sum, item) => sum + (item.unitPrice * item.quantity),
      0
    );
    const totalTax = Array.from(cart.values()).reduce(
      (sum, item) => sum + item.taxAmount,
      0
    );
    const total = subtotal + totalTax;
    return { subtotal, totalTax, total };
  };

  const handleCheckout = async () => {
    if (!user) {
      alert('Please login to continue');
      return;
    }

    if (cart.size === 0) {
      alert('Cart is empty');
      return;
    }

    if (!buyerInfo.name || !buyerInfo.contact) {
      alert('Please fill buyer name and contact');
      return;
    }

    setCheckingOut(true);
    setCheckoutError(null);

    try {
      const cartItems = Array.from(cart.values());

      const response: CheckoutResponse = await firestoreService.checkout({
        sellerId: user.id,
        buyerInfo,
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        paymentMethod,
        templateId: 'classic',
      });

      if (response.status === 'success' && response.invoiceId) {
        try {
          // Fetch the created invoice
          const invoice = await firestoreService.getInvoice(response.invoiceId);
          
          if (invoice) {
            // Validate invoice data structure
            const validatedInvoice = {
              ...invoice,
              subtotal: invoice.subtotal || 0,
              totalTax: invoice.totalTax || invoice.taxAmount || 0,
              total: invoice.total || 0,
              currency: invoice.currency || 'INR',
              items: (invoice.items || []).map(item => ({
                ...item,
                unitPrice: item.unitPrice || 0,
                quantity: item.quantity || 0,
                lineTotal: item.lineTotal || 0,
                taxPercent: item.taxPercent || 0,
                name: item.name || 'Unknown Item'
              })),
              buyerInfo: {
                ...invoice.buyerInfo,
                name: invoice.buyerInfo?.name || 'Unknown Customer',
                contact: invoice.buyerInfo?.contact || 'N/A',
                status: invoice.buyerInfo?.status || 'draft'
              }
            };
            
            setCreatedInvoice(validatedInvoice);
            setShowSuccessModal(true);
            setShowConfirmModal(false);
            
            // Trigger agent workflow to send WhatsApp invoice
            // This is non-blocking to improve UX, but we log errors
            // 🚀 Trigger agent only when: status = pending AND payment = upi
if (buyerInfo.status === "pending" && paymentMethod === "upi") {
  console.log("✅ Triggering WhatsApp agent...");

  agentService.triggerInvoiceAgent(
    response.invoiceId,
    validatedInvoice.total,
    buyerInfo.contact
  ).then(agentResponse => {
    console.log('Agent workflow completed:', agentResponse);

    if (agentResponse.razorpay_payment_url) {
      console.log('Payment link received:', agentResponse.razorpay_payment_url);
    }
  }).catch(agentError => {
    console.error('Agent workflow failed (non-blocking):', agentError);
  });

} else {
  console.log("⚠️ Agent NOT triggered — status or payment method does not match.", {
    status: buyerInfo.status,
    paymentMethod
  });
}

            
            // Clear cart and reset form
            setCart(new Map());
            setBuyerInfo({ 
              name: '', 
              contact: '', 
              address: '', 
              date: new Date().toISOString().split('T')[0],
              status: 'draft'
            });
          } else {
            throw new Error('Failed to fetch created invoice');
          }
        } catch (fetchError) {
          console.error('Error fetching invoice:', fetchError);
          setCheckoutError('Invoice created but failed to load. Please check invoices list.');
        }
      } else {
        const errorMessage = response.reason || 'Checkout failed. Please check stock availability.';
        setCheckoutError(errorMessage);
        
        if (response.failedItems && response.failedItems.length > 0) {
          const failedDetails = response.failedItems
            .map(item => `${item.productId}: requested ${item.requested}, available ${item.available}`)
            .join('\n');
          setCheckoutError(`${errorMessage}\n\nStock issues:\n${failedDetails}`);
        }
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      setCheckoutError(error.message || 'Checkout failed. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cartItems = Array.from(cart.values());
  const { subtotal, totalTax, total } = getCartTotals();

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8" />
          Point of Sale
        </h1>
        {cartItems.length > 0 && (
          <div className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg">
            <ShoppingCart className="w-5 h-5" />
            <span className="font-semibold">{cartItems.length} item(s)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-4">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
            {filteredProducts.map((product) => {
              const cartItem = cart.get(product.productId);
              const inStock = (product.stock || 0) > 0;
              const canAdd = inStock && (!cartItem || cartItem.quantity < product.stock);

              return (
                <div
                  key={product.productId}
                  className={`border rounded-lg p-4 ${
                    !inStock ? 'opacity-50 bg-gray-100' : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{product.name}</h3>
                      {product.sku && (
                        <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                      )}
                    </div>
                    {cartItem && (
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-sm font-semibold">
                        {cartItem.quantity}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-indigo-600">
                        {product.currency} {product.price.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Stock: {product.stock} {product.unit || 'pcs'}
                      </p>
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!canAdd}
                      className={`p-2 rounded-lg ${
                        canAdd
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      title={!inStock ? 'Out of stock' : 'Add to cart'}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart & Buyer Info */}
        <div className="space-y-4">
          {/* Cart */}
          {cartItems.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {cartItems.map((item) => {
                  const product = products.find(p => p.productId === item.productId);
                  const currency = product?.currency || 'INR';
                  return (
                    <div key={item.productId} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            {currency} {item.unitPrice.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => product && updateCartItem(product, item.quantity - 1)}
                            className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-semibold w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => product && updateCartItem(product, item.quantity + 1)}
                            disabled={product && item.quantity >= (product.stock || 0)}
                            className="p-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="font-semibold text-indigo-600">
                          {currency} {item.lineTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-sm mb-1">
                  <span>Subtotal:</span>
                  <span>INR {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Tax:</span>
                  <span>INR {totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-indigo-600">INR {total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Buyer Info */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-bold mb-4">Buyer Information</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={buyerInfo.name}
                  onChange={(e) => setBuyerInfo({ ...buyerInfo, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact *</label>
                <input
                  type="text"
                  required
                  value={buyerInfo.contact}
                  onChange={(e) => setBuyerInfo({ ...buyerInfo, contact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={buyerInfo.address}
                  onChange={(e) => setBuyerInfo({ ...buyerInfo, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={buyerInfo.date}
                  onChange={(e) => setBuyerInfo({ ...buyerInfo, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  value={buyerInfo.status}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (['draft', 'pending', 'paid'].includes(value)) {
                      setBuyerInfo({ ...buyerInfo, status: value as 'draft' | 'pending' | 'paid' });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <button
                onClick={() => {
                  if (cartItems.length === 0) {
                    alert('Cart is empty');
                    return;
                  }

                  if (!buyerInfo.name || !buyerInfo.contact || !buyerInfo.date || !buyerInfo.status) {
                    alert('Please fill all required buyer information');
                    return;
                  }
                  setShowConfirmModal(true);
                }}
                disabled={cartItems.length === 0 || checkingOut}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              >
                {checkingOut ? 'Processing...' : 'Checkout'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Confirm Sale</h2>
            {checkoutError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-700 font-medium">Error</p>
                  <pre className="text-sm text-red-600 whitespace-pre-wrap">{checkoutError}</pre>
                </div>
              </div>
            )}
            <div className="space-y-3 mb-4">
              <div>
                <p className="text-sm text-gray-600">Buyer:</p>
                <p className="font-semibold">{buyerInfo.name}</p>
                <p className="text-sm text-gray-600">{buyerInfo.contact}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Items: {cartItems.length}</p>
                <p className="text-sm text-gray-600">Payment: {paymentMethod}</p>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-indigo-600">INR {total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="flex-1 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checkingOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating Invoice...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Confirm Sale
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setCheckoutError(null);
                }}
                disabled={checkingOut}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Hidden Invoice Preview for PDF Generation */}
      {createdInvoice && user && (
        <div id="invoice-preview" className="fixed -top-[9999px] left-0 bg-white" style={{
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
            invoice={createdInvoice} 
            businessInfo={user} 
            template={(createdInvoice.templateId || 'classic') as InvoiceTemplateType}
          />
        </div>
      )}

      {/* Success Modal with PDF Download */}
      {showSuccessModal && createdInvoice && user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Created!</h2>
              <p className="text-gray-600">Invoice ID: {createdInvoice.invoiceId}</p>
            </div>
            <div className="space-y-3 mb-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {createdInvoice.currency || 'INR'} {(createdInvoice.total || 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  generateFirestoreInvoicePDF(createdInvoice, user, (createdInvoice.templateId || 'classic') as InvoiceTemplateType);
                }}
                className="flex-1 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setCreatedInvoice(null);
                  navigate('/invoices');
                }}
                className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                View Invoices
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setCreatedInvoice(null);
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

