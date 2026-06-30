import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useScrollLock } from "@/lib/scrollLock";
import { Search, MoreVertical, ShieldAlert, CheckCircle2, Ban, Loader2, User as UserIcon, Phone, Mail, X, MapPin, ChevronLeft, ChevronRight, Users, Activity, AlertOctagon, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminUsers = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    useScrollLock(!!selectedUser);
    const activeSelectedUser = selectedUser ? users.find(u => u._id === selectedUser._id) : null;
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [walletData, setWalletData] = useState(null);
    const [loadingWallet, setLoadingWallet] = useState(false);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        if (selectedUser) {
            fetchUserWallet(selectedUser._id);
        } else {
            setWalletData(null);
        }
    }, [selectedUser]);

    const fetchUserWallet = async (id) => {
        setLoadingWallet(true);
        try {
            const { data } = await API.get(`/admin/users/${id}/wallet`);
            setWalletData(data);
        } catch (err) {
            console.error("Failed to fetch user wallet", err);
        } finally {
            setLoadingWallet(false);
        }
    };

    useEffect(() => {
        setTitle("Manage Platform Users");
        fetchUsers();
    }, [setTitle]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/users");
            setUsers(data);
        } catch (err) {
            toast({ title: "Fetch Failed", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        try {
            const { data } = await API.put(`/admin/users/${id}/toggle-status`);
            if (data.success) {
                setUsers(prev => prev.map(u => u._id === id ? { ...u, isActive: data.isActive } : u));
                toast({
                    title: data.isActive ? "User Unblocked" : "User Blocked",
                    description: `The account is now ${data.isActive ? 'active' : 'restricted'}.`
                });
            }
        } catch (err) {
            toast({ title: "Action Failed", variant: "destructive" });
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) return;
        try {
            const { data } = await API.delete(`/admin/users/${id}`);
            if (data.success) {
                setUsers(prev => prev.filter(u => u._id !== id));
                toast({
                    title: "User Deleted",
                    description: "The user has been permanently removed from the database."
                });
            }
        } catch (err) {
            toast({ title: "Delete Failed", variant: "destructive", description: err.response?.data?.message || err.message });
        }
    };

    const filteredUsers = (users || []).filter(u => {
        const name = (u?.name || "").toLowerCase();
        const mobile = (u?.mobile || "").toLowerCase();
        const email = (u?.email || "").toLowerCase();
        const search = (searchTerm || "").toLowerCase();

        return name.includes(search) ||
            mobile.includes(search) ||
            email.includes(search);
    });

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const stats = useMemo(() => {
        const active = users.filter(u => u.isActive !== false).length;
        const blocked = users.filter(u => u.isActive === false).length;
        const recent = users.filter(u => {
            const diffTime = Math.abs(new Date() - new Date(u.createdAt));
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 7;
        }).length;
        
        return { total: users.length, active, blocked, recent };
    }, [users]);

    if (loading) return (
        <div className="flex h-96 flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fetching User Registry...</p>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">System Users</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Overview of all registered customers and platform activity.</p>
                </div>
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm font-bold placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm outline-none"
                        placeholder="Search users..."
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Users", value: stats.total, icon: Users, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Active Accounts", value: stats.active, icon: Activity, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Blocked Accounts", value: stats.blocked, icon: AlertOctagon, cls: "text-red-700 bg-red-50 border-red-200" },
                    { label: "New (Last 7 Days)", value: stats.recent, icon: TrendingUp, cls: "text-amber-700 bg-amber-50 border-amber-200" },
                ].map((s, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${s.cls}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <s.icon className="h-3.5 w-3.5 opacity-70" />
                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{s.label}</p>
                        </div>
                        <h3 className="text-2xl font-black">{s.value}</h3>
                    </div>
                ))}
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                            <UserIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900">User Registry</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Customer Accounts</p>
                        </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Personal Info</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Contact & Access</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Membership</th>
                                <th className="px-6 py-4 text-right text-[9px] font-black uppercase tracking-widest text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center">
                                        <UserIcon className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                                        <p className="text-gray-400 font-bold text-sm tracking-tight">No registered users found.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((user) => (
                                    <tr key={user._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 font-black text-lg uppercase tracking-tighter shadow-sm">
                                                    {user.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-extrabold text-gray-900 tracking-tight">{user.name}</p>
                                                    <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${user.isActive === false ? 'text-red-500' : 'text-blue-600'}`}>{user.isActive === false ? 'Blocked' : user.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                                    <Phone className="h-3 w-3 text-gray-400" /> +91 {user.mobile}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                                    <Mail className="h-3 w-3 text-gray-400" /> {user.email || 'No Email Added'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Since registration</p>
                                            <p className="text-xs font-bold text-gray-900">{new Date(user.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleToggleStatus(user._id, user.isActive)}
                                                    className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-colors ${
                                                        user.isActive === false
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                                                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100"
                                                    }`}
                                                >
                                                    {user.isActive === false ? <><CheckCircle2 className="h-3 w-3" /> Unblock</> : <><Ban className="h-3 w-3" /> Block</>}
                                                </button>
                                                <button
                                                    onClick={() => setSelectedUser(user)}
                                                    className="h-8 px-3 rounded-lg bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-200 transition-colors"
                                                    title="View Details"
                                                >
                                                    Details
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user._id)}
                                                    className="h-8 px-3 rounded-lg bg-red-50 border border-red-100 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 transition-colors"
                                                    title="Delete User"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                            Showing <span className="text-gray-900 font-black">{((currentPage - 1) * itemsPerPage) + 1}</span> to{" "}
                            <span className="text-gray-900 font-black">
                                {Math.min(currentPage * itemsPerPage, filteredUsers.length)}
                            </span>{" "}
                            of <span className="text-gray-900 font-black">{filteredUsers.length}</span> users
                        </p>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                            ))}
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

            {/* User Details Drawer (Consistent with SuperAdmin Drawer) */}
            <AnimatePresence>
                {activeSelectedUser && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
                        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-y-0 right-0 z-[101] w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-200">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">User Profile Details</h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Platform Registered Customer</p>
                                </div>
                                <button onClick={() => setSelectedUser(null)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gray-100 border border-gray-200 shadow-sm text-gray-700 font-black text-2xl uppercase">
                                        {activeSelectedUser.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-gray-900 tracking-tight leading-tight">{activeSelectedUser.name}</h4>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-700 border border-blue-100">
                                                {activeSelectedUser.role}
                                            </span>
                                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                                                activeSelectedUser.isActive === false
                                                    ? 'bg-red-50 text-red-700 border-red-100'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                            }`}>
                                                {activeSelectedUser.isActive === false ? 'Blocked' : 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Contact Details</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="flex items-center gap-3 text-gray-400"><Phone className="h-4 w-4" /><span className="text-[9px] font-black uppercase tracking-widest">Mobile</span></div>
                                            <span className="text-sm font-bold text-gray-900">+91 {activeSelectedUser.mobile}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="flex items-center gap-3 text-gray-400"><Mail className="h-4 w-4" /><span className="text-[9px] font-black uppercase tracking-widest">Email</span></div>
                                            <span className="text-sm font-bold text-gray-900">{activeSelectedUser.email || 'Not Provided'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Location & Addresses</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 text-xs font-bold text-gray-700 bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
                                            <MapPin className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Primary Location</p>
                                                <p className="text-gray-900">{activeSelectedUser.address || 'No primary address added'}</p>
                                                {(activeSelectedUser.city || activeSelectedUser.state) && (
                                                    <p className="text-emerald-700 text-[10px] uppercase font-black tracking-widest mt-1">
                                                        {activeSelectedUser.city}, {activeSelectedUser.state}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {activeSelectedUser.addresses && activeSelectedUser.addresses.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 pl-1">Saved Addresses ({activeSelectedUser.addresses.length})</p>
                                                <div className="space-y-2">
                                                    {activeSelectedUser.addresses.map((addr, index) => (
                                                        <div key={index} className="flex items-start gap-2 text-xs font-bold text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                            <div className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] uppercase font-black shrink-0 mt-0.5 border border-blue-100">
                                                                {addr.label}
                                                            </div>
                                                            <span className="leading-relaxed">{addr.address}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Wallet Information */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Wallet & Transactions</h4>
                                    
                                    {loadingWallet ? (
                                        <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
                                    ) : walletData ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-md text-white">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Current Balance</p>
                                                    <p className="text-2xl font-black">₹{walletData.balance.toLocaleString()}</p>
                                                </div>
                                                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
                                                    <span className="text-xl font-black">₹</span>
                                                </div>
                                            </div>

                                            {walletData.transactions && walletData.transactions.length > 0 ? (
                                                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                                    {walletData.transactions.map((txn, index) => (
                                                        <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-900">{txn.title || 'Wallet Transaction'}</p>
                                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                                                                    {new Date(txn.createdAt).toLocaleDateString()} • {txn.status}
                                                                </p>
                                                            </div>
                                                            <div className={`text-sm font-black ${txn.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                {txn.type === 'credit' ? '+' : '-'}₹{txn.amount}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs font-bold text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-gray-100">No transactions found</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs font-bold text-red-500">Failed to load wallet data</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminUsers;
