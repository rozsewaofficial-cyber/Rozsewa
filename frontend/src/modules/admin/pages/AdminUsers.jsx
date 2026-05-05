import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, MoreVertical, ShieldAlert, CheckCircle2, Ban, Loader2, User as UserIcon, Phone, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminUsers = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
                filteredUsers.map((user) => (
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
                        <button className="p-2.5 text-gray-300 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all">
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
      </div>
    </div>
  );
};

export default AdminUsers;
