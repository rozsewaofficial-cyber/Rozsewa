import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, MoreVertical, ShieldAlert, CheckCircle2, Ban, Loader2, User as UserIcon, Phone, Mail, X, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
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
  const activeSelectedUser = selectedUser ? users.find(u => u._id === selectedUser._id) : null;
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      <p className="text-xs font-black uppercase tracking-widest text-gray-400">Fetching User Registry...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">System Users</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">Overview of all registered customers and their platform activity.</p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
            placeholder="Search by name, email, or phone..."
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-[2.5rem] border border-gray-200 bg-white shadow-xl shadow-gray-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400 uppercase tracking-widest text-[10px] font-black">
              <tr>
                <th className="py-6 px-8">Personal Info</th>
                <th className="py-6 px-8">Contact & Access</th>
                <th className="py-6 px-8 text-center">Engagement</th>
                <th className="py-6 px-8">Membership</th>
                <th className="py-6 px-8 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <UserIcon className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 font-bold text-sm tracking-tight">No registered users found.</p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <motion.tr key={user._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-emerald-50/10 transition-colors group">
                    <td className="py-5 px-8">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border-2 border-white shadow-md text-emerald-700 font-black text-lg uppercase tracking-tighter">
                          {user.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-extrabold text-gray-900 tracking-tight">{user.name}</p>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-8">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase">
                          <Phone className="h-3 w-3 text-gray-300" /> +91 {user.mobile}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase">
                          <Mail className="h-3 w-3 text-gray-300" /> {user.email || 'No Email Added'}
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-8 text-center">
                      <span className="inline-flex items-center justify-center rounded-xl bg-blue-50 px-3 py-1.5 text-[10px] font-black text-blue-700 border border-blue-100 uppercase tracking-widest">
                        0 Bookings
                      </span>
                    </td>
                    <td className="py-5 px-8">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Since registration</p>
                      <p className="text-xs font-bold text-gray-900">{new Date(user.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </td>
                    <td className="py-5 px-8 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleToggleStatus(user._id, user.isActive)}
                          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${
                            user.isActive === false 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100" 
                            : "bg-white text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100"
                          }`}
                        >
                          {user.isActive === false ? (
                            <><CheckCircle2 className="h-3.5 w-3.5" /> Unblock</>
                          ) : (
                            <><Ban className="h-3.5 w-3.5" /> Block</>
                          )}
                        </button>
                        <button 
                          onClick={() => setSelectedUser(user)}
                          className="p-2.5 text-gray-300 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all"
                          title="View Details"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
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
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const isActive = page === currentPage;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-9 min-w-9 px-3 flex items-center justify-center rounded-xl text-xs font-black transition-all shadow-sm ${
                      isActive
                        ? "bg-emerald-600 text-white border border-emerald-600"
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
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      <AnimatePresence>
        {activeSelectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-[2rem] bg-white shadow-2xl overflow-hidden border border-slate-100"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-black text-gray-900">User Profile Details</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform Registered Customer</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="rounded-xl bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Profile Card */}
                <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 border-2 border-emerald-100 shadow-md text-emerald-700 font-black text-2xl uppercase">
                    {activeSelectedUser.name?.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xl font-extrabold text-gray-900 leading-tight">{activeSelectedUser.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 border border-blue-100">
                        {activeSelectedUser.role}
                      </span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
                        activeSelectedUser.isActive === false 
                        ? 'bg-rose-50 text-rose-700 border-rose-100' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {activeSelectedUser.isActive === false ? 'Blocked' : 'Active'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Details</h4>
                  <div className="grid grid-cols-1 gap-3 text-sm rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex justify-between border-b border-slate-100 pb-2.5">
                      <span className="text-gray-400 font-bold">Mobile Number</span>
                      <span className="font-extrabold text-gray-800">+91 {activeSelectedUser.mobile}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2.5">
                      <span className="text-gray-400 font-bold">Email Address</span>
                      <span className="font-extrabold text-gray-800">{activeSelectedUser.email || 'Not Provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-bold">Registration Date</span>
                      <span className="font-extrabold text-gray-800">
                        {new Date(activeSelectedUser.createdAt).toLocaleDateString(undefined, { 
                          day: '2-digit', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location & Addresses</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 text-xs font-bold text-gray-700 bg-white border border-slate-100 p-3.5 rounded-2xl shadow-sm">
                      <MapPin className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Primary Location</p>
                        <p className="text-gray-900">{activeSelectedUser.address || 'No primary address added'}</p>
                        {(activeSelectedUser.city || activeSelectedUser.state) && (
                          <p className="text-emerald-700 text-[10px] uppercase font-black tracking-widest mt-1">
                            {activeSelectedUser.city}, {activeSelectedUser.state}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Additional Saved Addresses */}
                    {activeSelectedUser.addresses && activeSelectedUser.addresses.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 pl-1">Saved Addresses ({activeSelectedUser.addresses.length})</p>
                        <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                          {activeSelectedUser.addresses.map((addr, index) => (
                            <div key={index} className="flex items-start gap-2 text-xs font-bold text-gray-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                              <div className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] uppercase font-black shrink-0 mt-0.5 border border-blue-100">
                                {addr.label}
                              </div>
                              <span className="truncate">{addr.address}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsers;
