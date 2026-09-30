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
  note: string;
  date: string;
  category_id: string;
}

interface InvestmentTarget {
  id: string;
  name: string;
  current_balance: number;
  target_goal: number;
  monthly_target_contribution: number;
}

export default function Home() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<InvestmentTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [note, setNote] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load data
  async function loadDashboardData() {
    const [catRes, txRes, invRes] = await Promise.all([
      supabase.from('categories').select('*').eq('household_id', HOUSEHOLD_ID),
      supabase.from('transactions').select('*').eq('household_id', HOUSEHOLD_ID).order('date', { ascending: false }),
      supabase.from('investment_targets').select('*').eq('household_id', HOUSEHOLD_ID),
    ]);

    if (catRes.data) {
      setCategories(catRes.data);
      if (catRes.data.length > 0 && !selectedCategory) {
        setSelectedCategory(catRes.data[0].id);
      }
    }
    if (txRes.data) setTransactions(txRes.data);
    if (invRes.data) setInvestments(invRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Handle logging a new expense/income
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    setSubmitting(true);
    const { error } = await supabase.from('transactions').insert({
      household_id: HOUSEHOLD_ID,
      category_id: selectedCategory || null,
      amount: parseFloat(amount),
      is_income: isIncome,
      date: new Date().toISOString().split('T')[0],
      note: note.trim() || null,
    });

    if (!error) {
      setAmount('');
      setNote('');
      await loadDashboardData();
    }
    setSubmitting(false);
  }

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.is_income)
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const totalExpenses = transactions
    .filter((t) => !t.is_income)
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const netSavings = totalIncome - totalExpenses;

  // Category spend map
  const categorySpend: Record<string, number> = {};
  transactions.forEach((tx) => {
    if (!tx.is_income && tx.category_id) {
      categorySpend[tx.category_id] = (categorySpend[tx.category_id] || 0) + Number(tx.amount);
    }
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Loading your household finances...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Household Finance Hub</h1>
            <p className="text-xs text-zinc-400">Zero-based budget and expense tracker</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Live Sync
          </span>
        </header>

        {/* Financial Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Income</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Outflow</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">
              ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Net Remaining</p>
            <p className={`text-2xl font-bold mt-1 ${netSavings >= 0 ? 'text-zinc-100' : 'text-rose-500'}`}>
              ${netSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Main Grid: Form + Envelopes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Quick-Log Transaction Box */}
          <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4 h-fit">
            <h2 className="text-sm font-semibold text-zinc-200">Log an Entry</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex rounded-lg bg-zinc-800 p-1">
                <button
                  type="button"
                  onClick={() => setIsIncome(false)}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${!isIncome ? 'bg-zinc-700 text-white shadow-xs' : 'text-zinc-400'}`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setIsIncome(true)}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${isIncome ? 'bg-zinc-700 text-white shadow-xs' : 'text-zinc-400'}`}
                >
                  Income
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-zinc-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
              </div>

              {!isIncome && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Budget Envelope</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} (${cat.monthly_budget_cap}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Costco, Paycheck, Gas"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-zinc-100 text-zinc-950 font-semibold text-xs rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Add Transaction'}
              </button>
            </form>
          </div>

          {/* Envelopes and Goals Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Category Budgets */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4">
              <h2 className="text-sm font-semibold text-zinc-200">Envelope Budgets</h2>
              <div className="space-y-3">
                {categories.map((cat) => {
                  const spent = categorySpend[cat.id] || 0;
                  const cap = Number(cat.monthly_budget_cap);
                  const percent = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
                  const isOver = spent > cap;

                  return (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-zinc-300">{cat.name}</span>
                        <span className={isOver ? 'text-rose-400 font-semibold' : 'text-zinc-400'}>
                          ${spent.toFixed(2)} /${cap.toFixed(2)} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOver ? 'bg-rose-500' : percent > 80 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Investment Targets */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-3">
              <h2 className="text-sm font-semibold text-zinc-200">Investment & Savings Goals</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {investments.map((inv) => (
                  <div key={inv.id} className="p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg">
                    <p className="text-xs font-medium text-zinc-400">{inv.name}</p>
                    <p className="text-lg font-bold text-zinc-100 mt-1">
                      ${Number(inv.current_balance).toLocaleString()}
                    </p>
                    <p className="text-2xs text-zinc-500 mt-1">
                      Target: ${Number(inv.target_goal).toLocaleString()} • Rec: ${Number(inv.monthly_target_contribution)}/mo
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Ledger History */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-3">
              <h2 className="text-sm font-semibold text-zinc-200">Recent Transactions</h2>
              {transactions.length === 0 ? (
                <p className="text-xs text-zinc-500">No transactions recorded yet.</p>
              ) : (
                <div className="divide-y divide-zinc-800 text-xs">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="py-2.5 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-zinc-200">{tx.note || 'Unspecified transaction'}</p>
                        <p className="text-zinc-500 text-2xs">{tx.date}</p>
                      </div>
                      <span className={`font-semibold ${tx.is_income ? 'text-emerald-400' : 'text-zinc-200'}`}>
                        {tx.is_income ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}