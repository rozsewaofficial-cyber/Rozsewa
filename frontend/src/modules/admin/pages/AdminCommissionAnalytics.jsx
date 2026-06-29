import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import API from '@/lib/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, DollarSign, Users, Award, Calendar, RefreshCw, Filter, 
  Activity, ArrowUpRight, ArrowDownRight, AwardIcon, FileText 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#374151'];

export default function AdminCommissionAnalytics() {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedSubPlan, setSelectedSubPlan] = useState('');

  // Dropdown lists
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [subPlans, setSubPlans] = useState([]);

  useEffect(() => {
    setTitle("Commission Analytics");
    fetchDropdowns();
    fetchAnalytics();
  }, [setTitle]);

  const fetchDropdowns = async () => {
    try {
      const [catsRes, subsRes, provsRes] = await Promise.all([
        API.get('/admin/categories'),
        API.get('/admin/subscriptions'),
        API.get('/admin/providers')
      ]);
      setCategories(catsRes.data || []);
      setSubPlans(subsRes.data || []);
      setProviders(provsRes.data.providers || provsRes.data || []);
    } catch (err) {
      console.error("Error loading dropdown data:", err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (selectedCategory) params.categoryId = selectedCategory;
      if (selectedProvider) params.providerId = selectedProvider;
      if (selectedSubPlan) params.subscriptionId = selectedSubPlan;

      const { data } = await API.get('/v2/admin/commission/analytics', { params });
      setAnalytics(data);
    } catch (err) {
      toast({ title: "Failed to load analytics", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchAnalytics();
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
    setSelectedProvider('');
    setSelectedSubPlan('');
    setTimeout(() => {
      fetchAnalytics();
    }, 50);
  };

  if (loading && !analytics) {
    return (
      <div className="flex justify-center items-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!loading && !analytics) {
    return (
        <div className="flex justify-center items-center h-96">
            <div className="text-center text-slate-500 font-medium">Failed to load analytics data.</div>
        </div>
    );
  }

  const kpis = analytics?.kpis || {};
  const providerKpis = analytics?.providerKpis || {};
  const charts = analytics?.charts || {};

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-emerald-600" /> Revenue & Commission Analytics
          </h1>
          <p className="text-slate-500 text-sm mt-1">Audit Gross Marketplace Value, platform commission, and subscription recurring earnings.</p>
        </div>
        <button onClick={fetchAnalytics} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-50 transition text-sm font-bold text-slate-600">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Filters Form */}
      <form onSubmit={handleApplyFilters} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Filter className="h-4 w-4 text-emerald-600" /> Filter Analytics
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border p-2 rounded-lg text-xs bg-white text-slate-600 outline-emerald-500" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border p-2 rounded-lg text-xs bg-white text-slate-600 outline-emerald-500" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full border p-2 rounded-lg text-xs bg-white text-slate-600 outline-emerald-500">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Provider</label>
            <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} className="w-full border p-2 rounded-lg text-xs bg-white text-slate-600 outline-emerald-500">
              <option value="">All Providers</option>
              {providers.map(p => <option key={p._id} value={p._id}>{p.shopName || p.ownerName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Subscription Plan</label>
            <select value={selectedSubPlan} onChange={e => setSelectedSubPlan(e.target.value)} className="w-full border p-2 rounded-lg text-xs bg-white text-slate-600 outline-emerald-500">
              <option value="">All Plans</option>
              {subPlans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={handleResetFilters} className="px-4 py-2 border rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition">
            Reset
          </button>
          <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition">
            Apply Filters
          </button>
        </div>
      </form>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Gross Marketplace Value (GMV)", value: `₹${(kpis.gmv || 0).toLocaleString()}`, desc: "Total transaction booking amount", color: "text-blue-600 bg-blue-50 border-blue-100" },
          { title: "Platform Revenue", value: `₹${(kpis.platformRevenue || 0).toLocaleString()}`, desc: "Calculated commission collected", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { title: "Subscription Revenue", value: `₹${(kpis.subscriptionRevenue || 0).toLocaleString()}`, desc: "Purchased annual/monthly plans fees", color: "text-purple-600 bg-purple-50 border-purple-100" },
          { title: "Net Revenue", value: `₹${(kpis.netRevenue || 0).toLocaleString()}`, desc: "Commission + Subscriptions earnings", color: "text-amber-600 bg-amber-50 border-amber-100" },
          { title: "Total Provider Payouts", value: `₹${(kpis.payouts || 0).toLocaleString()}`, desc: "Earnings transferred to partners", color: "text-slate-600 bg-slate-50 border-slate-100" },
          { title: "Avg. Commission Cut", value: `${kpis.avgCommissionPercent || 0}%`, desc: "Average cut percentage per booking", color: "text-rose-600 bg-rose-50 border-rose-100" },
          { title: "Avg. Booking Value", value: `₹${(kpis.avgBookingValue || 0).toLocaleString()}`, desc: "Average completed job ticket", color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
          { title: "Subscription MRR", value: `₹${(kpis.mrr || 0).toLocaleString()}`, desc: "Subscriptions normalized monthly", color: "text-teal-600 bg-teal-50 border-teal-100" }
        ].map((kpi, idx) => (
          <div key={idx} className={`p-5 rounded-xl border flex flex-col justify-between space-y-2 shadow-sm ${kpi.color}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{kpi.title}</p>
              <h3 className="text-2xl font-black mt-1">{kpi.value}</h3>
            </div>
            <p className="text-[10px] opacity-85 font-medium leading-none">{kpi.desc}</p>
          </div>
        ))}
      </div>

      {/* Provider KPI States */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-4">
          <Users className="h-4.5 w-4.5 text-blue-600" /> Active Provider States
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Active Subscribers", count: providerKpis.subscribedCount || 0, color: "text-purple-600 bg-purple-50" },
            { label: "Trial Providers", count: providerKpis.trialCount || 0, color: "text-emerald-600 bg-emerald-50" },
            { label: "Providers on Override", count: providerKpis.overrideCount || 0, color: "text-amber-600 bg-amber-50" },
            { label: "Providers on Waiver", count: providerKpis.waiverCount || 0, color: "text-rose-600 bg-rose-50" },
            { label: "Total Active Providers", count: providerKpis.activeProviders || 0, color: "text-slate-600 bg-slate-50" }
          ].map((item, idx) => (
            <div key={idx} className={`p-4 rounded-xl border border-slate-100 text-center ${item.color}`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase">{item.label}</p>
              <h4 className="text-xl font-black mt-1 text-slate-800">{item.count}</h4>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-emerald-600" /> Revenue & GMV Trends
          </h3>
          <div className="h-80">
            {!charts.monthlyTrends || charts.monthlyTrends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">No trend data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="revenue" name="Platform Revenue" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="gmv" name="GMV Sales" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Rule Usage Distribution */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Award className="h-4 w-4 text-blue-600" /> Revenue by Commission Rule Source
          </h3>
          <div className="h-80">
            {!charts.ruleDistribution || charts.ruleDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">No rule metrics available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.ruleDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="source" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                  <Bar dataKey="revenue" name="Commission Volume (₹)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-purple-600" /> Revenue by Category
          </h3>
          <div className="h-80 flex flex-col md:flex-row items-center justify-around gap-4">
            {!charts.categoryBreakdown || charts.categoryBreakdown.length === 0 ? (
              <div className="text-xs text-slate-400 font-bold flex items-center justify-center h-full w-full">No category revenue available</div>
            ) : (
              <>
                <div className="w-full md:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {charts.categoryBreakdown?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2">
                  {charts.categoryBreakdown?.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span>{item.name}:</span>
                      <span className="text-slate-800 font-black">₹{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Subscriptions Plans performance */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <AwardIcon className="h-4 w-4 text-purple-600" /> Subscription Revenue by Plan
          </h3>
          <div className="h-80">
            {!charts.subscriptionPlanBreakdown || charts.subscriptionPlanBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">No subscription plan data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.subscriptionPlanBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                  <Bar dataKey="value" name="Sales (₹)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
