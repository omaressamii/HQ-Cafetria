/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  History, 
  Calculator,
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
  Check,
  Printer,
  FileSpreadsheet,
  Calculator as CalcIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn } from './lib/utils';

// Types
interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  ratio: number;
}

interface InventoryItem {
  id: number;
  shift_id: number;
  product_id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  ratio: number;
  start_qty: number;
  purchase_qty: number;
  actual_purchase_qty: number;
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
  items_sold_count: number;
  total_discrepancy: number;
}

interface DetailedReport {
  shift: Shift;
  summary: {
    total_revenue: number;
    total_purchases: number;
  };
  inventory: InventoryItem[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'reports' | 'calculator'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<DetailedReport | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Product Edit State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingIngredients, setEditingIngredients] = useState<{ ingredient_id: number, quantity: number, name?: string, price?: number }[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Calculator State
  const [calcProductId, setCalcProductId] = useState<number | null>(null);
  const [calcRows, setCalcRows] = useState<{ units_per_carton: number, carton_count: number }[]>([
    { units_per_carton: 12, carton_count: 0 },
    { units_per_carton: 6, carton_count: 0 },
    { units_per_carton: 15, carton_count: 0 },
    { units_per_carton: 20, carton_count: 0 },
    { units_per_carton: 24, carton_count: 0 },
    { units_per_carton: 1, carton_count: 0 },
  ]);

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

      // Set default calculator product if not set
      if (!calcProductId && prodData.length > 0) {
        const target = prodData.find((p: Product) => p.name.includes('شيبسي فئة 5ج')) || prodData[0];
        setCalcProductId(target.id);
      }
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
    
    const totalRevenue = inventory
      .filter(item => item.category !== 'ضيافات' && item.category !== 'مكون')
      .reduce((sum, item) => sum + (item.sales_qty * item.price), 0);
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
    const productToSave = {
      ...editingProduct,
      price: parseFloat(editingProduct.price as any) || 0,
      ratio: parseFloat(editingProduct.ratio as any) || 1
    };

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productToSave)
      });
      const result = await res.json();
      const productId = result.id;
      
      if (productId && (editingProduct.category === 'إفطار' || editingProduct.category === 'غداء')) {
        const ingredientsToSave = editingIngredients.map(i => ({
          ...i,
          quantity: parseFloat(i.quantity as any) || 0
        }));
        await fetch(`/api/products/${productId}/ingredients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ingredients: ingredientsToSave })
        });
      }

      setIsProductModalOpen(false);
      setEditingProduct(null);
      setEditingIngredients([]);
      await fetchData();
    } catch (error) {
      console.error("Failed to save product", error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = async (product: Product) => {
    setEditingProduct(product);
    setEditingIngredients([]);
    if (product.id && (product.category === 'إفطار' || product.category === 'غداء')) {
      try {
        const res = await fetch(`/api/products/${product.id}/ingredients`);
        const data = await res.json();
        setEditingIngredients(data);
      } catch (error) {
        console.error("Failed to fetch ingredients", error);
      }
    }
    setIsProductModalOpen(true);
  };

  const addIngredient = (ingredientId: number) => {
    const ingredient = products.find(p => p.id === ingredientId);
    if (!ingredient) return;
    
    if (editingIngredients.some(i => i.ingredient_id === ingredientId)) return;

    setEditingIngredients(prev => [...prev, { 
      ingredient_id: ingredientId, 
      quantity: 1,
      name: ingredient.name,
      price: ingredient.price
    }]);
  };

  const removeIngredient = (ingredientId: number) => {
    setEditingIngredients(prev => prev.filter(i => i.ingredient_id !== ingredientId));
  };

  const updateIngredientQty = (ingredientId: number, qty: number) => {
    setEditingIngredients(prev => prev.map(i => 
      i.ingredient_id === ingredientId ? { ...i, quantity: qty } : i
    ));
  };

  const calculateTotalCost = () => {
    return editingIngredients.reduce((sum, i) => sum + (parseFloat(i.quantity as any) || 0) * (i.price || 0), 0);
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

  const saveCartonCalculation = async () => {
    if (!currentShift || !calcProductId) return;
    setSaving(true);
    try {
      await fetch('/api/carton-calculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: currentShift.id,
          productId: calcProductId,
          rows: calcRows
        })
      });
      await fetchData();
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Failed to save carton calculation", error);
    } finally {
      setSaving(false);
    }
  };

  const fetchReportDetails = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}`);
      const data = await res.json();
      setSelectedReport(data);
      setIsReportModalOpen(true);
    } catch (error) {
      console.error("Failed to fetch report details", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!selectedReport) return;

    const data = selectedReport.inventory.map(item => ({
      'الصنف': item.name,
      'الفئة': item.category,
      'بداية': item.start_qty,
      'مشتريات': item.purchase_qty,
      'مشتريات فعلية': item.actual_purchase_qty,
      'مبيعات': item.sales_qty,
      'الفعلي': item.actual_qty,
      'السعر': item.price,
      'الإيراد': item.sales_qty * item.price
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير الوردية");
    
    // Set RTL for the sheet
    if(!ws['!views']) ws['!views'] = [];
    ws['!views'].push({RTL: true});

    XLSX.writeFile(wb, `تقرير_وردية_${selectedReport.shift.id}.xlsx`);
  };

  const handleInputChange = (id: number, field: keyof InventoryItem, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInventory(prev => prev.map(item => {
      if (item.id === id) {
        let updated = { ...item, [field]: numValue };
        
        // Auto-calculate actual purchase based on ratio
        if (field === 'purchase_qty') {
          updated.actual_purchase_qty = updated.ratio ? updated.purchase_qty / updated.ratio : updated.purchase_qty;
        }
        
        // Auto-calculate sales or hospitality based on actual count
        // Formula: Sales = (Start + Actual Purchase) - Actual
        if (field === 'actual_qty' || field === 'purchase_qty') {
          const calculatedUsage = Math.max(0, (updated.start_qty + updated.actual_purchase_qty) - updated.actual_qty);
          if (updated.category === 'ضيافات') {
            updated.hospitality_qty = calculatedUsage;
          } else {
            updated.sales_qty = calculatedUsage;
          }
        }
        
        return updated;
      }
      return item;
    }));
  };

  const totals = useMemo(() => {
    return inventory.reduce((acc, item) => {
      if (item.category !== 'ضيافات' && item.category !== 'مكون') {
        acc.revenue += item.sales_qty * item.price;
      }
      acc.purchases += item.actual_purchase_qty * item.price;
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
              active={activeTab === 'calculator'} 
              onClick={() => setActiveTab('calculator')}
              icon={<CalcIcon size={18} />}
              label="حاسبة الكراتين"
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
                        acc.purchases += item.actual_purchase_qty * item.price;
                        return acc;
                      }, { revenue: 0, purchases: 0 });

                      const isHospitalityCat = cat === 'ضيافات';
                      const isComponentCat = cat === 'مكون';

                      return (
                        <div key={cat} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-2 h-6 rounded-full", isHospitalityCat ? "bg-purple-500" : "bg-black")} />
                              <h3 className="font-bold text-lg text-gray-800">
                                {cat === 'مخزون' ? 'المخزون العام' : cat === 'إفطار' ? 'وجبة الإفطار' : cat === 'غداء' ? 'وجبة الغداء' : cat === 'مكون' ? 'المكونات' : 'قسم الضيافات'}
                              </h3>
                            </div>
                            <div className="flex items-center gap-6">
                              {(!isHospitalityCat && !isComponentCat) && (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] text-gray-400 uppercase font-bold">إيراد القسم</span>
                                  <span className="text-sm font-mono font-bold text-green-600">{catTotals.revenue.toLocaleString()} ج.م</span>
                                </div>
                              )}
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
                                  <th className="px-4 py-3 col-header text-center">النسبة</th>
                                  <th className="px-4 py-3 col-header text-center bg-yellow-50/50">مشتريات فعلية</th>
                                  {(!isHospitalityCat && !isComponentCat) && <th className="px-4 py-3 col-header text-center">مبيعات</th>}
                                  {isHospitalityCat && <th className="px-4 py-3 col-header text-center">المنصرف (ضيافة)</th>}
                                  {isComponentCat && <th className="px-4 py-3 col-header text-center">المنصرف (مكونات)</th>}
                                  <th className="px-4 py-3 col-header text-center">الفعلي</th>
                                  {(!isHospitalityCat && !isComponentCat) && <th className="px-6 py-3 col-header text-left">الإيراد</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => {
                                  // For hospitality category, we use hospitality_qty as the main "usage" field
                                  // For others, we hide hospitality_qty to keep it "separate"
                                  const revenue = item.sales_qty * item.price;

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
                                      <td className="px-4 py-4 text-center text-gray-400 font-mono text-xs">{item.ratio || 1}</td>
                                      <td className="px-4 py-4 text-center bg-yellow-50/30">
                                        <span className="font-mono font-bold text-yellow-700">
                                          {item.actual_purchase_qty}
                                        </span>
                                      </td>
                                      {(!isHospitalityCat && !isComponentCat) && (
                                        <td className="px-4 py-4 text-center">
                                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-md">
                                            {item.sales_qty}
                                          </span>
                                        </td>
                                      )}
                                      {isHospitalityCat && (
                                        <td className="px-4 py-4 text-center">
                                          <span className="font-mono font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-md">
                                            {item.hospitality_qty}
                                          </span>
                                        </td>
                                      )}
                                      {isComponentCat && (
                                        <td className="px-4 py-4 text-center">
                                          <span className="font-mono font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-md">
                                            {item.sales_qty}
                                          </span>
                                        </td>
                                      )}
                                      <td className="px-4 py-4">
                                        <InventoryInput 
                                          value={item.actual_qty} 
                                          onChange={(v) => handleInputChange(item.id, 'actual_qty', v)}
                                          onBlur={() => updateInventoryItem(item)}
                                          highlight
                                        />
                                      </td>
                                      {(!isHospitalityCat && !isComponentCat) && (
                                        <td className="px-6 py-4 text-left data-value font-bold text-sm">
                                          {revenue.toLocaleString()}
                                        </td>
                                      )}
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
                          onClick={() => handleEditProduct(product)}
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
                      <th className="px-6 py-4 col-header">التاريخ والوقت</th>
                      <th className="px-6 py-4 col-header text-center">الأصناف المباعة</th>
                      <th className="px-6 py-4 col-header text-left">الإيرادات</th>
                      <th className="px-6 py-4 col-header text-left">المشتريات</th>
                      <th className="px-6 py-4 col-header text-left">الصافي</th>
                      <th className="px-6 py-4 col-header"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(report => (
                      <tr key={report.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 font-mono font-bold text-sm">#{report.id}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{new Date(report.open_time).toLocaleDateString('ar-EG')}</span>
                            <span className="text-[10px] text-gray-400 uppercase">{new Date(report.open_time).toLocaleTimeString('ar-EG')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-[10px] font-bold">
                            {report.items_sold_count || 0} صنف
                          </span>
                        </td>
                        <td className="px-6 py-4 text-left data-value font-bold text-green-600">+{report.total_revenue?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-left data-value font-bold text-red-600">-{report.total_purchases?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-left data-value font-bold">{(report.total_revenue - report.total_purchases).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => fetchReportDetails(report.id)}
                            className="text-gray-400 hover:text-black transition-colors"
                          >
                            <ChevronLeft size={20} className="rotate-180" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'calculator' && (
            <motion.div 
              key="calculator"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">حاسبة الكراتين</h2>
                  <p className="text-gray-500 text-sm">حساب إجمالي المشتريات بناءً على عدد الكراتين.</p>
                </div>
                <button 
                  onClick={saveCartonCalculation}
                  disabled={saving || !currentShift}
                  className="bg-black text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-black/10 disabled:opacity-50"
                >
                  <Save size={18} /> تطبيق على المخزون
                </button>
              </div>

              {!currentShift && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-amber-700 text-sm flex items-center gap-2">
                  <AlertCircle size={18} /> يجب فتح وردية أولاً لتتمكن من حفظ الحسابات.
                </div>
              )}

              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">المنتج المستهدف</label>
                      <select 
                        value={calcProductId || ''}
                        onChange={(e) => setCalcProductId(parseInt(e.target.value))}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-gray-50/30">
                        <th className="px-6 py-4 col-header">العدد بالكرتونة</th>
                        <th className="px-6 py-4 col-header text-center">عدد الكراتين</th>
                        <th className="px-6 py-4 col-header text-left">الإجمالي الفرعي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-50">
                          <td className="px-6 py-4">
                            <input 
                              type="number"
                              value={row.units_per_carton}
                              onChange={(e) => {
                                const newRows = [...calcRows];
                                newRows[idx].units_per_carton = parseFloat(e.target.value) || 0;
                                setCalcRows(newRows);
                              }}
                              className="w-24 bg-gray-50 border-none rounded-md px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-black outline-none"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <input 
                                type="number"
                                value={row.carton_count || ''}
                                onChange={(e) => {
                                  const newRows = [...calcRows];
                                  newRows[idx].carton_count = parseFloat(e.target.value) || 0;
                                  setCalcRows(newRows);
                                }}
                                placeholder="0"
                                className="w-24 bg-orange-50 border border-orange-100 text-orange-700 rounded-md px-3 py-2 text-center font-mono font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-left font-mono font-bold text-gray-400">
                            {(row.units_per_carton * row.carton_count).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-black text-white">
                        <td colSpan={2} className="px-6 py-4 font-bold">الإجمالي الكلي (مشتريات الجرد)</td>
                        <td className="px-6 py-4 text-left font-mono font-bold text-xl">
                          {calcRows.reduce((sum, r) => sum + (r.units_per_carton * r.carton_count), 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
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
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingProduct?.id ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
                <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-black transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={saveProduct} className="p-8 space-y-6 overflow-y-auto flex-1">
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
                      <option value="ضيافات">ضيافات</option>
                      <option value="مكون">مكون</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">السعر (ج.م)</label>
                    <input 
                      required
                      type="text"
                      inputMode="decimal"
                      value={editingProduct?.price === undefined ? '' : editingProduct.price}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setEditingProduct(prev => prev ? { ...prev, price: val as any } : null);
                        }
                      }}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">نسبة الصنف (المعامل)</label>
                  <input 
                    required
                    type="text"
                    inputMode="decimal"
                    value={editingProduct?.ratio === undefined ? '' : editingProduct.ratio}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                        setEditingProduct(prev => prev ? { ...prev, ratio: val as any } : null);
                      }
                    }}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                  />
                  <p className="text-[10px] text-gray-400">يستخدم لحساب المشتريات الفعلية (المشتريات × النسبة)</p>
                </div>

                {(editingProduct?.category === 'إفطار' || editingProduct?.category === 'غداء') && (
                  <div className="space-y-4 border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">المكونات والتكلفة</label>
                      <div className="text-sm font-bold text-blue-600">إجمالي التكلفة: {calculateTotalCost().toLocaleString()} ج.م</div>
                    </div>
                    
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all text-sm"
                        onChange={(e) => {
                          if (e.target.value) {
                            addIngredient(parseInt(e.target.value));
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">إضافة مكون...</option>
                        {products.filter(p => p.category === 'مكون' || p.category === 'مخزون').map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.price} ج.م)</option>
                        ))}
                      </select>
                      <button 
                        type="button"
                        onClick={() => {
                          const cost = calculateTotalCost();
                          setEditingProduct(prev => prev ? { ...prev, price: cost } : null);
                        }}
                        className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all"
                      >
                        تطبيق التكلفة كالسعر
                      </button>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                      {editingIngredients.map(ing => (
                        <div key={ing.ingredient_id} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold">{ing.name}</span>
                            <span className="text-[10px] text-gray-400">{ing.price} ج.م / وحدة</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                inputMode="decimal"
                                value={ing.quantity}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                                    updateIngredientQty(ing.ingredient_id, val as any);
                                  }
                                }}
                                className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1 text-center text-sm font-mono"
                              />
                              <span className="text-[10px] text-gray-400">وحدة</span>
                            </div>
                            <button 
                              type="button"
                              onClick={() => removeIngredient(ing.ingredient_id)}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {editingIngredients.length === 0 && (
                        <div className="text-center py-4 text-gray-400 text-xs italic">لا توجد مكونات مضافة بعد</div>
                      )}
                    </div>
                  </div>
                )}

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

      {/* Report Details Modal */}
      <AnimatePresence>
        {isReportModalOpen && selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 flex flex-col print-area"
            >
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-bold">تفاصيل الوردية #{selectedReport.shift.id}</h3>
                  <p className="text-xs text-gray-500">
                    تمت في {new Date(selectedReport.shift.open_time).toLocaleDateString('ar-EG')} • 
                    من {new Date(selectedReport.shift.open_time).toLocaleTimeString('ar-EG')} 
                    إلى {selectedReport.shift.close_time ? new Date(selectedReport.shift.close_time).toLocaleTimeString('ar-EG') : 'غير محدد'}
                  </p>
                </div>
                <div className="flex items-center gap-2 no-print">
                  <button 
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-100 transition-colors"
                  >
                    <FileSpreadsheet size={18} /> اكسيل
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors"
                  >
                    <Printer size={18} /> طباعة
                  </button>
                  <button onClick={() => setIsReportModalOpen(false)} className="text-gray-400 hover:text-black transition-colors ml-2">
                    <X size={24} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                    <span className="text-[10px] text-green-600 font-bold uppercase tracking-widest">إجمالي الإيرادات</span>
                    <div className="text-xl font-mono font-bold text-green-700">{selectedReport.summary.total_revenue.toLocaleString()} ج.م</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                    <span className="text-[10px] text-red-600 font-bold uppercase tracking-widest">إجمالي المشتريات</span>
                    <div className="text-xl font-mono font-bold text-red-700">{selectedReport.summary.total_purchases.toLocaleString()} ج.م</div>
                  </div>
                  <div className="bg-black p-4 rounded-2xl">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">صافي الربح</span>
                    <div className="text-xl font-mono font-bold text-white">{(selectedReport.summary.total_revenue - selectedReport.summary.total_purchases).toLocaleString()} ج.م</div>
                  </div>
                </div>

                {/* Inventory Breakdown */}
                <div className="space-y-4">
                  <h4 className="font-bold text-lg">تفاصيل الجرد</h4>
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">الصنف</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">بداية</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">مشتريات</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">مبيعات</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">الفعلي</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-left">الإيراد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReport.inventory.map(item => {
                          const isNoRevenue = item.category === 'ضيافات' || item.category === 'مكون';
                          const revenue = isNoRevenue ? 0 : item.sales_qty * item.price;
                          return (
                            <tr key={item.id} className="border-b border-gray-50 last:border-0">
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold">{item.name}</span>
                                  <span className="text-[10px] text-gray-400">{item.category}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">{item.start_qty}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">{item.purchase_qty}</td>
                              <td className="px-4 py-3 text-center text-sm font-bold">{item.sales_qty}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">{item.actual_qty}</td>
                              <td className="px-4 py-3 text-left text-sm font-bold">{isNoRevenue ? '-' : revenue.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value === 0 ? '' : value.toString());
  }, [value]);

  return (
    <input 
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
          setLocalValue(val);
          onChange(val);
        }
      }}
      onBlur={() => {
        if (localValue === '' || localValue === '.') {
          setLocalValue('');
          onChange('0');
        }
        onBlur();
      }}
      placeholder="0"
      className={cn(
        "w-full bg-gray-50 border-none rounded-md px-2 py-1 text-center font-mono text-sm focus:ring-2 focus:ring-black outline-none transition-all",
        highlight && "bg-blue-50/50 text-blue-700 font-bold",
        error && "bg-red-50 text-red-600 font-bold ring-1 ring-red-200"
      )}
    />
  );
}
