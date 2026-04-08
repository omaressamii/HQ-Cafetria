/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  History, 
  Plus, 
  Save, 
  Play, 
  Square, 
  ChevronLeft, 
  AlertCircle,
  RefreshCw,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit2,
  Trash2,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Types
interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
}

interface InventoryItem {
  id: number;
  shift_id: number;
  product_id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  start_qty: number;
  purchase_qty: number;
  sales_qty: number;
  hospitality_qty: number;
  actual_qty: number;
}

interface Shift {
  id: number;
  open_time: string;
  close_time: string | null;
  status: 'open' | 'closed';
}

interface Report extends Shift {
  total_revenue: number;
  total_purchases: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'reports'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Product Edit State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, shiftRes, reportsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/current-shift'),
        fetch('/api/reports')
      ]);
      
      const prodData = await prodRes.json();
      const { shift, data } = await shiftRes.json();
      const reportsData = await reportsRes.json();

      setProducts(prodData);
      setCurrentShift(shift);
      setInventory(data);
      setReports(reportsData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const openShift = async () => {
    try {
      await fetch('/api/shift/open', { method: 'POST' });
      await fetchData();
    } catch (error) {
      console.error("Failed to open shift", error);
    }
  };

  const closeShift = async () => {
    if (!currentShift) return;
    
    const totalRevenue = inventory.reduce((sum, item) => sum + (item.sales_qty * item.price), 0);
    const totalPurchases = inventory.reduce((sum, item) => sum + (item.purchase_qty * item.price), 0);

    try {
      await fetch('/api/shift/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalRevenue, totalPurchases })
      });
      await fetchData();
    } catch (error) {
      console.error("Failed to close shift", error);
    }
  };

  const updateInventoryItem = async (item: InventoryItem) => {
    setSaving(true);
    try {
      await fetch('/api/inventory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
    } catch (error) {
      console.error("Failed to update inventory", error);
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    setSaving(true);
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct)
      });
      setIsProductModalOpen(false);
      setEditingProduct(null);
      await fetchData();
    } catch (error) {
      console.error("Failed to save product", error);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    
    setSaving(true);
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (error) {
      console.error("Failed to delete product", error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (id: number, field: keyof InventoryItem, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInventory(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: numValue };
        return updated;
      }
      return item;
    }));
  };

  const totals = useMemo(() => {
    return inventory.reduce((acc, item) => {
      acc.revenue += item.sales_qty * item.price;
      acc.purchases += item.purchase_qty * item.price;
      return acc;
    }, { revenue: 0, purchases: 0 });
  }, [inventory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8f9fa]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col" dir="rtl">
      {/* Sidebar / Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">سجل<span className="text-gray-400">الوردية</span></h1>
          </div>
          
          <div className="flex items-center gap-1">
            <NavButton 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')}
              icon={<LayoutDashboard size={18} />}
              label="لوحة التحكم"
            />
            <NavButton 
              active={activeTab === 'products'} 
              onClick={() => setActiveTab('products')}
              icon={<Package size={18} />}
              label="المنتجات"
            />
            <NavButton 
              active={activeTab === 'reports'} 
              onClick={() => setActiveTab('reports')}
              icon={<History size={18} />}
              label="التقارير"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {currentShift ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">الوردية الحالية</span>
                <span className="text-xs font-mono font-medium">#{currentShift.id} • {new Date(currentShift.open_time).toLocaleTimeString('ar-EG')}</span>
              </div>
              <button 
                onClick={closeShift}
                className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all border border-red-100"
              >
                <Square size={14} fill="currentColor" />
                إغلاق الوردية
              </button>
            </div>
          ) : (
            <button 
              onClick={openShift}
              className="bg-black text-white hover:bg-gray-800 px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-black/10"
            >
              <Play size={14} fill="currentColor" className="rotate-180" />
              فتح وردية جديدة
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {!currentShift ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                    <AlertCircle className="text-gray-300 w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">لا توجد وردية نشطة</h2>
                  <p className="text-gray-500 max-w-xs">ابدأ وردية جديدة لتتبع المخزون والمبيعات لهذا اليوم.</p>
                  <button 
                    onClick={openShift}
                    className="mt-4 bg-black text-white px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform"
                  >
                    ابدأ العمل
                  </button>
                </div>
              ) : (
                <>
                  {/* Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard 
                      label="إجمالي الإيرادات" 
                      value={`${totals.revenue.toLocaleString()} ج.م`} 
                      icon={<ArrowUpCircle className="text-green-500" />}
                      trend="+12% من الوردية السابقة"
                    />
                    <StatCard 
                      label="إجمالي المشتريات" 
                      value={`${totals.purchases.toLocaleString()} ج.م`} 
                      icon={<ArrowDownCircle className="text-blue-500" />}
                      trend="بناءً على المدخلات الحالية"
                    />
                    <StatCard 
                      label="صافي الرصيد" 
                      value={`${(totals.revenue - totals.purchases).toLocaleString()} ج.م`} 
                      icon={<TrendingUp className="text-purple-500" />}
                      trend="ربح الوردية الحالية"
                    />
                  </div>

                  {/* Inventory Sections */}
                  <div className="space-y-12">
                    {Array.from(new Set(inventory.map(i => i.category))).map((cat) => {
                      const items = inventory.filter(i => i.category === cat);
                      if (items.length === 0) return null;

                      const catTotals = items.reduce((acc, item) => {
                        acc.revenue += item.sales_qty * item.price;
                        acc.purchases += item.purchase_qty * item.price;
                        return acc;
                      }, { revenue: 0, purchases: 0 });

                      return (
                        <div key={cat} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-6 bg-black rounded-full" />
                              <h3 className="font-bold text-lg text-gray-800">
                                {cat === 'مخزون' ? 'المخزون العام' : cat === 'إفطار' ? 'وجبة الإفطار' : 'وجبة الغداء'}
                              </h3>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] text-gray-400 uppercase font-bold">إيراد القسم</span>
                                <span className="text-sm font-mono font-bold text-green-600">{catTotals.revenue.toLocaleString()} ج.م</span>
                              </div>
                              {saving && <span className="text-[10px] font-mono text-gray-400 animate-pulse">جاري الحفظ...</span>}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                              <thead>
                                <tr className="bg-gray-50/50">
                                  <th className="px-6 py-3 col-header">الصنف</th>
                                  <th className="px-4 py-3 col-header text-center">بداية</th>
                                  <th className="px-4 py-3 col-header text-center">مشتريات</th>
                                  <th className="px-4 py-3 col-header text-center">مبيعات</th>
                                  <th className="px-4 py-3 col-header text-center">ضيافات</th>
                                  <th className="px-4 py-3 col-header text-center">الفعلي</th>
                                  <th className="px-4 py-3 col-header text-center">المتوقع</th>
                                  <th className="px-6 py-3 col-header text-left">الإيراد</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => {
                                  const expected = item.start_qty + item.purchase_qty - item.sales_qty - item.hospitality_qty;
                                  const revenue = item.sales_qty * item.price;
                                  const isDiscrepancy = item.actual_qty !== 0 && item.actual_qty !== expected;

                                  return (
                                    <tr key={item.id} className="border-b border-gray-50 data-row group">
                                      <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                          <span className="font-bold text-sm">{item.name}</span>
                                          <span className="text-[10px] text-gray-400 uppercase font-mono">{item.price} ج.م</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 text-center data-value text-gray-500">{item.start_qty}</td>
                                      <td className="px-4 py-4">
                                        <InventoryInput 
                                          value={item.purchase_qty} 
                                          onChange={(v) => handleInputChange(item.id, 'purchase_qty', v)}
                                          onBlur={() => updateInventoryItem(item)}
                                        />
                                      </td>
                                      <td className="px-4 py-4">
                                        <InventoryInput 
                                          value={item.sales_qty} 
                                          onChange={(v) => handleInputChange(item.id, 'sales_qty', v)}
                                          onBlur={() => updateInventoryItem(item)}
                                          highlight
                                        />
                                      </td>
                                      <td className="px-4 py-4">
                                        <InventoryInput 
                                          value={item.hospitality_qty} 
                                          onChange={(v) => handleInputChange(item.id, 'hospitality_qty', v)}
                                          onBlur={() => updateInventoryItem(item)}
                                        />
                                      </td>
                                      <td className="px-4 py-4">
                                        <InventoryInput 
                                          value={item.actual_qty} 
                                          onChange={(v) => handleInputChange(item.id, 'actual_qty', v)}
                                          onBlur={() => updateInventoryItem(item)}
                                          error={isDiscrepancy}
                                        />
                                      </td>
                                      <td className={cn(
                                        "px-4 py-4 text-center data-value text-sm",
                                        isDiscrepancy ? "text-red-500 font-bold" : "text-gray-400"
                                      )}>
                                        {expected}
                                      </td>
                                      <td className="px-6 py-4 text-left data-value font-bold text-sm">
                                        {revenue.toLocaleString()}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'products' && (
            <motion.div 
              key="products"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">كتالوج المنتجات</h2>
                  <p className="text-gray-500 text-sm">إدارة الأصناف، الفئات والأسعار.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingProduct({ id: 0, name: '', category: 'مخزون', price: 0, unit: 'وحدة' });
                    setIsProductModalOpen(true);
                  }}
                  className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  <Plus size={16} /> إضافة منتج
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(product => (
                  <div key={product.id} className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-black transition-colors group relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                        <Package size={20} />
                      </div>
                      <span className="text-[10px] font-mono bg-gray-100 px-2 py-1 rounded uppercase">{product.category}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                    <div className="flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">السعر</span>
                        <span className="text-xl font-mono font-bold">{product.price} <span className="text-xs text-gray-400">ج.م</span></span>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            setEditingProduct(product);
                            setIsProductModalOpen(true);
                          }}
                          className="text-gray-400 hover:text-black transition-colors p-2"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => deleteProduct(product.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold">سجل الورديات</h2>
                <p className="text-gray-500 text-sm">البيانات التاريخية والتقارير المؤرشفة.</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-4 col-header">رقم الوردية</th>
                      <th className="px-6 py-4 col-header">التاريخ</th>
                      <th className="px-6 py-4 col-header">المدة</th>
                      <th className="px-6 py-4 col-header text-left">الإيرادات</th>
                      <th className="px-6 py-4 col-header text-left">المشتريات</th>
                      <th className="px-6 py-4 col-header text-left">الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(report => (
                      <tr key={report.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-sm">#{report.id}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{new Date(report.open_time).toLocaleDateString('ar-EG')}</span>
                            <span className="text-[10px] text-gray-400 uppercase">{new Date(report.open_time).toLocaleTimeString('ar-EG')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {report.close_time ? (
                            Math.round((new Date(report.close_time).getTime() - new Date(report.open_time).getTime()) / 60000) + ' دقيقة'
                          ) : 'غير متوفر'}
                        </td>
                        <td className="px-6 py-4 text-left data-value font-bold text-green-600">+{report.total_revenue?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-left data-value font-bold text-red-600">-{report.total_purchases?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-left data-value font-bold">{(report.total_revenue - report.total_purchases).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Product Modal */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProductModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10"
            >
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingProduct?.id ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
                <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-black transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={saveProduct} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">اسم المنتج</label>
                  <input 
                    required
                    type="text"
                    value={editingProduct?.name || ''}
                    onChange={(e) => setEditingProduct(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">الفئة</label>
                    <select 
                      value={editingProduct?.category || 'مخزون'}
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, category: e.target.value } : null)}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all appearance-none"
                    >
                      <option value="مخزون">مخزون</option>
                      <option value="إفطار">إفطار</option>
                      <option value="غداء">غداء</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">السعر (ج.م)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={editingProduct?.price || ''}
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10 disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
                    حفظ المنتج
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] font-mono text-gray-400 uppercase tracking-widest">
          <span>&copy; 2026 نظام ShiftLog لإدارة المخزون</span>
          <div className="flex gap-4">
            <span>حالة النظام: متصل</span>
            <span>قاعدة البيانات: SQLite 3.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Sub-components
function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
        active ? "bg-gray-100 text-black" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, icon, trend }: { label: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">{label}</span>
        <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-mono font-bold mb-1 tracking-tight">{value}</div>
      <div className="text-[10px] text-gray-400 font-medium">{trend}</div>
    </div>
  );
}

function InventoryInput({ value, onChange, onBlur, highlight, error }: { value: number, onChange: (v: string) => void, onBlur: () => void, highlight?: boolean, error?: boolean }) {
  return (
    <input 
      type="number"
      value={value === 0 ? '' : value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder="0"
      className={cn(
        "w-full bg-gray-50 border-none rounded-md px-2 py-1 text-center font-mono text-sm focus:ring-2 focus:ring-black outline-none transition-all",
        highlight && "bg-blue-50/50 text-blue-700 font-bold",
        error && "bg-red-50 text-red-600 font-bold ring-1 ring-red-200"
      )}
    />
  );
}
