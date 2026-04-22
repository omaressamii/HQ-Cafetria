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
  Calculator as CalcIcon,
  Wallet,
  Receipt,
  Users,
  Shield,
  Key,
  LogOut,
  User as UserIcon,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn } from './lib/utils';

// Types
interface Product {
  id: number;
  name: string;
  category: string;
  cost_price: number;
  selling_price: number;
  price: number; // Legacy, keep for compatibility in some places if needed
  unit: string;
  ratio: number;
}

interface InventoryItem {
  id: number;
  shift_id: number;
  product_id: number;
  name: string;
  category: string;
  cost_price: number;
  selling_price: number;
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
  receipt_value?: number;
}

interface Report extends Shift {
  total_revenue: number;
  total_purchases: number;
  items_sold_count: number;
  total_discrepancy: number;
  receipt_value: number;
}

interface DetailedReport {
  shift: Shift;
  summary: {
    total_revenue: number;
    total_purchases: number;
  };
  inventory: InventoryItem[];
}

interface ExternalPurchase {
  id?: number;
  shift_id: number;
  amount: number;
  description: string;
}

interface Employee {
  id?: number;
  name: string;
  username?: string;
  password?: string;
  role: string;
  pin: string;
  can_manage_products: boolean;
  can_view_reports: boolean;
  can_manage_employees: boolean;
}

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
  permissions: {
    can_manage_products: boolean;
    can_view_reports: boolean;
    can_manage_employees: boolean;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('shiftlog_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'reports' | 'calculator' | 'meal_calculator' | 'purchases_calculator' | 'employees'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [externalPurchases, setExternalPurchases] = useState<ExternalPurchase[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [receiptValue, setReceiptValue] = useState<string>('0');
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

  // Employee State
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Meal Calculator State
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null);
  const [mealIngredients, setMealIngredients] = useState<{ ingredient_id: number, quantity: number, name?: string, price?: number }[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleLogin = (loggedUser: User) => {
    setUser(loggedUser);
    localStorage.setItem('shiftlog_user', JSON.stringify(loggedUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('shiftlog_user');
  };

  useEffect(() => {
    if (selectedMealId) {
      fetch(`/api/products/${selectedMealId}/ingredients`)
        .then(res => res.json())
        .then(data => setMealIngredients(data));
    } else {
      setMealIngredients([]);
    }
  }, [selectedMealId]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [prodRes, shiftRes, reportsRes, empRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/current-shift'),
        fetch('/api/reports'),
        fetch('/api/employees')
      ]);
      
      const prodData = await prodRes.json();
      const { shift, data } = await shiftRes.json();
      const reportsData = await reportsRes.json();
      const empData = await empRes.json();

      setEmployees(empData.map((e: any) => ({
        ...e,
        can_manage_products: !!e.can_manage_products,
        can_view_reports: !!e.can_view_reports,
        can_manage_employees: !!e.can_manage_employees
      })));

      setProducts(prodData);
      setCurrentShift(shift);
      setInventory(data);
      setReports(reportsData);
      setReceiptValue(shift ? (shift.receipt_value || 0).toString() : '0');

      if (shift) {
        const extRes = await fetch(`/api/external-purchases/${shift.id}`);
        const extData = await extRes.json();
        setExternalPurchases(extData);
      } else {
        setExternalPurchases([]);
      }

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
    
    const externalSum = externalPurchases.reduce((sum, p) => sum + (parseFloat(p.amount as any) || 0), 0);
    const totalRevenue = inventory
      .filter(item => item.category !== 'ضيافات' && item.category !== 'مكون')
      .reduce((sum, item) => sum + (item.sales_qty * (item.selling_price || item.price)), 0);
    const totalPurchases = externalSum;

    try {
      await fetch('/api/shift/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          totalRevenue, 
          totalPurchases, 
          receiptValue: parseFloat(receiptValue) || 0 
        })
      });
      await fetchData();
    } catch (error) {
      console.error("Failed to close shift", error);
    }
  };

  const saveReceiptValue = async () => {
    try {
      await fetch('/api/shift/update-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptValue: parseFloat(receiptValue) || 0 })
      });
    } catch (error) {
      console.error("Failed to save receipt value", error);
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
      cost_price: parseFloat(editingProduct.cost_price as any) || 0,
      selling_price: parseFloat(editingProduct.selling_price as any) || 0,
      price: parseFloat(editingProduct.selling_price as any) || 0, // Sync legacy price
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

  // Meal Calculator Helpers
  const addMealIngredient = (ingredientId: number) => {
    const ingredient = products.find(p => p.id === ingredientId);
    if (!ingredient) return;
    if (mealIngredients.some(i => i.ingredient_id === ingredientId)) return;

    setMealIngredients(prev => [...prev, { 
      ingredient_id: ingredientId, 
      quantity: 1,
      name: ingredient.name,
      price: ingredient.price
    }]);
  };

  const removeMealIngredient = (ingredientId: number) => {
    setMealIngredients(prev => prev.filter(i => i.ingredient_id !== ingredientId));
  };

  const updateMealIngredientQty = (ingredientId: number, qty: number) => {
    setMealIngredients(prev => prev.map(i => 
      i.ingredient_id === ingredientId ? { ...i, quantity: qty } : i
    ));
  };

  const saveMealCalculation = async () => {
    if (!selectedMealId) return;
    setSaving(true);
    try {
      const totalCost = mealIngredients.reduce((sum, i) => sum + (parseFloat(i.quantity as any) || 0) * (i.price || 0), 0);
      
      // 1. Save ingredients
      const ingredientsToSave = mealIngredients.map(i => ({
        ...i,
        quantity: parseFloat(i.quantity as any) || 0
      }));
      
      await fetch(`/api/products/${selectedMealId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: ingredientsToSave })
      });

      // 2. Update product cost_price
      const product = products.find(p => p.id === selectedMealId);
      if (product) {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...product, cost_price: totalCost })
        });
      }

      await fetchData();
      alert('تم حفظ التكلفة وتحديث سعر المنتج بنجاح');
    } catch (error) {
      console.error("Failed to save meal calculation", error);
    } finally {
      setSaving(false);
    }
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

  const saveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    
    setSaving(true);
    const method = editingEmployee.id ? 'PUT' : 'POST';
    const url = editingEmployee.id ? `/api/employees/${editingEmployee.id}` : '/api/employees';

    try {
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEmployee)
      });
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      await fetchData();
    } catch (error) {
      console.error("Failed to save employee", error);
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الموظف؟")) return;
    try {
      await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (error) {
      console.error("Failed to delete employee", error);
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

  const saveExternalPurchases = async (purchases: ExternalPurchase[]) => {
    if (!currentShift) return;
    setSaving(true);
    try {
      await fetch('/api/external-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: currentShift.id,
          purchases: purchases
        })
      });
      await fetchData();
      alert('تم حفظ المشتريات الخارجية بنجاح');
    } catch (error) {
      console.error("Failed to save external purchases", error);
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
      'سعر التكلفة': item.cost_price || 0,
      'سعر البيع': item.selling_price || item.price || 0,
      'الإيراد': item.sales_qty * (item.selling_price || item.price)
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
    const externalSum = externalPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
    return inventory.reduce((acc, item) => {
      if (item.category !== 'ضيافات' && item.category !== 'مكون') {
        acc.revenue += item.sales_qty * (item.selling_price || item.price);
      }
      return acc;
    }, { revenue: 0, purchases: externalSum });
  }, [inventory, externalPurchases]);

  if (loading && user) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8f9fa]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
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
              active={activeTab === 'meal_calculator'} 
              onClick={() => setActiveTab('meal_calculator')}
              icon={<Calculator size={18} />}
              label="حساب الوجبات"
            />
            <NavButton 
              active={activeTab === 'purchases_calculator'} 
              onClick={() => setActiveTab('purchases_calculator')}
              icon={<Wallet size={18} />}
              label="حساب المشتريات"
            />
            <NavButton 
              active={activeTab === 'reports'} 
              onClick={() => setActiveTab('reports')}
              icon={<History size={18} />}
              label="التقارير"
            />
            <NavButton 
              active={activeTab === 'employees'} 
              onClick={() => setActiveTab('employees')}
              icon={<Users size={18} />}
              label="الموظفين"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100 ml-4">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 uppercase font-bold text-xs">
              {user.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold">{user.name}</span>
              <span className="text-[10px] text-gray-400">{user.role === 'admin' ? 'مدير نظام' : 'موظف'}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>
          </div>

          {currentShift ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">الوردية الحالية</span>
                <span className="text-xs font-mono font-medium">#{currentShift.id} • {new Date(currentShift.open_time).toLocaleTimeString('ar-EG')}</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                <Receipt size={16} className="text-gray-400" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-400">قيمة الإيصال</span>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    value={receiptValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                        setReceiptValue(val);
                      }
                    }}
                    onBlur={saveReceiptValue}
                    className="bg-transparent border-none outline-none text-xs font-bold w-20 p-0 text-center"
                    placeholder="0"
                  />
                </div>
                <button 
                  onClick={saveReceiptValue}
                  className="text-gray-400 hover:text-green-600 transition-colors"
                  title="حفظ قيمة الإيصال"
                >
                  <Save size={14} />
                </button>
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
                      trend={externalPurchases.length > 0 
                        ? `إجمالي بنود صفحة حساب المشتريات`
                        : "بناءً على المدخلات الخارجية"}
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
                                   <th className="px-6 py-3 col-header text-right">الصنف</th>
                                   <th className="px-4 py-3 col-header text-center">بداية</th>
                                   <th className="px-4 py-3 col-header text-center">مشتريات</th>
                                   <th className="px-4 py-3 col-header text-center">النسبة</th>
                                   <th className="px-4 py-3 col-header text-center bg-yellow-50/50">مشتريات فعلية</th>
                                   {(!isHospitalityCat && !isComponentCat) && <th className="px-4 py-3 col-header text-center">مبيعات</th>}
                                   {isHospitalityCat && <th className="px-4 py-3 col-header text-center">المنصرف (ضيافة)</th>}
                                   {isComponentCat && <th className="px-4 py-3 col-header text-center">المنصرف (مكونات)</th>}
                                   <th className="px-4 py-3 col-header text-center">الفعلي</th>
                                   <th className="px-4 py-3 col-header text-center">التكلفة</th>
                                   <th className="px-4 py-3 col-header text-center">البيع</th>
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
                                      <td className="px-4 py-4 text-center font-mono text-xs text-gray-400">{item.cost_price || 0}</td>
                                      <td className="px-4 py-4 text-center font-mono text-xs text-blue-600 font-bold">{item.selling_price || item.price || 0}</td>
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
                    setEditingProduct({ id: 0, name: '', category: 'مخزون', cost_price: 0, selling_price: 0, price: 0, unit: 'وحدة', ratio: 1 });
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
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">التكلفة</span>
                          <span className="text-sm font-mono font-bold">{product.cost_price || 0} <span className="text-[9px] text-gray-400">ج.م</span></span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">البيع</span>
                          <span className="text-sm font-mono font-bold text-blue-600">{product.selling_price || product.price || 0} <span className="text-[9px] text-gray-400">ج.م</span></span>
                        </div>
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

          {activeTab === 'employees' && (
            <motion.div 
              key="employees"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">إدارة الموظفين</h2>
                  <p className="text-gray-500 text-sm">إدارة المستخدمين، الأدوار، وصلاحيات النظام.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingEmployee({
                      name: '',
                      role: 'staff',
                      pin: '',
                      can_manage_products: false,
                      can_view_reports: false,
                      can_manage_employees: false
                    });
                    setIsEmployeeModalOpen(true);
                  }}
                  className="bg-black text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-black/10"
                >
                  <Plus size={18} /> إضافة موظف جديد
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {employees.map(emp => (
                  <div key={emp.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className="p-6 space-y-4 flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                            <Users size={24} />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{emp.name}</h3>
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                              emp.role === 'admin' ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"
                            )}>
                              {emp.role === 'admin' ? 'مدير نظام' : 'موظف'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setEditingEmployee(emp);
                              setIsEmployeeModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => emp.id && deleteEmployee(emp.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">الصلاحيات الممنوحة</label>
                        <div className="flex flex-wrap gap-2">
                          {emp.can_manage_products && (
                            <span className="flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-2 py-1 rounded-md">
                              <Package size={10} /> إدارة المنتجات
                            </span>
                          )}
                          {emp.can_view_reports && (
                            <span className="flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-md">
                              <History size={10} /> عرض التقارير
                            </span>
                          )}
                          {emp.can_manage_employees && (
                            <span className="flex items-center gap-1 bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-1 rounded-md">
                              <Shield size={10} /> إدارة الموظفين
                            </span>
                          )}
                          {!emp.can_manage_products && !emp.can_view_reports && !emp.can_manage_employees && (
                            <span className="text-gray-400 text-[10px] italic">لا توجد صلاحيات خاصة</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Key size={14} />
                        <span className="text-xs font-mono font-bold tracking-widest">
                          {emp.pin ? '••••' : 'لم يتم تعيين PIN'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'meal_calculator' && (
            <motion.div 
              key="meal_calculator"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">حساب تكلفة الوجبات</h2>
                  <p className="text-gray-500 text-sm">حساب تكلفة السندوتشات والوجبات بناءً على المكونات.</p>
                </div>
                <button 
                  onClick={saveMealCalculation}
                  disabled={saving || !selectedMealId}
                  className="bg-black text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-black/10 disabled:opacity-50"
                >
                  <Save size={18} /> حفظ التكلفة وتحديث السعر
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Selection & Summary */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">الوجبة المستهدفة</label>
                      <select 
                        value={selectedMealId || ''}
                        onChange={(e) => setSelectedMealId(parseInt(e.target.value))}
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                      >
                        <option value="">اختر وجبة...</option>
                        {products.filter(p => p.category === 'إفطار' || p.category === 'غداء').map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedMealId && (
                      <div className="pt-4 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-500">التكلفة الإجمالية:</span>
                          <span className="text-2xl font-mono font-bold text-black">
                            {mealIngredients.reduce((sum, i) => sum + (parseFloat(i.quantity as any) || 0) * (i.price || 0), 0).toLocaleString()} ج.م
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400">سيتم تحديث سعر المنتج بهذا الرقم عند الحفظ.</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                      <Calculator size={16} /> معادلة الحساب
                    </h4>
                    <p className="text-xs text-blue-600 leading-relaxed">
                      التكلفة = مجموع (كمية المكون × سعر المكون في المخزون).
                      <br /><br />
                      يتم جلب أسعار المكونات تلقائياً من قائمة المنتجات المصنفة كـ "مكون" أو "مخزون".
                    </p>
                  </div>
                </div>

                {/* Ingredients Management */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <h3 className="font-bold">مكونات الوجبة</h3>
                      <div className="w-64">
                        <select 
                          disabled={!selectedMealId}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-black outline-none transition-all text-sm disabled:opacity-50"
                          onChange={(e) => {
                            if (e.target.value) {
                              addMealIngredient(parseInt(e.target.value));
                              e.target.value = '';
                            }
                          }}
                        >
                          <option value="">إضافة مكون...</option>
                          {products.filter(p => p.category === 'مكون' || p.category === 'مخزون').map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.price} ج.م)</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="p-6">
                      {!selectedMealId ? (
                        <div className="text-center py-12 text-gray-400">
                          <Calculator size={48} className="mx-auto mb-4 opacity-20" />
                          <p>برجاء اختيار وجبة لبدء حساب التكلفة</p>
                        </div>
                      ) : mealIngredients.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                          <p>لا توجد مكونات مضافة لهذه الوجبة بعد.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {mealIngredients.map(ing => (
                            <div key={ing.ingredient_id} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-transparent hover:border-gray-200 transition-all">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{ing.name}</span>
                                <span className="text-[10px] text-gray-400">{ing.price} ج.م / وحدة</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="text"
                                    inputMode="decimal"
                                    value={ing.quantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                                        updateMealIngredientQty(ing.ingredient_id, val as any);
                                      }
                                    }}
                                    className="w-20 bg-white border border-gray-200 rounded-lg px-3 py-2 text-center text-sm font-mono font-bold"
                                  />
                                  <span className="text-[10px] text-gray-400">وحدة</span>
                                </div>
                                <div className="w-24 text-left font-mono font-bold text-gray-600">
                                  {((parseFloat(ing.quantity as any) || 0) * (ing.price || 0)).toLocaleString()} ج.م
                                </div>
                                <button 
                                  onClick={() => removeMealIngredient(ing.ingredient_id)}
                                  className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'purchases_calculator' && (
            <motion.div 
              key="purchases_calculator"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">حساب المشتريات الخارجية</h2>
                  <p className="text-gray-500 text-sm">إضافة مبالغ المشتريات الخارجية (فواتير، مصروفات أخرى) ليتم جمعها مع إجمالي المشتريات.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                        const newRow = { shift_id: currentShift?.id || 0, amount: 0, description: '' };
                        setExternalPurchases(prev => [...prev, newRow]);
                    }}
                    className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                  >
                    <Plus size={16} /> إضافة بند
                  </button>
                  <button 
                    onClick={() => saveExternalPurchases(externalPurchases)}
                    disabled={saving || !currentShift}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save size={16} /> حفظ الكل
                  </button>
                </div>
              </div>

              {!currentShift ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-20 flex flex-col items-center justify-center text-center space-y-4">
                  <AlertCircle className="text-gray-300 w-12 h-12" />
                  <h2 className="text-xl font-bold">يجب فتح وردية أولاً</h2>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-bold text-gray-700">قائمة المصروفات الخارجية</span>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-400">إجمالي المصروفات الخارجية:</span>
                        <span className="text-2xl font-mono font-bold text-red-600">{externalPurchases.reduce((sum, p) => sum + (parseFloat(p.amount as any) || 0), 0).toLocaleString()} ج.م</span>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {externalPurchases.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 italic">لا توجد مصروفات مضافة بعد. اضغط على "إضافة بند" للبدء.</div>
                    ) : (
                      <div className="space-y-3">
                        {externalPurchases.map((p, idx) => (
                          <div key={idx} className="flex gap-4 items-center bg-gray-50 p-4 rounded-xl border border-transparent hover:border-gray-200 transition-all">
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">الوصف / البيان</label>
                                <input 
                                  type="text"
                                  value={p.description}
                                  placeholder="مثل: فاتورة الكهرباء، مشتريات خضار..."
                                  onChange={(e) => {
                                      const newArr = [...externalPurchases];
                                      newArr[idx].description = e.target.value;
                                      setExternalPurchases(newArr);
                                  }}
                                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                            <div className="w-40 space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">المبلغ (ج.م)</label>
                                <input 
                                  type="text"
                                  inputMode="decimal"
                                  value={p.amount}
                                  onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                                          const newArr = [...externalPurchases];
                                          newArr[idx].amount = val as any;
                                          setExternalPurchases(newArr);
                                      }
                                  }}
                                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                            <button 
                              onClick={() => setExternalPurchases(prev => prev.filter((_, i) => i !== idx))}
                              className="text-red-400 hover:text-red-600 p-2 self-end mt-1"
                              title="حذف البند"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                      <th className="px-6 py-4 col-header text-left">صافي الجرد</th>
                      <th className="px-6 py-4 col-header text-left">قيمة الإيصال</th>
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
                        <td className="px-6 py-4 text-left data-value font-bold text-blue-600">{report.receipt_value?.toLocaleString()}</td>
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
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">الوحدة</label>
                    <input 
                      required
                      type="text"
                      value={editingProduct?.unit || 'وحدة'}
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, unit: e.target.value } : null)}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">سعر التكلفة (ج.م)</label>
                    <input 
                      required
                      type="text"
                      inputMode="decimal"
                      value={editingProduct?.cost_price === undefined ? '' : editingProduct.cost_price}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setEditingProduct(prev => prev ? { ...prev, cost_price: val as any } : null);
                        }
                      }}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">سعر البيع (ج.م)</label>
                    <input 
                      required
                      type="text"
                      inputMode="decimal"
                      value={editingProduct?.selling_price === undefined ? '' : editingProduct.selling_price}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setEditingProduct(prev => prev ? { ...prev, selling_price: val as any, price: val as any } : null);
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
                          <option key={p.id} value={p.id}>{p.name} ({p.cost_price || p.price} ج.م)</option>
                        ))}
                      </select>
                      <button 
                        type="button"
                        onClick={() => {
                          const cost = calculateTotalCost();
                          setEditingProduct(prev => prev ? { ...prev, cost_price: cost } : null);
                        }}
                        className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all"
                      >
                        تطبيق على سعر التكلفة
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
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-right">الصنف</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">بداية</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">مشتريات</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">مبيعات</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">الفعلي</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">التكلفة</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center">البيع</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-left">الإيراد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReport.inventory.map(item => {
                          const isNoRevenue = item.category === 'ضيافات' || item.category === 'مكون';
                          const revenue = isNoRevenue ? 0 : item.sales_qty * (item.selling_price || item.price);
                          return (
                            <tr key={item.id} className="border-b border-gray-50 last:border-0">
                              <td className="px-4 py-3">
                                <div className="flex flex-col text-right">
                                  <span className="text-sm font-bold">{item.name}</span>
                                  <span className="text-[10px] text-gray-400">{item.category}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">{item.start_qty}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">{item.purchase_qty}</td>
                              <td className="px-4 py-3 text-center text-sm font-bold">{item.sales_qty}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">{item.actual_qty}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">{item.cost_price || 0}</td>
                              <td className="px-4 py-3 text-center text-sm font-bold text-blue-600 font-mono">{item.selling_price || item.price || 0}</td>
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

      {/* Employee Management Modal */}
      <AnimatePresence>
        {isEmployeeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEmployeeModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingEmployee?.id ? 'تعديل موظف' : 'إضافة موظف جديد'}</h3>
                <button onClick={() => setIsEmployeeModalOpen(false)} className="text-gray-400 hover:text-black transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={saveEmployee} className="p-8 space-y-6 overflow-y-auto flex-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">اسم الموظف / المستخدم</label>
                  <input 
                    required
                    type="text"
                    value={editingEmployee?.name || ''}
                    onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                    placeholder="مثال: أحمد محمد"
                  />
                </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">اسم المستخدم</label>
                      <input 
                        type="text"
                        value={editingEmployee?.username || ''}
                        onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, username: e.target.value } : null)}
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                        placeholder="admin"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">كلمة المرور</label>
                      <input 
                        type="password"
                        value={editingEmployee?.password || ''}
                        onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, password: e.target.value } : null)}
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">الدور الوظيفي</label>
                    <select 
                      value={editingEmployee?.role || 'staff'}
                      onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, role: e.target.value } : null)}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all appearance-none"
                    >
                      <option value="staff">موظف (Staff)</option>
                      <option value="admin">مدير (Admin)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">رمز الدخول (PIN)</label>
                    <input 
                      type="password"
                      maxLength={4}
                      value={editingEmployee?.pin || ''}
                      onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, pin: e.target.value } : null)}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none transition-all text-center tracking-[1em] font-bold"
                      placeholder="••••"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block pb-2 border-b border-gray-100">صلاحيات الوصول</label>
                  
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Package size={18} className="text-gray-400" />
                      <div>
                        <div className="text-sm font-bold">إدارة المنتجات</div>
                        <div className="text-[10px] text-gray-400">إضافة، تعديل، وحذف الأصناف والمكونات</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editingEmployee?.can_manage_products || false}
                        onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, can_manage_products: e.target.checked } : null)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <History size={18} className="text-gray-400" />
                      <div>
                        <div className="text-sm font-bold">عرض التقارير</div>
                        <div className="text-[10px] text-gray-400">الاطلاع على سجل الورديات والأرشفة</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editingEmployee?.can_view_reports || false}
                        onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, can_view_reports: e.target.checked } : null)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Shield size={18} className="text-gray-400" />
                      <div>
                        <div className="text-sm font-bold">إدارة الموظفين</div>
                        <div className="text-[10px] text-gray-400">التحكم في حسابات الموظفين وصلاحياتهم</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editingEmployee?.can_manage_employees || false}
                        onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, can_manage_employees: e.target.checked } : null)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10 disabled:opacity-50"
                  >
                    {saving && <RefreshCw size={18} className="animate-spin" />}
                    <Save size={18} /> {editingEmployee?.id ? 'حفظ التعديلات' : 'إضافة الموظف'}
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

function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        const data = await res.json();
        onLogin(data.user);
      } else {
        const data = await res.json();
        setError(data.error || 'حدث خطأ ما');
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 overflow-hidden relative" dir="rtl">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
          <div className="bg-black p-12 text-center relative overflow-hidden">
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gray-900 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gray-900 rounded-full -ml-12 -mb-12"></div>
            
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
                <TrendingUp className="text-white w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">سجل<span className="text-gray-500">الوردية</span></h1>
                <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest font-bold">نظام إدارة المخزون المتقدم</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-12 space-y-8">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">اسم المستخدم</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-4 flex items-center text-gray-400 group-focus-within:text-black transition-colors">
                    <UserIcon size={18} />
                  </div>
                  <input 
                    required
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent rounded-[1.25rem] pr-12 pl-4 py-4 focus:bg-white focus:border-black outline-none transition-all font-medium text-gray-900"
                    placeholder="أدخل اسم المستخدم"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">كلمة المرور</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-4 flex items-center text-gray-400 group-focus-within:text-black transition-colors">
                    <Lock size={18} />
                  </div>
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent rounded-[1.25rem] pr-12 pl-4 py-4 focus:bg-white focus:border-black outline-none transition-all font-medium text-gray-900"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-5 rounded-[1.25rem] font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-black/10 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <>
                  <Check size={20} />
                  <span>دخول للنظام</span>
                </>
              )}
            </button>

            <div className="text-center pt-4">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                هذا النظام مخصص للمصرح لهم فقط.<br />
                جميع العمليات يتم تسجيلها ومراقبتها.
              </p>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
