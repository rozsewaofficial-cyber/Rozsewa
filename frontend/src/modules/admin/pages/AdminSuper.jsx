import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Shield, Lock, Trash2, CheckCircle2, XCircle,
    ChevronRight, Save, UserPlus, Fingerprint, CreditCard, Percent, Zap,
    MoreVertical, Mail, Phone, Calendar, Info, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import API from "@/lib/api";
import { adminSidebarLinks } from "../components/AdminSidebar";



const AdminSuper = () => {
    const [admins, setAdmins] = useState([]);
    const [sewaks, setSewaks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPin, setNewPin] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showSewakForm, setShowSewakForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingAdminId, setEditingAdminId] = useState(null);
    const [newAdmin, setNewAdmin] = useState({
        name: '',
        email: '',
        mobile: '',
        password: '',
        permissions: [],
        kycAccess: false,
        kycLimit: 50,
        kycBonusPerVerification: 10
    });
    const [kycPerformance, setKycPerformance] = useState([]);
    const [selectedAdmin, setSelectedAdmin] = useState(null);
    const [showDrawer, setShowDrawer] = useState(false);

    const [newSewak, setNewSewak] = useState({
        ownerName: '',
        mobile: '',
        password: '',
        email: '',
        address: '',
        city: '',
        state: '',
        latitude: '',
        longitude: '',
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

    const fetchSettings = async () => {
        try {
            const response = await API.get('/admin/settings');
            setSettings(response.data);
        } catch (error) {
            console.error("Failed to fetch settings", error);
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

    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true);
            await Promise.all([fetchAdmins(), fetchSettings(), fetchSewaks(), fetchKycPerformance()]);
            setLoading(false);
        };
        loadAllData();
    }, []);

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
        try {
            if (isEditing) {
                await API.put(`/admin/admins/${editingAdminId}`, newAdmin);
                toast.success("Admin updated successfully");
            } else {
                await API.post('/admin/admins', newAdmin);
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
        try {
            await API.post('/admin/sewaks', newSewak);
            toast.success("Sewak created successfully");
            setShowSewakForm(false);
            setNewSewak({
                ownerName: '', mobile: '', password: '', email: '',
                address: '', city: '', state: '', latitude: '', longitude: '',
                businessType: 'Internal Service'
            });
            fetchSewaks();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create sewak");
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
            name: admin.name,
            email: admin.email,
            mobile: admin.mobile,
            password: '', // Leave password empty for editing
            permissions: admin.permissions || [],
            kycAccess: admin.kycAccess || false,
            kycLimit: admin.kycLimit || 50,
            kycBonusPerVerification: admin.kycBonusPerVerification || 10
        });
        setEditingAdminId(admin._id);
        setIsEditing(true);
        setShowCreateForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const togglePermission = (adminId, path) => {
        setAdmins(admins.map(admin => {
            if (admin._id === adminId) {
                const currentPermissions = admin.permissions || [];
                const newPermissions = currentPermissions.includes(path)
                    ? currentPermissions.filter(p => p !== path)
                    : [...currentPermissions, path];
                return { ...admin, permissions: newPermissions, isModified: true };
            }
            return admin;
        }));
    };

    const savePermissions = async (admin) => {
        try {
            await API.put(`/admin/admins/${admin._id}/permissions`, {
                permissions: admin.permissions
            });
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
            toast.success("Super Admin PIN updated successfully");
            setNewPin('');
        } catch (error) {
            toast.error("Failed to update PIN");
        }
    };

    if (loading) return <div className="p-8 text-center">Loading Admin Management...</div>;

    return (
        <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Super Admin Hub</h1>
                    <p className="text-gray-500 font-bold mt-1">Manage administrative staff and platform security</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm">
                        <Fingerprint className="h-5 w-5 text-emerald-600 mr-3" />
                        <Input
                            type="password"
                            placeholder="New 4-digit PIN"
                            className="border-none focus:ring-0 w-32 h-8 text-sm font-bold bg-transparent"
                            maxLength={4}
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value)}
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-600 hover:text-emerald-700 font-black"
                            onClick={handleUpdatePin}
                        >
                            Update
                        </Button>
                    </div>
                    <Button
                        onClick={() => {
                            if (showCreateForm) {
                                setIsEditing(false);
                                setEditingAdminId(null);
                                setNewAdmin({ name: '', email: '', mobile: '', password: '', permissions: [], kycAccess: false, kycLimit: 50, kycBonusPerVerification: 10 });
                            }
                            setShowCreateForm(!showCreateForm);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-[52px] px-8 font-black shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
                    >
                        {showCreateForm ? <Lock className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                        {showCreateForm ? "Cancel" : "Add New Admin"}
                    </Button>
                </div>
            </div>

            {showCreateForm && (
                <Card className="border-emerald-100 shadow-xl shadow-emerald-50 bg-emerald-50/30 overflow-hidden">
                    <CardHeader className="bg-white border-b border-gray-100">
                        <CardTitle className="flex items-center gap-2">
                            {isEditing ? <Fingerprint className="h-5 w-5 text-emerald-600" /> : <Plus className="h-5 w-5 text-emerald-600" />}
                            {isEditing ? "Edit Administrative Account" : "Create Administrative Account"}
                        </CardTitle>
                        <CardDescription>
                            {isEditing ? `Updating details for ${newAdmin.name}` : "Enter credentials for a new administrator who will help manage the platform."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={handleCreateOrUpdateAdmin} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <Label className="font-bold text-gray-700">Full Name</Label>
                                <Input
                                    required
                                    className="bg-white focus:ring-emerald-500"
                                    placeholder="e.g. John Doe"
                                    value={newAdmin.name}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-gray-700">Email Address</Label>
                                <Input
                                    required
                                    type="email"
                                    className="bg-white"
                                    placeholder="admin@email.com"
                                    value={newAdmin.email}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-gray-700">Phone Number</Label>
                                <Input
                                    required
                                    className="bg-white"
                                    placeholder="10 digit mobile"
                                    value={newAdmin.mobile}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, mobile: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-gray-700">{isEditing ? "Update Password (Optional)" : "Access Password"}</Label>
                                <div className="flex gap-2">
                                    <Input
                                        required={!isEditing}
                                        type="password"
                                        className="bg-white"
                                        placeholder={isEditing ? "Leave blank to keep same" : "Min 6 characters"}
                                        value={newAdmin.password}
                                        onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                                    />
                                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6">
                                        {isEditing ? "Update" : "Create"}
                                    </Button>
                                </div>
                            </div>

                            {/* KYC Incentive Controls */}
                            <div className="md:col-span-2 lg:col-span-4 p-4 bg-white rounded-2xl border border-emerald-100 flex flex-col md:flex-row items-center gap-6 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <Switch 
                                        checked={newAdmin.kycAccess}
                                        onCheckedChange={(val) => setNewAdmin({ ...newAdmin, kycAccess: val })}
                                        className="data-[state=checked]:bg-emerald-600"
                                    />
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-black text-gray-900 uppercase">KYC Incentive Access</Label>
                                        <p className="text-[10px] font-bold text-gray-400">Allow this admin to earn bonuses on KYC verification</p>
                                    </div>
                                </div>

                                {newAdmin.kycAccess && (
                                    <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex flex-col sm:flex-row items-center gap-4 flex-1"
                                    >
                                        <div className="w-full sm:w-auto flex-1 space-y-1">
                                            <Label className="text-[10px] font-black text-gray-500 uppercase ml-1">Verification Limit</Label>
                                            <Input 
                                                type="number"
                                                placeholder="e.g. 50"
                                                value={newAdmin.kycLimit}
                                                onChange={(e) => setNewAdmin({ ...newAdmin, kycLimit: Number(e.target.value) })}
                                                className="h-10 rounded-xl font-black text-xs"
                                            />
                                        </div>
                                        <div className="w-full sm:w-auto flex-1 space-y-1">
                                            <Label className="text-[10px] font-black text-gray-500 uppercase ml-1">Bonus per KYC (₹)</Label>
                                            <Input 
                                                type="number"
                                                placeholder="e.g. 10"
                                                value={newAdmin.kycBonusPerVerification}
                                                onChange={(e) => setNewAdmin({ ...newAdmin, kycBonusPerVerification: Number(e.target.value) })}
                                                className="h-10 rounded-xl font-black text-xs"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="col-span-1 space-y-8">
                    {/* Membership Card */}
                    <Card className="border-gray-200 shadow-xl shadow-gray-50 bg-white group overflow-hidden">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                            <CardTitle className="text-xl flex items-center gap-3">
                                <CreditCard className="h-5 w-5 text-blue-600" />
                                Registration Settings
                            </CardTitle>
                            <CardDescription>Manage the membership step during signup</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-8">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-all hover:border-blue-100">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black text-gray-900">99 Membership</Label>
                                    <p className="text-[10px] text-gray-500 font-bold">Show payment step in signup</p>
                                </div>
                                <Switch
                                    checked={settings.vendorCardEnabled}
                                    onCheckedChange={(val) => updateAdminSetting('vendorCardEnabled', val)}
                                    className="data-[state=checked]:bg-blue-600"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm font-black text-gray-900">Membership Price (₹)</Label>
                                </div>
                                <div className="flex gap-3">
                                    <Input
                                        type="number"
                                        className="h-10 rounded-xl border-gray-200 font-black"
                                        value={settings.vendorCardPrice}
                                        onChange={(e) => setSettings(prev => ({ ...prev, vendorCardPrice: e.target.value }))}
                                    />
                                    <Button
                                        onClick={() => updateAdminSetting('vendorCardPrice', Number(settings.vendorCardPrice))}
                                        size="sm"
                                        className="bg-blue-600 hover:bg-black text-white rounded-xl px-4 font-black"
                                    >
                                        Update
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tiered Commission Card */}
                    <Card className="border-gray-200 shadow-xl shadow-gray-50 bg-white group overflow-hidden">
                        <CardHeader className="bg-gray-100/50 border-b border-gray-100">
                            <CardTitle className="text-xl flex items-center gap-3">
                                <Percent className="h-5 w-5 text-emerald-600" />
                                Tiered Commissions
                            </CardTitle>
                            <CardDescription>Set percentage based on provider plan</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {[
                                { key: 'commission_basic', label: 'Basic Plan', color: 'text-gray-600' },
                                { key: 'commission_standard', label: 'Standard Plan', color: 'text-blue-600' },
                                { key: 'commission_premium', label: 'Premium Plan', color: 'text-amber-600' }
                            ].map((tier) => (
                                <div key={tier.key} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className={`text-xs font-black ${tier.color} uppercase tracking-wider`}>{tier.label}</Label>
                                        <span className="text-xs font-black text-gray-400">{settings[tier.key]}%</span>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <Input
                                                type="number"
                                                className="h-10 rounded-xl border-gray-100 bg-gray-50/50 font-black text-sm"
                                                value={settings[tier.key]}
                                                onChange={(e) => setSettings(prev => ({ ...prev, [tier.key]: e.target.value }))}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-xs">%</span>
                                        </div>
                                        <Button
                                            onClick={() => updateAdminSetting(tier.key, Number(settings[tier.key]))}
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-black text-white rounded-xl px-4 font-bold"
                                        >
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>


                </div>

                <div className="lg:col-span-2 space-y-12">
                    {/* Administrative Accounts Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                <Users className="h-6 w-6 text-emerald-600" />
                                Administrative Accounts
                            </h2>
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full border border-emerald-100">
                                {admins.length} ACTIVE STAFF
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {admins.map((admin) => (
                                <Card key={admin._id} className="border-gray-100 hover:border-blue-200 transition-all shadow-sm overflow-hidden group bg-white">
                                    <div className="p-5 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${admin.role === 'superadmin' ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                                                {admin.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-base font-black text-gray-900">{admin.name}</h3>
                                                    <span className={`text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-md ${admin.role === 'superadmin' ? "bg-amber-100 text-amber-700" : "bg-blue-100/50 text-blue-700"}`}>
                                                        {admin.role}
                                                    </span>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${admin.isActive !== false ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                                </div>
                                                <p className="text-xs font-bold text-gray-400 mt-0.5">{admin.email} • {admin.mobile}</p>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setSelectedAdmin(admin);
                                                setShowDrawer(true);
                                            }}
                                            className="group/btn flex items-center gap-2 rounded-xl border border-gray-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 px-4 py-2 text-xs font-black transition-all"
                                        >
                                            View Details
                                            <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Details Drawer */}
                        <AnimatePresence>
                            {showDrawer && selectedAdmin && (
                                <>
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowDrawer(false)}
                                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100]"
                                    />
                                    <motion.div
                                        initial={{ x: '100%' }}
                                        animate={{ x: 0 }}
                                        exit={{ x: '100%' }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                        className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col"
                                    >
                                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                                <Info className="h-5 w-5 text-blue-600" />
                                                Admin Details
                                            </h3>
                                            <Button variant="ghost" size="sm" onClick={() => setShowDrawer(false)} className="rounded-xl">
                                                <X className="h-5 w-5" />
                                            </Button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                            {/* Profile Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`h-20 w-20 rounded-3xl flex items-center justify-center font-black text-3xl shadow-inner ${selectedAdmin.role === 'superadmin' ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                                                        {selectedAdmin.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-2xl font-black text-gray-900">{selectedAdmin.name}</h4>
                                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{selectedAdmin.role}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 pt-4">
                                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                                        <Mail className="h-4 w-4 text-gray-400" />
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase">Email Address</p>
                                                            <p className="text-sm font-bold text-gray-900 truncate">{selectedAdmin.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                                        <Phone className="h-4 w-4 text-gray-400" />
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-400 uppercase">Mobile Number</p>
                                                            <p className="text-sm font-bold text-gray-900">{selectedAdmin.mobile}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                                        <Calendar className="h-4 w-4 text-gray-400" />
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-400 uppercase">Account Created</p>
                                                            <p className="text-sm font-bold text-gray-900">{new Date(selectedAdmin.createdAt).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KYC Incentive Badge Section */}
                                            {selectedAdmin.role === 'admin' && (
                                                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-4">
                                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selectedAdmin.kycAccess ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-gray-100 text-gray-400'}`}>
                                                        <Zap className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">KYC Incentive</p>
                                                        <h5 className="text-sm font-black text-gray-900">
                                                            {selectedAdmin.kycAccess ? `₹${selectedAdmin.kycBonusPerVerification} per KYC` : 'Disabled'}
                                                        </h5>
                                                        {selectedAdmin.kycAccess && (
                                                            <p className="text-[10px] font-bold text-emerald-600 uppercase">Limit: {selectedAdmin.kycLimit} verifications</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions Section */}
                                            {selectedAdmin.role !== 'superadmin' && (
                                                <div className="space-y-4">
                                                    <h5 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-1">Management Actions</h5>
                                                    <div className="flex gap-3">
                                                        <Button
                                                            variant="outline"
                                                            className="flex-1 rounded-2xl font-black text-xs h-12 border-gray-200 hover:bg-gray-50"
                                                            onClick={() => {
                                                                startEditing(selectedAdmin);
                                                                setShowDrawer(false);
                                                            }}
                                                        >
                                                            Edit Profile
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            className="flex-1 rounded-2xl font-black text-xs h-12 bg-red-50 text-red-600 hover:bg-red-100 border-none"
                                                            onClick={() => {
                                                                handleDeleteAdmin(selectedAdmin._id);
                                                                setShowDrawer(false);
                                                            }}
                                                        >
                                                            Delete Account
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Permissions Section */}
                                            <div className="space-y-4 pt-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <h5 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Module Permissions</h5>
                                                    {selectedAdmin.role !== 'superadmin' && (
                                                        <Button
                                                            size="sm"
                                                            disabled={!selectedAdmin.isModified}
                                                            onClick={() => savePermissions(selectedAdmin)}
                                                            className={`rounded-full px-4 h-8 text-[10px] font-black uppercase transition-all ${selectedAdmin.isModified ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-gray-100 text-gray-300"}`}
                                                        >
                                                            Save Changes
                                                        </Button>
                                                    )}
                                                </div>

                                                {selectedAdmin.role === 'superadmin' ? (
                                                    <div className="p-8 bg-amber-50 rounded-[2rem] border border-dashed border-amber-200 flex flex-col items-center text-center gap-3">
                                                        <Shield className="h-8 w-8 text-amber-500" />
                                                        <p className="text-xs font-black text-amber-700 uppercase leading-relaxed tracking-widest">
                                                            Full System Override <br /> No Restrictions
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {adminSidebarLinks.map((section) => (
                                                            <div
                                                                key={section.path}
                                                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedAdmin.permissions?.includes(section.path) ? "bg-blue-50/50 border-blue-100" : "bg-white border-gray-100"}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${selectedAdmin.permissions?.includes(section.path) ? "bg-blue-100 text-blue-600" : "bg-gray-50 text-gray-400"}`}>
                                                                        <section.icon className="h-4 w-4" />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">{section.label}</span>
                                                                </div>
                                                                <Switch
                                                                    checked={selectedAdmin.permissions?.includes(section.path)}
                                                                    onCheckedChange={() => {
                                                                        const currentPermissions = selectedAdmin.permissions || [];
                                                                        const newPermissions = currentPermissions.includes(section.path)
                                                                            ? currentPermissions.filter(p => p !== section.path)
                                                                            : [...currentPermissions, section.path];

                                                                        const updatedAdmin = { ...selectedAdmin, permissions: newPermissions, isModified: true };
                                                                        setSelectedAdmin(updatedAdmin);

                                                                        // Also sync with the list
                                                                        setAdmins(admins.map(a => a._id === selectedAdmin._id ? updatedAdmin : a));
                                                                    }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Sewak Management Section (Compact) */}
                    <div className="space-y-4 pt-8 border-t border-gray-100">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <Shield className="h-5 w-5 text-blue-600" />
                                Sewak Management
                            </h2>
                            <Button onClick={() => setShowSewakForm(!showSewakForm)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-[36px] px-4 text-xs font-black flex items-center gap-2 transition-all">
                                {showSewakForm ? <XCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {showSewakForm ? "Cancel" : "Add Sewak"}
                            </Button>
                        </div>

                        {showSewakForm && (
                            <Card className="border-blue-100 shadow-lg bg-blue-50/20 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                <CardContent className="p-4 space-y-4">
                                    <form onSubmit={handleCreateSewak} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-gray-500">Sewak Name</Label><Input required value={newSewak.ownerName} onChange={(e) => setNewSewak({ ...newSewak, ownerName: e.target.value })} className="bg-white h-9 text-sm" /></div>
                                            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-gray-500">Mobile</Label><Input required value={newSewak.mobile} onChange={(e) => setNewSewak({ ...newSewak, mobile: e.target.value })} className="bg-white h-9 text-sm" /></div>
                                            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-gray-500">Password</Label><Input required type="password" value={newSewak.password} onChange={(e) => setNewSewak({ ...newSewak, password: e.target.value })} className="bg-white h-9 text-sm" /></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-gray-500">Complete Address</Label><Input required value={newSewak.address} onChange={(e) => setNewSewak({ ...newSewak, address: e.target.value })} className="bg-white h-9 text-sm" /></div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-gray-500">City</Label><Input required value={newSewak.city} onChange={(e) => setNewSewak({ ...newSewak, city: e.target.value })} className="bg-white h-9 text-sm" /></div>
                                                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-gray-500">State</Label><Input required value={newSewak.state} onChange={(e) => setNewSewak({ ...newSewak, state: e.target.value })} className="bg-white h-9 text-sm" /></div>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-[9px] font-black text-amber-900 uppercase">Location Mapping (Manual)</h3>
                                                <Button
                                                    type="button"
                                                    onClick={() => {
                                                        if (navigator.geolocation) {
                                                            navigator.geolocation.getCurrentPosition((position) => {
                                                                setNewSewak(prev => ({
                                                                    ...prev,
                                                                    latitude: position.coords.latitude.toString(),
                                                                    longitude: position.coords.longitude.toString()
                                                                }));
                                                                toast.success("Live location fetched");
                                                            }, () => {
                                                                toast.error("Location access denied");
                                                            });
                                                        }
                                                    }}
                                                    className="h-6 px-2 text-[8px] bg-amber-600 hover:bg-amber-700 text-white rounded-md font-black flex items-center gap-1"
                                                >
                                                    <Zap className="h-2.5 w-2.5" /> Fetch Live Location
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Latitude</Label><Input value={newSewak.latitude} onChange={(e) => setNewSewak({ ...newSewak, latitude: e.target.value })} className="bg-white border-amber-200 h-8 text-xs" placeholder="e.g. 28.70" /></div>
                                                <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Longitude</Label><Input value={newSewak.longitude} onChange={(e) => setNewSewak({ ...newSewak, longitude: e.target.value })} className="bg-white border-amber-200 h-8 text-xs" placeholder="e.g. 77.10" /></div>
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <Button type="submit" className="bg-blue-600 hover:bg-black text-white font-black rounded-lg h-9 px-8 text-xs">Register Sewak</Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}

                        <div className="space-y-3">
                            {sewaks.length === 0 ? (
                                <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                                    <p className="text-gray-400 font-bold text-sm">No internal sewaks registered yet.</p>
                                </div>
                            ) : (
                                sewaks.map((sewak) => (
                                    <Card key={sewak._id} className="border-gray-100 hover:border-blue-100 transition-all shadow-sm">
                                        <div className="flex items-center p-3 sm:p-4 gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-black text-sm">{sewak.ownerName.charAt(0)}</div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-black text-gray-900 text-sm truncate">{sewak.ownerName} <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-1">{sewak.vendorCode}</span></h3>
                                                <p className="text-[10px] font-bold text-gray-500 mt-0.5 truncate">{sewak.mobile} • {sewak.city} • GPS: [{sewak.location?.coordinates[1]?.toFixed(4)}, {sewak.location?.coordinates[0]?.toFixed(4)}]</p>
                                            </div>
                                            <Button variant="ghost" onClick={() => {
                                                if (window.confirm("Remove this sewak?")) {
                                                    API.delete(`/admin/providers/${sewak._id}`)
                                                        .then(() => { toast.success("Sewak removed"); fetchSewaks(); });
                                                }
                                            }} className="h-8 w-8 text-gray-300 hover:text-red-600 rounded-lg shrink-0">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin Performance Section */}
            <div className="space-y-6 pt-12 border-t border-gray-100">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <Zap className="h-6 w-6 text-amber-500" />
                        Admin KYC Performance
                    </h2>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={fetchKycPerformance}
                        className="rounded-xl hover:bg-amber-50 text-amber-600 font-black text-[10px] uppercase tracking-widest"
                    >
                        Refresh Data
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {kycPerformance.map((perf) => (
                        <Card key={perf.adminId} className="border-gray-100 hover:border-amber-200 transition-all shadow-sm overflow-hidden bg-white group">
                            <CardContent className="p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-xl">
                                        {perf.name.charAt(0)}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bonus Earned</p>
                                        <p className="text-2xl font-black text-emerald-600 leading-none">₹{perf.totalBonus}</p>
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="text-sm font-black text-gray-900">{perf.name}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Limit: {perf.kycLimit} KYC • Bonus: ₹{perf.bonusPerKyc}/ea</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-black text-gray-500">PROGRESS</span>
                                        <span className="text-xs font-black text-amber-600">{perf.totalVerified} / {perf.kycLimit}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, (perf.totalVerified / perf.kycLimit) * 100)}%` }}
                                            className={`h-full ${perf.totalVerified >= perf.kycLimit ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        />
                                    </div>
                                    {perf.remainingForBonus > 0 ? (
                                        <p className="text-[10px] font-bold text-gray-400 text-center italic">
                                            Need {perf.remainingForBonus} more to start earning
                                        </p>
                                    ) : (
                                        <p className="text-[10px] font-bold text-emerald-600 text-center flex items-center justify-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> Bonus Threshold Reached
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {kycPerformance.length === 0 && (
                        <div className="col-span-full p-12 text-center border-2 border-dashed border-gray-100 rounded-[2.5rem] bg-gray-50/30">
                            <Info className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-gray-400">No performance data available yet. Verifications will show up here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminSuper;
