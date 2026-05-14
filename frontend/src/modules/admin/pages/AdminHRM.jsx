import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Plus, Search, Mail, Phone, Trash2,
    UserCircle, BadgeCheck, AlertCircle, Loader2,
    X, Save, IndianRupee, Key, Edit3, Shield, MapPin, Monitor
} from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

const AdminHRM = ({ view }) => {
    const [allEmployees, setAllEmployees] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [search, setSearch] = useState("");
    const { toast } = useToast();
    const { user } = useAuth();

    const getDefaultRole = () => {
        if (view === 'supervisor') return 'supervisor';
        if (view === 'employee') return 'employee';
        return user?.role === 'supervisor' ? "employee" : "supervisor";
    };

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "",
        password: "",
        role: getDefaultRole(),
        supervisorCode: "",
        registrationCommission: 50,
        panCard: "",
        aadharCard: ""
    });
    const [panPhotoFile, setPanPhotoFile] = useState(null);
    const [aadharPhotoFile, setAadharPhotoFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        setFormData(prev => ({ ...prev, role: getDefaultRole() }));
    }, [view, user]);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const { data } = await API.get("/admin/employees");
            setAllEmployees(data);
            setLoading(false);
        } catch (error) {
            toast({ title: "Error", description: "Failed to fetch staff", variant: "destructive" });
        }
    };

    useEffect(() => {
        let filtered = allEmployees;
        if (view === 'supervisor') {
            filtered = allEmployees.filter(e => e.role === 'supervisor');
        } else if (view === 'employee') {
            filtered = allEmployees.filter(e => e.role !== 'supervisor');
        }
        
        // Hide pending employees for supervisors
        if (user?.role === 'supervisor') {
            filtered = filtered.filter(e => e.status !== 'pending');
        }
        
        if (search) {
            filtered = filtered.filter(e => 
                e.name.toLowerCase().includes(search.toLowerCase()) ||
                e.email.toLowerCase().includes(search.toLowerCase()) ||
                e.mobile.includes(search)
            );
        }
        setEmployees(filtered);
    }, [allEmployees, view, search, user]);

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        
        // Validation: Documents and numbers are required for new registration
        if (!editId) {
            if (!formData.panCard || !formData.aadharCard) {
                toast({ title: "Validation Error", description: "Please enter both PAN and Aadhaar card numbers.", variant: "destructive" });
                return;
            }
            if (!panPhotoFile || !aadharPhotoFile) {
                toast({ title: "Documents Required", description: "Please upload both PAN and Aadhaar card photos.", variant: "destructive" });
                return;
            }
        }

        setUploading(true);
        try {
            let panCardPhoto = "";
            let aadharCardPhoto = "";

            if (panPhotoFile) {
                const uploadData = new FormData();
                uploadData.append('image', panPhotoFile);
                const { data } = await API.post('/upload', uploadData);
                panCardPhoto = data.url;
            }

            if (aadharPhotoFile) {
                const uploadData = new FormData();
                uploadData.append('image', aadharPhotoFile);
                const { data } = await API.post('/upload', uploadData);
                aadharCardPhoto = data.url;
            }

            const submitData = { ...formData, panCardPhoto, aadharCardPhoto };

            if (editId) {
                const { data } = await API.put(`/admin/employees/${editId}`, submitData);
                setAllEmployees(allEmployees.map(emp => emp._id === editId ? data : emp));
                toast({ title: "Employee updated successfully!" });
            } else {
                const { data } = await API.post("/admin/employees", submitData);
                setAllEmployees([data.employee, ...allEmployees]);
                
                const description = data.employee.role === 'supervisor' 
                    ? `ID: ${data.employee.ownCode} | Login: ${data.credentials.email} | Pass: ${data.credentials.password}`
                    : `ID: ${data.employee.ownCode} registered successfully.`;

                toast({ 
                    title: "Staff registered successfully!", 
                    description,
                    duration: 10000 
                });
            }
            setShowAddModal(false);
            resetForm();
            setPanPhotoFile(null);
            setAadharPhotoFile(null);
        } catch (err) {
            toast({ 
                title: editId ? "Update failed" : "Registration failed", 
                description: err.response?.data?.message || "Something went wrong",
                variant: "destructive" 
            });
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setFormData({ 
            name: "", 
            email: "", 
            mobile: "", 
            password: "",
            role: getDefaultRole(),
            supervisorCode: "",
            registrationCommission: 50,
            panCard: "",
            aadharCard: ""
        });
        setEditId(null);
    };

    const openEditModal = (emp) => {
        setFormData({
            name: emp.name,
            email: emp.email,
            mobile: emp.mobile,
            password: "",
            role: emp.role || "employee",
            supervisorCode: emp.supervisorCode || "",
            registrationCommission: emp.registrationCommission,
            panCard: emp.panCard || "",
            aadharCard: emp.aadharCard || ""
        });
        setEditId(emp._id);
        setShowAddModal(true);
    };

    const handleDeleteEmployee = async (id) => {
        if (!window.confirm("Are you sure you want to remove this staff member?")) return;
        try {
            await API.delete(`/admin/employees/${id}`);
            setEmployees(employees.filter(e => e._id !== id));
            toast({ title: "Staff member removed" });
        } catch (err) {
            toast({ title: "Delete failed", variant: "destructive" });
        }
    };

    const handleVerify = async (id) => {
        try {
            await API.put(`/admin/employees/${id}/verify`);
            setAllEmployees(allEmployees.map(emp => emp._id === id ? { ...emp, status: 'verified', isActive: true } : emp));
            toast({ title: "Employee Verified" });
        } catch (err) {
            toast({ title: "Verification Failed", variant: "destructive" });
        }
    };

    const handleReject = async (id) => {
        try {
            await API.put(`/admin/employees/${id}/reject`);
            setAllEmployees(allEmployees.map(emp => emp._id === id ? { ...emp, status: 'rejected' } : emp));
            toast({ title: "Employee Rejected" });
        } catch (err) {
            toast({ title: "Action Failed", variant: "destructive" });
        }
    };

    const getRoleIcon = (role) => {
        switch (role) {
            case 'supervisor': return <Shield className="h-4 w-4 text-purple-600" />;
            case 'field_staff': return <MapPin className="h-4 w-4 text-orange-600" />;
            case 'employee': return <Users className="h-4 w-4 text-emerald-600" />;
            default: return <UserCircle className="h-4 w-4 text-gray-600" />;
        }
    };

    const filtered = employees.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.ownCode && e.ownCode.toLowerCase().includes(search.toLowerCase())) ||
        (e.employeeId && e.employeeId.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        {view === 'supervisor' ? 'Supervisor Management' : 
                         view === 'employee' ? 'Staff Management' : 
                         user?.role === 'supervisor' ? 'My Team' : 'HRM Management'}
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h1>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] ml-1">
                        {view === 'supervisor' ? 'Manage Regional Supervisors' : 
                         view === 'employee' ? 'Manage Field & Office Staff' : 
                         'Human Resource Control Center'}
                    </p>
                </div>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
                >
                    <Plus className="h-4 w-4" /> Register New Staff
                </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 text-emerald-600 mb-2">
                        <Users className="h-5 w-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{user?.role === 'supervisor' ? 'Total Managed' : 'Total Staff'}</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900">{employees.length}</p>
                </div>
                {user?.role !== 'supervisor' && (
                    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-3 text-purple-600 mb-2">
                            <Shield className="h-5 w-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Supervisors</span>
                        </div>
                        <p className="text-3xl font-black text-gray-900">
                            {employees.filter(e => e.role === 'supervisor').length}
                        </p>
                    </div>
                )}
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 text-orange-600 mb-2">
                        <MapPin className="h-5 w-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Field Staff</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900">
                        {employees.filter(e => e.role === 'field_staff').length}
                    </p>
                </div>
                {user?.role === 'supervisor' && (
                    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-3 text-blue-600 mb-2">
                            <Users className="h-5 w-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">General Employees</span>
                        </div>
                        <p className="text-3xl font-black text-gray-900">
                            {employees.filter(e => e.role === 'employee').length}
                        </p>
                    </div>
                )}
            </div>

            <div className="rounded-[2.5rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or ID (e.g. RSUP, RSTF)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3.5 pl-11 pr-4 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Staff / Role</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Hierarchy</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Contact</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Referrals</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Commission (₹)</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-bold italic">
                                        No staff members found.
                                    </td>
                                </tr>
                            ) : filtered.map((emp) => (
                                <tr key={emp._id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center font-black ${
                                                emp.role === 'supervisor' ? 'bg-purple-100 text-purple-700' :
                                                emp.role === 'field_staff' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-black">{emp.name}</p>
                                                    {getRoleIcon(emp.role)}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] text-emerald-600 uppercase font-black tracking-tighter">{emp.ownCode || emp.employeeId}</p>
                                                    {emp.status && (
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                                            emp.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                            emp.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                                        }`}>
                                                            {emp.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {emp.role === 'field_staff' ? (
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Supervisor</p>
                                                <p className="text-xs font-black text-purple-600">{emp.supervisorCode || "N/A"}</p>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">Direct Level</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-gray-600 flex items-center gap-2"><Mail className="h-3 w-3" /> {emp.email}</p>
                                            <p className="text-xs font-bold text-gray-600 flex items-center gap-2"><Phone className="h-3 w-3" /> {emp.mobile}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black">
                                            {emp.referralCount || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black">
                                            ₹{emp.registrationCommission || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {(user?.role === 'admin' || user?.role === 'superadmin') && emp.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleVerify(emp._id)}
                                                        className="p-2 text-emerald-500 hover:text-emerald-700 transition-colors"
                                                        title="Approve"
                                                    >
                                                        <BadgeCheck className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(emp._id)}
                                                        className="p-2 text-red-500 hover:text-red-700 transition-colors"
                                                        title="Reject"
                                                    >
                                                        <AlertCircle className="h-5 w-5" />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => openEditModal(emp)}
                                                className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <Edit3 className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteEmployee(emp._id)}
                                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Employee Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl p-8"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 uppercase">
                                        {editId ? "Edit Staff Details" : "Register Hierarchical Staff"}
                                    </h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1 italic">
                                        Company Admin → Supervisor → Field Staff Hierarchy
                                    </p>
                                </div>
                                <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-2 rounded-2xl bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleAddEmployee} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Staff Role</label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                        >
                                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                                <>
                                                    <option value="supervisor">Supervisor</option>
                                                </>
                                            )}
                                            {user?.role === 'supervisor' && (
                                                <>
                                                    <option value="employee">General Employee</option>
                                                </>
                                            )}
                                            {!user && (
                                                <>
                                                    <option value="employee">General Employee</option>
                                                    <option value="field_staff">Field Staff</option>
                                                    <option value="supervisor">Supervisor</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                            placeholder="Rahul Verma"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Mobile No</label>
                                        <input
                                            required
                                            type="tel"
                                            value={formData.mobile}
                                            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                            placeholder="91XXXXXXXXXX"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
                                        <input
                                            required
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                            placeholder="email@rozsewa.com"
                                        />
                                    </div>
                                </div>

                                {formData.role === 'field_staff' && user?.role !== 'supervisor' && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-1.5"
                                    >
                                        <label className="text-[10px] font-black uppercase tracking-widest text-purple-600 ml-1 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" /> Mandatory Supervisor Code
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.supervisorCode}
                                            onChange={(e) => setFormData({ ...formData, supervisorCode: e.target.value.toUpperCase() })}
                                            className="w-full rounded-2xl border-2 border-purple-100 bg-purple-50/30 px-5 py-3.5 text-sm font-black text-purple-700 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/5 transition-all"
                                            placeholder="e.g. RSUP1001"
                                        />
                                    </motion.div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">PAN Card</label>
                                        <input
                                            type="text"
                                            value={formData.panCard}
                                            onChange={(e) => setFormData({ ...formData, panCard: e.target.value.toUpperCase() })}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all uppercase"
                                            placeholder="ABCDE1234F"
                                        />
                                        <input
                                            type="file"
                                            onChange={(e) => setPanPhotoFile(e.target.files[0])}
                                            className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Aadhaar Card</label>
                                        <input
                                            type="text"
                                            value={formData.aadharCard}
                                            onChange={(e) => setFormData({ ...formData, aadharCard: e.target.value })}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                            placeholder="XXXX XXXX XXXX"
                                        />
                                        <input
                                            type="file"
                                            onChange={(e) => setAadharPhotoFile(e.target.files[0])}
                                            className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {formData.role === 'supervisor' && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Login Password</label>
                                            <div className="relative">
                                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-12 py-3.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                                    placeholder="Set login password"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className={`space-y-1.5 ${formData.role !== 'supervisor' ? 'col-span-2' : ''}`}>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Reg. Commission (₹)</label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input
                                                required
                                                type="number"
                                                value={formData.registrationCommission}
                                                onChange={(e) => setFormData({ ...formData, registrationCommission: e.target.value })}
                                                className="w-full rounded-2xl border border-gray-100 bg-gray-50 pl-11 pr-4 py-3.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1 rounded-2xl border border-gray-100 bg-white py-4 text-sm font-black text-gray-500 hover:bg-gray-50 transition-all uppercase tracking-widest">Cancel</button>
                                    <button type="submit" disabled={uploading} className="flex-1 rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-xl shadow-emerald-600/20 hover:shadow-2xl transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">
                                        {uploading ? "Uploading..." : (editId ? "Update Details" : "Register Staff")}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminHRM;
