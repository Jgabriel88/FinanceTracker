'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

const HOUSEHOLD_ID = '11111111-1111-1111-1111-111111111111';

interface Category {
  id: string;
  name: string;
  type: string;
  monthly_budget_cap: number;
}

interface Transaction {
  id: string;
  amount: number;
  is_income: boolean;
  note: string | null;
  date: string;
  category_id: string | null;
}

export default function Home() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Transaction Form State
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txIsIncome, setTxIsIncome] = useState(false);
  const [txSubmitting, setTxSubmitting] = useState(false);

  // New Budget Envelope Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatCap, setNewCatCap] = useState('');
  const [newCatType, setNewCatType] = useState('need');
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);

  // Ledger Filter
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');

  async function fetchData() {
    setLoading(true);
    setErrorMessage(null);

    const [catRes, txRes] = await Promise.all([
      supabase.from('categories').select('*').eq('household_id', HOUSEHOLD_ID).order('name'),
      supabase.from('transactions').select('*').eq('household_id', HOUSEHOLD_ID).order('date', { ascending: false }),
    ]);

    if (catRes.error) {
      setErrorMessage(`Failed to load categories: ${catRes.error.message}`);
    } else {
      setCategories(catRes.data || []);
      if (catRes.data && catRes.data.length > 0 && !txCategory) {
        setTxCategory(catRes.data[0].id);
      }
    }

    if (txRes.error) {
      setErrorMessage((prev) => (prev ? `${prev} | ` : '') + `Failed to load transactions: ${txRes.error.message}`);
    } else {
      setTransactions(txRes.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Submit Transaction
  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!txAmount || isNaN(Number(txAmount))) return;

    setTxSubmitting(true);
    setErrorMessage(null);

    const payload = {
      household_id: HOUSEHOLD_ID,
      category_id: txIsIncome ? null : txCategory || null,
      amount: parseFloat(txAmount),
      is_income: txIsIncome,
      date: txDate,
      note: txNote.trim() || null,
    };

    const { error } = await supabase.from('transactions').insert(payload);

    if (error) {
      setErrorMessage(`Error logging transaction: ${error.message}`);
    } else {
      setTxAmount('');
      setTxNote('');
      await fetchData();
    }
    setTxSubmitting(false);
  }

  // Submit New Category Envelope
  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName || !newCatCap) return;

    setCatSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.from('categories').insert({
      household_id: HOUSEHOLD_ID,
      name: newCatName.trim(),
      type: newCatType,
      monthly_budget_cap: parseFloat(newCatCap),
    });

    if (error) {
      setErrorMessage(`Error creating envelope: ${error.message}`);
    } else {
      setNewCatName('');
      setNewCatCap('');
      setShowAddCat(false);
      await fetchData();
    }
    setCatSubmitting(false);
  }

  // Delete Transaction
  async function handleDeleteTransaction(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      setErrorMessage(`Error deleting transaction: ${error.message}`);
    } else {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    }
  }

  // Calculations
  const totalIncome = transactions
    .filter((t) => t.is_income)
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const totalSpent = transactions
    .filter((t) => !t.is_income)
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const totalBudgetCap = categories.reduce((acc, curr) => acc + Number(curr.monthly_budget_cap), 0);
  const netRemaining = totalIncome - totalSpent;

  // Category spend map
  const categorySpend: Record<string, number> = {};
  transactions.forEach((tx) => {
    if (!tx.is_income && tx.category_id) {
      categorySpend[tx.category_id] = (categorySpend[tx.category_id] || 0) + Number(tx.amount);
    }
  });

  // Current Month Forecast Logic
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - currentDay;
  const dailyRunRate = currentDay > 0 ? totalSpent / currentDay : 0;
  const forecastedMonthEndSpend = totalSpent + dailyRunRate * daysRemaining;

  const filteredTransactions = transactions.filter((t) => {
    if (filterType === 'expense') return !t.is_income;
    if (filterType === 'income') return t.is_income;
    return true;
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex justify-between items-center">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-xs uppercase font-bold text-rose-400 hover:text-rose-200">
              Dismiss
            </button>
          </div>
        )}

        {/* Top Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-zinc-800">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Family Budget & Cash Flow</h1>
            <p className="text-xs text-zinc-400">Zero-based household allocation & live transaction tracking</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddCat(!showAddCat)}
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
            >
              {showAddCat ? 'Close Form' : '+ New Budget Envelope'}
            </button>
          </div>
        </header>

        {/* Add Category Drawer */}
        {showAddCat && (
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-zinc-100">Create a New Budget Envelope</h3>
            <form onSubmit={handleAddCategory} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-2xs text-zinc-400 mb-1">Envelope Name</label>
                <input
                  type="text"
                  placeholder="e.g. Vehicle Insurance, Daycare"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-2xs text-zinc-400 mb-1">Monthly Budget Limit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  required
                  value={newCatCap}
                  onChange={(e) => setNewCatCap(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-2xs text-zinc-400 mb-1">Type</label>
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100"
                >
                  <option value="need">Fixed Need</option>
                  <option value="want">Discretionary Want</option>
                  <option value="investment">Savings / Investment</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={catSubmitting}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs rounded-lg text-white transition disabled:opacity-50"
                >
                  {catSubmitting ? 'Saving...' : 'Save Envelope'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Financial Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Inflow</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Actual Spent</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">
              ${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-2xs text-zinc-500 mt-1">Total Cap: ${totalBudgetCap.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Net Savings</p>
            <p className={`text-2xl font-bold mt-1 ${netRemaining >= 0 ? 'text-zinc-100' : 'text-rose-500'}`}>
              ${netRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Month-End Forecast</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              ${forecastedMonthEndSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-2xs text-zinc-500 mt-1">{daysRemaining} days left at ${dailyRunRate.toFixed(0)}/day</p>
          </div>
        </div>

        {/* Main Workspace: Left = Form, Right = Envelopes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Quick-Log Form */}
          <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4 h-fit">
            <h2 className="text-sm font-semibold text-zinc-200">Log Transaction</h2>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="flex rounded-lg bg-zinc-800 p-1">
                <button
                  type="button"
                  onClick={() => setTxIsIncome(false)}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${!txIsIncome ? 'bg-zinc-700 text-white shadow-xs' : 'text-zinc-400'}`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setTxIsIncome(true)}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${txIsIncome ? 'bg-zinc-700 text-white shadow-xs' : 'text-zinc-400'}`}
                >
                  Income
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              {!txIsIncome && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Envelope Category</label>
                  {categories.length === 0 ? (
                    <p className="text-2xs text-amber-400">Click &quot;+ New Budget Envelope&quot; above to create one first.</p>
                  ) : (
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (${c.monthly_budget_cap}/mo)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Note / Merchant</label>
                <input
                  type="text"
                  placeholder="e.g. Costco, Superstore, Bonus"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                />
              </div>

              <button
                type="submit"
                disabled={txSubmitting}
                className="w-full py-2.5 bg-zinc-100 text-zinc-950 font-semibold text-xs rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {txSubmitting ? 'Recording to Supabase...' : 'Add Transaction'}
              </button>
            </form>
          </div>

          {/* Envelopes & Forecast Visualizer */}
          <div className="lg:col-span-2 space-y-6">

            {/* Envelope Spending Caps */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold text-zinc-200">Budget Envelopes</h2>
                <span className="text-2xs text-zinc-500">{categories.length} Envelopes Allocated</span>
              </div>

              {categories.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">
                  No budget envelopes created yet. Click &quot;+ New Budget Envelope&quot; to define your categories.
                </p>
              ) : (
                <div className="space-y-4">
                  {categories.map((cat) => {
                    const spent = categorySpend[cat.id] || 0;
                    const cap = Number(cat.monthly_budget_cap);
                    const percent = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
                    const isOver = spent > cap;

                    return (
                      <div key={cat.id} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-zinc-300">
                            {cat.name} <span className="text-2xs text-zinc-500 uppercase">({cat.type})</span>
                          </span>
                          <span className={isOver ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                            ${spent.toFixed(2)} /${cap.toFixed(2)} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOver ? 'bg-rose-500' : percent > 85 ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filterable Full Transaction Ledger */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-200">Transaction Ledger</h2>
                <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`text-2xs px-2.5 py-1 rounded-md font-medium transition ${filterType === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType('expense')}
                    className={`text-2xs px-2.5 py-1 rounded-md font-medium transition ${filterType === 'expense' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
                  >
                    Expenses
                  </button>
                  <button
                    onClick={() => setFilterType('income')}
                    className={`text-2xs px-2.5 py-1 rounded-md font-medium transition ${filterType === 'income' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">No transactions recorded under this filter.</p>
              ) : (
                <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto pr-1">
                  {filteredTransactions.map((tx) => {
                    const categoryName = categories.find((c) => c.id === tx.category_id)?.name || 'General Inflow';

                    return (
                      <div key={tx.id} className="py-3 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-medium text-zinc-200">{tx.note || 'Unnamed Transaction'}</p>
                          <p className="text-2xs text-zinc-500">
                            {tx.date} • <span className="text-zinc-400">{categoryName}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-semibold ${tx.is_income ? 'text-emerald-400' : 'text-zinc-200'}`}>
                            {tx.is_income ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                          </span>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            title="Delete entry"
                            className="text-zinc-600 hover:text-rose-400 transition text-sm px-1"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}