import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { CreditCard, TrendingUp, Users, IndianRupee, Loader2 } from "lucide-react";
import API from "@/lib/api";

const Admin99Card = () => {
    const { setTitle } = useOutletContext();
    const [stats, setStats] = useState({
        totalSales: 0,
        activeSubscribers: 0,
        totalRevenue: 0,
        recentActivations: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTitle("Vendor Registration Card");
        fetchCardData();
    }, [setTitle]);

    const fetchCardData = async () => {
        try {
            const { data } = await API.get("/admin/99cards");
            setStats(data);
        } catch (err) {
            console.error("Card Stats Loading Error:", err);
        } finally {
            setLoading(false);
        }
    };

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/50 p-6 shadow-sm hover:shadow-md transition-all">
                    <IndianRupee className="h-8 w-8 text-amber-600 mb-4" />
                    <p className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-1">Card Revenue</p>
                    <h2 className="text-4xl font-black text-amber-900">₹{(stats.totalRevenue / 100000).toFixed(1)}L</h2>
                    <p className="text-xs text-amber-600 font-bold mt-2">All time generated (₹{stats.cardPrice || 99}/unit)</p>
                </div>
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
                                <th className="px-6 py-4 font-bold">Referral Used</th>
                                <th className="px-6 py-4 font-bold">Free Bookings</th>
                                <th className="px-6 py-4 font-bold">Status</th>
                                <th className="px-6 py-4 font-bold">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats.recentActivations.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-400 font-bold">No card activations yet.</td>
                                </tr>
                            ) : (
                                stats.recentActivations.map((item, i) => (
                                    <tr key={item._id} className="hover:bg-gray-50/50 transition">
                                        <td className="px-6 py-4 font-mono font-bold text-emerald-700">{item.vendorCode || 'N/A'}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900">{item.shopName}</td>
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
                                            <div className="flex items-center gap-1.5">
                                                <div className={`h-1.5 w-1.5 rounded-full ${i < 3 ? 'bg-emerald-500' : 'bg-gray-300'} animate-pulse`}></div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Live</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                            {item.joinedDate ? new Date(item.joinedDate).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Admin99Card;
