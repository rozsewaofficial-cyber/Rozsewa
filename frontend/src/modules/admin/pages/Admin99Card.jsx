import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { CreditCard, TrendingUp, Users, IndianRupee, Loader2, ChevronLeft, ChevronRight, MapPin, X, ShieldAlert } from "lucide-react";
import API from "@/lib/api";

const Admin99Card = () => {
    const { setTitle } = useOutletContext();
    const [stats, setStats] = useState({
        totalSales: 0,
        activeSubscribers: 0,
        totalExpired: 0,
        totalRevenue: 0,
        recentActivations: [],
        cities: []
    });
    const [loading, setLoading] = useState(true);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filters
    const [cityFilter, setCityFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [cardStatus, setCardStatus] = useState("all");
    const hasFilters = cityFilter !== "all" || dateFrom || dateTo || cardStatus !== "all";

    useEffect(() => {
        setTitle("Vendor Registration Card");
    }, [setTitle]);

    useEffect(() => {
        setCurrentPage(1);
        fetchCardData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cityFilter, dateFrom, dateTo, cardStatus]);

    const fetchCardData = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/99cards", {
                params: {
                    ...(cityFilter !== "all" ? { city: cityFilter } : {}),
                    ...(dateFrom ? { from: dateFrom } : {}),
                    ...(dateTo ? { to: dateTo } : {}),
                    ...(cardStatus !== "all" ? { cardStatus } : {})
                }
            });
            setStats(data);
        } catch (err) {
            console.error("Card Stats Loading Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(stats.recentActivations.length / itemsPerPage);
    const paginatedActivations = useMemo(() => {
        return stats.recentActivations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [stats.recentActivations, currentPage]);

    if (loading) return (
        <div className="flex h-96 flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
            <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Loading Registration Metrics...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-foreground">Vendor Card Management</h1>
                <p className="text-sm text-muted-foreground mt-1">Track mandatory vendor subscription metrics and referral networks.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-6 shadow-sm hover:shadow-md transition-all">
                    <CreditCard className="h-8 w-8 text-emerald-600 mb-4" />
                    <p className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-1">Total Sales</p>
                    <h2 className="text-4xl font-black text-emerald-900">{stats.totalSales.toLocaleString()}</h2>
                    <p className="text-xs text-emerald-600 font-bold mt-2"><TrendingUp className="h-3 w-3 inline mr-1" />Growth tracking active</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-6 shadow-sm hover:shadow-md transition-all">
                    <Users className="h-8 w-8 text-blue-600 mb-4" />
                    <p className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-1">Active Subscribers</p>
                    <h2 className="text-4xl font-black text-blue-900">{stats.activeSubscribers.toLocaleString()}</h2>
                    <p className="text-xs text-blue-600 font-bold mt-2">Verified & Online Responders</p>
                </div>
                <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50/50 p-6 shadow-sm hover:shadow-md transition-all">
                    <ShieldAlert className="h-8 w-8 text-red-600 mb-4" />
                    <p className="text-sm font-bold text-red-800 uppercase tracking-wider mb-1">Expired Cards</p>
                    <h2 className="text-4xl font-black text-red-900">{stats.totalExpired.toLocaleString()}</h2>
                    <p className="text-xs text-red-600 font-bold mt-2">Valid for {stats.cardValidityDays || 365} days from registration</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/50 p-6 shadow-sm hover:shadow-md transition-all">
                    <IndianRupee className="h-8 w-8 text-amber-600 mb-4" />
                    <p className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-1">Card Revenue</p>
                    <h2 className="text-4xl font-black text-amber-900">₹{(stats.totalRevenue / 100000).toFixed(1)}L</h2>
                    <p className="text-xs text-amber-600 font-bold mt-2">Within current filter (₹{stats.cardPrice || 99}/unit)</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm">
                    {["all", "active", "expired"].map((s) => (
                        <button
                            key={s}
                            onClick={() => setCardStatus(s)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${cardStatus === s ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-52">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                    <select
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        className="block w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm font-bold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
                    >
                        <option value="all">All Cities</option>
                        {(stats.cities || []).map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        max={dateTo || undefined}
                        className="rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm font-bold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
                    />
                    <span className="text-xs font-bold text-gray-400">to</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        min={dateFrom || undefined}
                        className="rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm font-bold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
                    />
                </div>

                {hasFilters && (
                    <button
                        onClick={() => { setCityFilter("all"); setDateFrom(""); setDateTo(""); setCardStatus("all"); }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-all self-start sm:self-auto"
                    >
                        <X className="h-3 w-3" /> Clear
                    </button>
                )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden mt-8">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-900">Recent Card Activations</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-bold">Vendor Code</th>
                                <th className="px-6 py-4 font-bold">Shop Name</th>
                                <th className="px-6 py-4 font-bold">City</th>
                                <th className="px-6 py-4 font-bold">Referral Used</th>
                                <th className="px-6 py-4 font-bold">Free Bookings</th>
                                <th className="px-6 py-4 font-bold">Card Status</th>
                                <th className="px-6 py-4 font-bold">Registered</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats.recentActivations.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-400 font-bold">No card activations yet.</td>
                                </tr>
                            ) : (
                                paginatedActivations.map((item) => {
                                    const isExpired = item.vendorCardExpiry && new Date(item.vendorCardExpiry) < new Date();
                                    return (
                                    <tr key={item._id} className="hover:bg-gray-50/50 transition">
                                        <td className="px-6 py-4 font-mono font-bold text-emerald-700">{item.vendorCode || 'N/A'}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900">{item.shopName}</td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-600">{item.city || 'N/A'}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-700">
                                                {item.referredBy || 'Organic'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest ${item.freeServicesLeft > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {item.freeServicesLeft > 0 ? `${item.freeServicesLeft} Left` : '0/3'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest ${isExpired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {isExpired ? 'Expired' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                            {item.joinedDate ? new Date(item.joinedDate).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between bg-white px-6 py-4 border-t border-gray-100">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                            Showing <span className="text-gray-900 font-black">{((currentPage - 1) * itemsPerPage) + 1}</span> to{" "}
                            <span className="text-gray-900 font-black">
                                {Math.min(currentPage * itemsPerPage, stats.recentActivations.length)}
                            </span>{" "}
                            of <span className="text-gray-900 font-black">{stats.recentActivations.length}</span> activations
                        </p>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                if (totalPages > 5 && Math.abs(page - currentPage) > 2 && page !== 1 && page !== totalPages) {
                                    if (page === 2 || page === totalPages - 1) return <span key={page} className="px-1 text-slate-400">...</span>;
                                    return null;
                                }
                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`h-8 min-w-8 px-2.5 flex items-center justify-center rounded-lg text-[10px] font-black transition-all shadow-sm ${
                                            page === currentPage
                                                ? "bg-blue-600 text-white border border-blue-600"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Admin99Card;
