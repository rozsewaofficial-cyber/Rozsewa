import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Users, UserCheck, CalendarDays, IndianRupee, ArrowUpRight, Activity, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const statusColors = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    started: "bg-blue-50 text-blue-700 border-blue-200",
    on_the_way: "bg-cyan-50 text-cyan-700 border-cyan-200",
    confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
    active: "bg-blue-50 text-blue-700 border-blue-200",
};

const AdminDashboard = () => {
    const { setTitle } = useOutletContext();
    const { user } = useAuth();
    const [recentBookings, setRecentBookings] = useState([]);
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalProviders: 0,
        activeBookings: 0,
        pendingProviders: 0,
        revenue: 0
    });
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        setTitle("Dashboard");
        const fetchData = async () => {
            try {
                const { data: statsData } = await API.get("/admin/stats");
                setStats(statsData);

                const { data: bookingsData } = await API.get("/admin/bookings?limit=5");
                const bookings = (bookingsData.bookings || bookingsData || []).slice(0, 5);
                setRecentBookings(bookings);
            } catch (err) {
                console.error("Failed to fetch admin stats", err);
            }
        };
        fetchData();
    }, [setTitle]);

    const formattedDate = currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-12">
            {/* Welcome Section */}
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Welcome back, {user?.name || "Admin"} 👋</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">
                        {user?.role === 'supervisor' 
                            ? "Here's the activity and status of the team under you today."
                            : "Here's the overall activity and status on RozSewa today."}
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{formattedDate}</p>
                        <p className="text-sm font-bold text-gray-900 leading-none">{formattedTime}</p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Users", link: "/admin/users", value: stats.totalUsers.toLocaleString(), icon: Users, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Total Providers", link: "/admin/providers", value: stats.totalProviders.toLocaleString(), icon: UserCheck, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Active Bookings", link: "/admin/bookings", value: stats.activeBookings.toLocaleString(), icon: CalendarDays, cls: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Daily Revenue", link: "/admin/finance", value: `₹${stats.revenue.toLocaleString()}`, icon: IndianRupee, cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
                ].map((s, i) => (
                    <Link to={s.link} key={i} className={`block rounded-xl border p-4 ${s.cls} shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer`}>
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                                <s.icon className="h-4 w-4 opacity-70" />
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{s.label}</p>
                            </div>
                            <TrendingUp className="h-3 w-3 opacity-50" />
                        </div>
                        <h3 className="text-2xl font-black">{s.value}</h3>
                    </Link>
                ))}
            </div>

            {/* Two Column Layout for Desktop */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">

                {/* Recent Bookings List */}
                <div className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-gray-900">Recent Bookings</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Live platform activity</p>
                            </div>
                        </div>
                        <Link to="/admin/bookings" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 hover:bg-blue-100 transition-colors">
                            View All <ArrowUpRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Booking ID</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">User & Provider</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Service Info</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Amount</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentBookings.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">No recent bookings found</td></tr>
                                ) : recentBookings.map((b) => (
                                    <tr key={b._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs font-black text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                                #{(b._id || '').toString().slice(-6).toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-extrabold text-gray-900 tracking-tight">{b.userId?.name || 'Customer'}</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mt-0.5">via {b.providerId?.shopName || b.providerId?.ownerName || 'Provider'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-700">{b.serviceName || 'Service'}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <CalendarDays className="h-3 w-3 text-gray-400" />
                                                <p className="text-[10px] font-bold text-gray-500">{b.bookingDate} • {b.bookingTime}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-black text-gray-900">₹{(b.totalAmount || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border ${statusColors[b.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                {b.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Actions & Alerts */}
                <div className="space-y-6">
                    {/* Pending Approvals */}
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-gray-900">Pending Approvals</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Action Required</p>
                            </div>
                            <AlertTriangle className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="p-6">
                            {stats.pendingProviders > 0 ? (
                                <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 border border-amber-200">
                                            <AlertTriangle className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-amber-900 tracking-tight">{stats.pendingProviders} Applications</p>
                                            <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mt-0.5">Awaiting Review</p>
                                        </div>
                                    </div>
                                    <Link to="/admin/providers" className="flex shrink-0 h-8 w-8 items-center justify-center rounded-lg bg-white text-amber-600 shadow-sm hover:bg-amber-100 border border-amber-200 transition-colors">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
                                        <ShieldCheck className="h-6 w-6" />
                                    </div>
                                    <h4 className="text-sm font-black text-gray-900">All caught up!</h4>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">No pending applications</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Platform Health */}
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 shadow-sm overflow-hidden">
                        <div className="p-6">
                            <h3 className="text-sm font-black text-blue-900 mb-1">Platform Health</h3>
                            <p className="text-xs text-blue-700 mb-4 font-medium">All systems are running smoothly. No critical issues reported today.</p>
                            <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-blue-800 border border-blue-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                                    API Online
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-800 border border-emerald-200">
                                    <ShieldCheck className="h-3 w-3" />
                                    Database Fast
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminDashboard;
