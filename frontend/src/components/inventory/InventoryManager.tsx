import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { Product, InventoryLog } from '../../types';
import { firestoreService } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

export const InventoryManager: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: 0,
    currency: 'INR',
    stock: 0,
    taxPercent: 18,
    unit: 'pcs',
    imageUrl: '',
  });

  const [stockFormData, setStockFormData] = useState({
    delta: 0,
    reason: '',
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      console.log('Loading products...');
      const allProducts = await firestoreService.getAllProducts();
      console.log('Products loaded:', allProducts.length);
      setProducts(allProducts);
    } catch (error: any) {
      console.error('Failed to load products:', error);
      alert(`Failed to load products: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting product:', formData);
    try {
      if (editingProduct) {
        console.log('Updating product:', editingProduct.productId);
        await firestoreService.updateProduct(editingProduct.productId, formData);
      } else {
        console.log('Creating new product');
        const productId = await firestoreService.createProduct(formData);
        console.log('Product created with ID:', productId);
      }
      console.log('Reloading products...');
      await loadProducts();
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      console.error('Failed to save product:', error);
      alert(`Failed to save product: ${error.message}`);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await firestoreService.deleteProduct(productId);
      await loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Failed to delete product');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || '',
      price: product.price,
      currency: product.currency,
      stock: product.stock,
      taxPercent: product.taxPercent || 18,
      unit: product.unit || 'pcs',
      imageUrl: product.imageUrl || '',
    });
    setShowForm(true);
  };

  const handleAddStock = async () => {
    if (!selectedProduct || !user) return;
    
    if (stockFormData.delta === 0) {
      alert('Please enter a non-zero stock change');
      return;
    }

    try {
      await firestoreService.addStock({
        productId: selectedProduct.productId,
        delta: stockFormData.delta,
        reason: stockFormData.reason || 'Manual stock adjustment',
        userId: user.id,
      });
      await loadProducts();
      setShowStockModal(false);
      setStockFormData({ delta: 0, reason: '' });
      setSelectedProduct(null);
    } catch (error: any) {
      console.error('Failed to add stock:', error);
      alert(error.message || 'Failed to update stock');
    }
  };

  const loadInventoryLogs = async (productId: string) => {
    try {
      const logs = await firestoreService.getInventoryLogs(productId);
      setInventoryLogs(logs);
      setShowLogsModal(true);
    } catch (error) {
      console.error('Failed to load inventory logs:', error);
      alert('Failed to load inventory logs');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      price: 0,
      currency: 'INR',
      stock: 0,
      taxPercent: 18,
      unit: 'pcs',
      imageUrl: '',
    });
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <Package className="w-6 h-6 sm:w-8 sm:h-8" />
          Inventory Management
        </h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Price</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Stock</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Tax %</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.productId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      {product.unit && (
                        <div className="text-sm text-gray-500">Unit: {product.unit}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{product.sku || '-'}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {product.currency} {product.price.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${product.stock <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {product.taxPercent || 0}%
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setStockFormData({ delta: 0, reason: '' });
                            setShowStockModal(true);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Add Stock"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => loadInventoryLogs(product.productId)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="View Logs"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.productId)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.taxPercent}
                    onChange={(e) => setFormData({ ...formData, taxPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., pcs, kg, liters"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingProduct ? 'Update' : 'Create'} Product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Manage Stock: {selectedProduct.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Stock: <span className="font-bold">{selectedProduct.stock}</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Change *
                </label>
                <input
                  type="number"
                  required
                  value={stockFormData.delta}
                  onChange={(e) => setStockFormData({ ...stockFormData, delta: parseInt(e.target.value) || 0 })}
                  placeholder="Positive to add, negative to subtract"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter positive number to add stock, negative to subtract
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={stockFormData.reason}
                  onChange={(e) => setStockFormData({ ...stockFormData, reason: e.target.value })}
                  placeholder="e.g., Restock, Return, Adjustment"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleAddStock}
                  className="flex-1 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Update Stock
                </button>
                <button
                  onClick={() => {
                    setShowStockModal(false);
                    setSelectedProduct(null);
                    setStockFormData({ delta: 0, reason: '' });
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Logs Modal */}
      {showLogsModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Inventory Logs: {selectedProduct.name}</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">Change</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">Previous</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">New Stock</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-gray-500">
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    inventoryLogs.map((log, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 px-4 text-sm text-gray-600">
                          {log.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                        </td>
                        <td className="py-2 px-4 text-right">
                          <span className={`font-medium ${log.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {log.change >= 0 ? '+' : ''}{log.change}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right text-gray-600">{log.previousStock}</td>
                        <td className="py-2 px-4 text-right font-medium">{log.newStock}</td>
                        <td className="py-2 px-4 text-sm text-gray-600">{log.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => {
                setShowLogsModal(false);
                setSelectedProduct(null);
              }}
              className="mt-4 px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

