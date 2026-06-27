import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useScrollLock } from '@/lib/scrollLock';
import {
    Users, Plus, Shield, Lock, Trash2, CheckCircle2, XCircle,
    ChevronRight, Save, UserPlus, Fingerprint, CreditCard, Percent, Zap,
    MoreVertical, Mail, Phone, Calendar, Info, X, Edit3, Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from "sonner";
import API from "@/lib/api";
import { validateEmail, sanitizeEmail } from "@/lib/emailValidation";
import { validatePhone, sanitizePhone } from "@/lib/phoneValidation";
import { validateName, sanitizeName, sanitizeNameOnChange } from "@/lib/nameValidation";
import { adminSidebarLinks } from "../components/AdminSidebar";

const InputField = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
        {children}
    </div>
);

const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";

const AdminSuper = () => {
    const { setTitle } = useOutletContext();
    const [admins, setAdmins] = useState([]);
    const [sewaks, setSewaks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPin, setNewPin] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useScrollLock(showCreateForm || showDrawer);
    const [editingAdminId, setEditingAdminId] = useState(null);
    const [newAdmin, setNewAdmin] = useState({
        name: '', email: '', mobile: '', password: '',
        permissions: [], kycAccess: false, kycLimit: 50, kycBonusPerVerification: 10
    });
    const [showSewakForm, setShowSewakForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [kycPerformance, setKycPerformance] = useState([]);
    const [selectedAdmin, setSelectedAdmin] = useState(null);
    const [editingSewakId, setEditingSewakId] = useState(null);

    const [newSewak, setNewSewak] = useState({
        ownerName: '', mobile: '', password: '', email: '',
        address: '', city: '', state: '', latitude: '', longitude: '',
        businessType: 'Internal Service'
    });

    const [settings, setSettings] = useState({
        vendorCardEnabled: true,
        vendorCardPrice: 99,
        commission_basic: 25,
        commission_standard: 20,
        commission_premium: 15,
        subscription_price: 999,
        subscription_commission_rate: 5,
        subscription_enabled: true
    });

    useEffect(() => {
        setTitle("Super Admin Panel");
    }, [setTitle]);

    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true);
            try {
                await Promise.all([fetchAdmins(), fetchSettings(), fetchSewaks(), fetchKycPerformance()]);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadAllData();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await API.get('/admin/settings');
            setSettings(response.data);
        } catch (error) {
            console.error("Failed to fetch settings");
        }
    };

    const fetchAdmins = async () => {
        try {
            const response = await API.get('/admin/admins');
            setAdmins(response.data);
        } catch (error) {
            toast.error("Failed to fetch admins");
        }
    };

    const fetchKycPerformance = async () => {
        try {
            const response = await API.get('/admin/kyc-performance');
            setKycPerformance(response.data);
        } catch (error) {
            console.error("Failed to fetch performance");
        }
    };

    const fetchSewaks = async () => {
        try {
            const response = await API.get('/admin/sewaks');
            setSewaks(response.data);
        } catch (error) {
            toast.error("Failed to fetch sewaks");
        }
    };

    const updateAdminSetting = async (key, value) => {
        try {
            await API.post('/admin/settings', { key, value });
            setSettings(prev => ({ ...prev, [key]: value }));
            toast.success("Settings updated");
        } catch (error) {
            toast.error("Failed to update setting");
        }
    };

    const handleCreateOrUpdateAdmin = async (e) => {
        e.preventDefault();
        const sanitizedName = sanitizeName(newAdmin.name);
        const nameValidation = validateName(sanitizedName);
        if (!nameValidation.isValid) {
            toast.error(nameValidation.message);
            return;
        }
        if (newAdmin.email && !validateEmail(newAdmin.email)) {
            toast.error("Please enter a valid email address.");
            return;
        }
        const phoneValidation = validatePhone(newAdmin.mobile);
        if (!phoneValidation.isValid) {
            toast.error(phoneValidation.message);
            return;
        }
        const sanitizedAdmin = { ...newAdmin, name: sanitizedName };
        try {
            if (isEditing) {
                await API.put(`/admin/admins/${editingAdminId}`, sanitizedAdmin);
                toast.success("Admin updated successfully");
            } else {
                await API.post('/admin/admins', sanitizedAdmin);
                toast.success("Admin created successfully");
            }
            setShowCreateForm(false);
            setIsEditing(false);
            setEditingAdminId(null);
            setNewAdmin({ name: '', email: '', mobile: '', password: '', permissions: [], kycAccess: false, kycLimit: 50, kycBonusPerVerification: 10 });
            fetchAdmins();
            fetchKycPerformance();
        } catch (error) {
            toast.error(error.response?.data?.message || "Operation failed");
        }
    };

    const handleCreateSewak = async (e) => {
        e.preventDefault();
        const sanitizedOwnerName = sanitizeName(newSewak.ownerName);
        const nameValidation = validateName(sanitizedOwnerName);
        if (!nameValidation.isValid) {
            toast.error(nameValidation.message);
            return;
        }
        const phoneValidation = validatePhone(newSewak.mobile);
        if (!phoneValidation.isValid) {
            toast.error(phoneValidation.message);
            return;
        }
        const sanitizedSewak = { ...newSewak, ownerName: sanitizedOwnerName };
        try {
            if (editingSewakId) {
                await API.put(`/admin/sewaks/${editingSewakId}`, sanitizedSewak);
                toast.success("Sewak updated successfully");
            } else {
                await API.post('/admin/sewaks', sanitizedSewak);
                toast.success("Sewak created successfully");
            }
            setShowSewakForm(false);
            setEditingSewakId(null);
            setNewSewak({
                ownerName: '', mobile: '', password: '', email: '',
                address: '', city: '', state: '', latitude: '', longitude: '',
                businessType: 'Internal Service'
            });
            fetchSewaks();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to save sewak");
        }
    };

    const handleDeleteAdmin = async (id) => {
        if (!window.confirm("Are you sure you want to delete this admin?")) return;
        try {
            await API.delete(`/admin/admins/${id}`);
            toast.success("Admin deleted successfully");
            fetchAdmins();
        } catch (error) {
            toast.error("Failed to delete admin");
        }
    };

    const startEditing = (admin) => {
        setNewAdmin({
            name: admin.name, email: admin.email, mobile: admin.mobile, password: '',
            permissions: admin.permissions || [], kycAccess: admin.kycAccess || false,
            kycLimit: admin.kycLimit || 50, kycBonusPerVerification: admin.kycBonusPerVerification || 10
        });
        setEditingAdminId(admin._id);
        setIsEditing(true);
        setShowCreateForm(true);
    };

    const savePermissions = async (admin) => {
        try {
            await API.put(`/admin/admins/${admin._id}/permissions`, { permissions: admin.permissions });
            toast.success(`Permissions updated for ${admin.name}`);
            setAdmins(admins.map(a => a._id === admin._id ? { ...a, isModified: false } : a));
            if (selectedAdmin?._id === admin._id) {
                setSelectedAdmin({ ...admin, isModified: false });
            }
        } catch (error) {
            toast.error("Failed to save permissions");
        }
    };

    const handleUpdatePin = async () => {
        if (newPin.length !== 4) return toast.error("PIN must be 4 digits");
        try {
            await API.post('/admin/update-pin', { pin: newPin });
            toast.success("Super Admin PIN updated");
            setNewPin('');
        } catch (error) {
            toast.error("Failed to update PIN");
        }
    };

    const stats = useMemo(() => {
        return {
            totalAdmins: admins.length,
            sewaks: sewaks.length,
            activeKycAdmins: admins.filter(a => a.kycAccess).length,
            baseCommission: settings.commission_basic
        };
    }, [admins, sewaks, settings]);


    if (loading) return (
        <div className="flex h-96 flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Super Hub...</p>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-12">

            {/* Header */}
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Super Admin Hub</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Manage administrative staff, platform settings, and security.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm h-11">
                        <Fingerprint className="h-4 w-4 text-emerald-600 mr-2 opacity-70" />
                        <input
                            type="password"
                            placeholder="New PIN"
                            className="w-24 border-none text-sm font-bold bg-transparent focus:ring-0 outline-none"
                            maxLength={4}
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value)}
                        />
                        <button onClick={handleUpdatePin} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 ml-2">
                            Update
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            if (showCreateForm) {
                                setIsEditing(false);
                                setEditingAdminId(null);
                                setNewAdmin({ name: '', email: '', mobile: '', password: '', permissions: [], kycAccess: false, kycLimit: 50, kycBonusPerVerification: 10 });
                            }
                            setShowCreateForm(!showCreateForm);
                        }}
                        className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95"
                    >
                        {showCreateForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                        {showCreateForm ? "Cancel" : "Add New Admin"}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Admins", value: stats.totalAdmins, icon: Shield, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "KYC Handlers", value: stats.activeKycAdmins, icon: Zap, cls: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Internal Sewaks", value: stats.sewaks, icon: Users, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Base Commission", value: `${stats.baseCommission}%`, icon: Percent, cls: "text-purple-700 bg-purple-50 border-purple-200" },
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

            {/* Platform Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Registration Config */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                            <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900">Registration Config</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Membership details</p>
                        </div>
                    </div>
                    <div className="p-6 space-y-6 flex-1">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <h4 className="text-sm font-black text-gray-900">Paid Membership</h4>
                                <p className="text-[10px] font-bold text-gray-500 mt-1">Require fee during provider signup.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={settings.vendorCardEnabled} onChange={(e) => updateAdminSetting('vendorCardEnabled', e.target.checked)} />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Membership Price (₹)</label>
                            <div className="flex gap-2">
                                <input type="number" className={inputCls} value={settings.vendorCardPrice} onChange={(e) => setSettings(prev => ({ ...prev, vendorCardPrice: e.target.value }))} />
                                <button onClick={() => updateAdminSetting('vendorCardPrice', Number(settings.vendorCardPrice))} className="h-11 px-4 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700 transition-all">Save</button>
                            </div>
                        </div>
                    </div>
                </div>


            </div>

            {/* Admin Management Table */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                            <Shield className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900">Administrative Accounts</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Staff access list</p>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Staff Details</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Contact</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Role</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">KYC Status</th>
                                <th className="px-6 py-4 text-right text-[9px] font-black uppercase tracking-widest text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {admins.map((admin) => (
                                <tr key={admin._id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-black text-sm border shadow-sm ${admin.role === 'superadmin' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                                                {admin.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-900">{admin.name}</p>
                                                <p className="text-[10px] font-bold text-gray-400 mt-0.5">Joined {new Date(admin.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-900">{admin.mobile}</p>
                                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">{admin.email}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${admin.role === 'superadmin' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                            {admin.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {admin.kycAccess ? (
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1"><Zap className="h-3 w-3" /> Active</p>
                                                <p className="text-[9px] font-bold text-gray-400 mt-0.5">₹{admin.kycBonusPerVerification}/kyc • {admin.kycLimit} max</p>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Disabled</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {admin.role !== 'superadmin' && (
                                                <button
                                                    onClick={() => handleDeleteAdmin(admin._id)}
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-gray-50 text-red-500 hover:bg-red-50 transition-colors"
                                                    title="Delete Admin"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => startEditing(admin)}
                                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-gray-50 text-blue-600 hover:bg-blue-50 transition-colors"
                                                title="Edit Admin"
                                            >
                                                <Edit3 className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => { setSelectedAdmin(admin); setShowDrawer(true); }}
                                                className="h-8 px-3 rounded-lg bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-200 transition-colors"
                                            >
                                                Details
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sewak Management */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900">Internal Sewaks</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Direct platform employees</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (showSewakForm) {
                                setEditingSewakId(null);
                                setNewSewak({
                                    ownerName: '', mobile: '', password: '', email: '',
                                    address: '', city: '', state: '', latitude: '', longitude: '',
                                    businessType: 'Internal Service'
                                });
                            }
                            setShowSewakForm(!showSewakForm);
                        }}
                        className="flex h-9 items-center gap-2 rounded-lg bg-orange-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-orange-700 transition-all"
                    >
                        {showSewakForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {showSewakForm ? "Cancel" : "Add Sewak"}
                    </button>
                </div>
                
                {showSewakForm && (
                    <div className="p-6 bg-orange-50/30 border-b border-gray-100">
                        <form onSubmit={handleCreateSewak} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <InputField label="Full Name"><input required value={newSewak.ownerName} onChange={e => setNewSewak({ ...newSewak, ownerName: sanitizeNameOnChange(e.target.value) })} className={inputCls} /></InputField>
                                <InputField label="Mobile"><input required value={newSewak.mobile} onChange={e => setNewSewak({ ...newSewak, mobile: sanitizePhone(e.target.value) })} maxLength="10" className={inputCls} /></InputField>
                                <InputField label="Password"><input required type="password" value={newSewak.password} onChange={e => setNewSewak({ ...newSewak, password: e.target.value })} className={inputCls} /></InputField>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField label="Address"><input required value={newSewak.address} onChange={e => setNewSewak({ ...newSewak, address: e.target.value })} className={inputCls} /></InputField>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="City"><input required value={newSewak.city} onChange={e => setNewSewak({ ...newSewak, city: e.target.value })} className={inputCls} /></InputField>
                                    <InputField label="State"><input required value={newSewak.state} onChange={e => setNewSewak({ ...newSewak, state: e.target.value })} className={inputCls} /></InputField>
                                </div>
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Location Settings</h4>
                                    <button type="button" onClick={() => {
                                        if (navigator.geolocation) {
                                            navigator.geolocation.getCurrentPosition(pos => {
                                                setNewSewak(p => ({ ...p, latitude: pos.coords.latitude.toString(), longitude: pos.coords.longitude.toString() }));
                                            });
                                        }
                                    }} className="flex items-center gap-1.5 h-8 px-3 rounded bg-orange-100 text-orange-700 text-[9px] font-black uppercase tracking-widest hover:bg-orange-200 transition-colors"><Navigation className="h-3 w-3" /> Fetch Auto</button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Latitude"><input value={newSewak.latitude} onChange={e => setNewSewak({ ...newSewak, latitude: e.target.value })} className={inputCls} placeholder="28.7041" /></InputField>
                                    <InputField label="Longitude"><input value={newSewak.longitude} onChange={e => setNewSewak({ ...newSewak, longitude: e.target.value })} className={inputCls} placeholder="77.1025" /></InputField>
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button type="submit" className="h-11 px-8 rounded-xl bg-gray-900 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-black transition-all">
                                    {editingSewakId ? "Update Sewak" : "Register Sewak"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Sewak Profile</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Location</th>
                                <th className="px-6 py-4 text-right text-[9px] font-black uppercase tracking-widest text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sewaks.length === 0 && (
                                <tr><td colSpan="3" className="px-6 py-8 text-center text-xs font-bold text-gray-400 italic">No sewaks registered.</td></tr>
                            )}
                            {sewaks.map(sewak => (
                                <tr key={sewak._id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-black border border-orange-100">{sewak.ownerName.charAt(0)}</div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-gray-900">{sewak.ownerName}</p>
                                                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px] font-black">{sewak.vendorCode}</span>
                                                </div>
                                                <p className="text-[10px] font-bold text-gray-400 mt-0.5">{sewak.mobile}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-900">{sewak.city}, {sewak.state}</p>
                                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">{sewak.address}</p>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => {
                                                setNewSewak({
                                                    ownerName: sewak.ownerName || '',
                                                    mobile: sewak.mobile || '',
                                                    password: '',
                                                    email: sewak.email || '',
                                                    address: sewak.address || '',
                                                    city: sewak.city || '',
                                                    state: sewak.state || '',
                                                    latitude: sewak.location?.coordinates?.[1] || '',
                                                    longitude: sewak.location?.coordinates?.[0] || '',
                                                    businessType: sewak.businessType || 'Internal Service'
                                                });
                                                setEditingSewakId(sewak._id);
                                                setShowSewakForm(true);
                                            }} className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-gray-50 text-blue-500 hover:bg-blue-50 transition-colors" title="Edit Sewak"><Edit3 className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => { if (window.confirm("Remove?")) API.delete(`/admin/providers/${sewak._id}`).then(() => fetchSewaks()); }} className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-gray-50 text-red-500 hover:bg-red-50 transition-colors" title="Delete Sewak"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Creation/Edit Admin Modal */}
            <AnimatePresence>
                {showCreateForm && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateForm(false)} />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
                            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl pointer-events-auto custom-scrollbar flex flex-col">
                                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur-sm">
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900">{isEditing ? "Update Admin" : "New Administrative Account"}</h3>
                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Staff Credentials</p>
                                    </div>
                                    <button onClick={() => setShowCreateForm(false)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <form onSubmit={handleCreateOrUpdateAdmin} className="p-6 space-y-6 bg-gray-50/30">
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Basic Information</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <InputField label="Full Name"><input required value={newAdmin.name} onChange={e => setNewAdmin({ ...newAdmin, name: sanitizeNameOnChange(e.target.value) })} className={inputCls} /></InputField>
                                            <InputField label="Email Address"><input required type="email" value={newAdmin.email} onChange={e => setNewAdmin({ ...newAdmin, email: sanitizeEmail(e.target.value) })} className={inputCls} /></InputField>
                                            <InputField label="Mobile Number"><input required value={newAdmin.mobile} onChange={e => setNewAdmin({ ...newAdmin, mobile: sanitizePhone(e.target.value) })} maxLength="10" className={inputCls} /></InputField>
                                            <InputField label={isEditing ? "Password (optional)" : "Password"}><input required={!isEditing} type="password" placeholder={isEditing ? "Leave blank to keep current" : ""} value={newAdmin.password} onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })} className={inputCls} /></InputField>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">KYC Incentive Settings</h4>
                                        <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-black text-gray-900">Enable Incentive Program</p>
                                                    <p className="text-[10px] font-bold text-gray-500 mt-1">Allow earning bonuses on verifying KYC</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" className="sr-only peer" checked={newAdmin.kycAccess} onChange={e => setNewAdmin({ ...newAdmin, kycAccess: e.target.checked })} />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                </label>
                                            </div>
                                            {newAdmin.kycAccess && (
                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                                    <InputField label="Target Limit"><input type="number" value={newAdmin.kycLimit} onChange={e => setNewAdmin({ ...newAdmin, kycLimit: Number(e.target.value) })} className={inputCls} /></InputField>
                                                    <InputField label="Bonus Per Verification (₹)"><input type="number" value={newAdmin.kycBonusPerVerification} onChange={e => setNewAdmin({ ...newAdmin, kycBonusPerVerification: Number(e.target.value) })} className={inputCls} /></InputField>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </form>
                                <div className="p-5 border-t border-gray-100 bg-white flex gap-3">
                                    <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 h-12 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                                    <button onClick={handleCreateOrUpdateAdmin} className="flex-1 h-12 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all">
                                        <Save className="h-3 w-3 inline mr-1.5" /> {isEditing ? "Save Changes" : "Create Admin"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Admin Details Drawer */}
            <AnimatePresence>
                {showDrawer && selectedAdmin && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
                        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-y-0 right-0 z-[101] w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-200">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">Admin Profile</h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Permissions & Details</p>
                                </div>
                                <button onClick={() => setShowDrawer(false)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                <div className="flex items-center gap-4">
                                    <div className={`h-20 w-20 rounded-2xl flex items-center justify-center font-black text-3xl border shadow-sm ${selectedAdmin.role === 'superadmin' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                        {selectedAdmin.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-gray-900 tracking-tight leading-tight">{selectedAdmin.name}</h4>
                                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${selectedAdmin.role === 'superadmin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{selectedAdmin.role}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"><Mail className="h-4 w-4 text-gray-400" /><div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Email</p><p className="text-sm font-bold text-gray-900">{selectedAdmin.email}</p></div></div>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"><Phone className="h-4 w-4 text-gray-400" /><div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mobile</p><p className="text-sm font-bold text-gray-900">{selectedAdmin.mobile}</p></div></div>
                                </div>
                                {selectedAdmin.role !== 'superadmin' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Module Access</h4>
                                            <button disabled={!selectedAdmin.isModified} onClick={() => savePermissions(selectedAdmin)} className={`h-7 px-3 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors ${selectedAdmin.isModified ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>Save Access</button>
                                        </div>
                                        <div className="space-y-2">
                                            {adminSidebarLinks.map(link => (
                                                <div key={link.path} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selectedAdmin.permissions?.includes(link.path) ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <link.icon className={`h-4 w-4 ${selectedAdmin.permissions?.includes(link.path) ? 'text-blue-600' : 'text-gray-400'}`} />
                                                        <span className={`text-xs font-bold ${selectedAdmin.permissions?.includes(link.path) ? 'text-blue-900' : 'text-gray-600'}`}>{link.label}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" className="sr-only peer" checked={selectedAdmin.permissions?.includes(link.path) || false} onChange={() => {
                                                            const current = selectedAdmin.permissions || [];
                                                            const next = current.includes(link.path) ? current.filter(p => p !== link.path) : [...current, link.path];
                                                            const updated = { ...selectedAdmin, permissions: next, isModified: true };
                                                            setSelectedAdmin(updated);
                                                            setAdmins(admins.map(a => a._id === updated._id ? updated : a));
                                                        }} />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {selectedAdmin.role !== 'superadmin' && (
                                    <div className="pt-6 border-t border-gray-100 flex gap-3">
                                        <button onClick={() => { setShowDrawer(false); startEditing(selectedAdmin); }} className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-700 text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors">Edit Staff</button>
                                        <button onClick={() => { setShowDrawer(false); handleDeleteAdmin(selectedAdmin._id); }} className="flex-1 h-10 rounded-xl bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors">Delete</button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </div>
    );
};

export default AdminSuper;
