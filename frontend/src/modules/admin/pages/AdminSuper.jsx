import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Shield, Lock, Trash2, CheckCircle2, XCircle,
    ChevronRight, Save, UserPlus, Fingerprint, CreditCard, Percent, Zap
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from 'axios';
import { adminSidebarLinks } from "../components/AdminSidebar";



const AdminSuper = () => {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPin, setNewPin] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingAdminId, setEditingAdminId] = useState(null);
    const [newAdmin, setNewAdmin] = useState({
        name: '',
        email: '',
        mobile: '',
        password: '',
        permissions: []
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
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/settings`, {
                headers: { Authorization: `Bearer ${auth?.token}` }
            });
            setSettings(response.data);
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };

    const fetchAdmins = async () => {
        try {
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/admins`, {
                headers: { Authorization: `Bearer ${auth?.token}` }
            });
            setAdmins(response.data);
        } catch (error) {
            toast.error("Failed to fetch admins");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
        fetchSettings();
    }, []);

    const updateAdminSetting = async (key, value) => {
        try {
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            await axios.post(`${import.meta.env.VITE_API_URL}/admin/settings`, { key, value }, {
                headers: { Authorization: `Bearer ${auth?.token}` }
            });
            setSettings(prev => ({ ...prev, [key]: value }));
            toast.success("Settings updated");
        } catch (error) {
            toast.error("Failed to update setting");
        }
    };

    const handleCreateOrUpdateAdmin = async (e) => {
        e.preventDefault();
        try {
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            if (isEditing) {
                await axios.put(`${import.meta.env.VITE_API_URL}/admin/admins/${editingAdminId}`, newAdmin, {
                    headers: { Authorization: `Bearer ${auth?.token}` }
                });
                toast.success("Admin updated successfully");
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL}/admin/admins`, newAdmin, {
                    headers: { Authorization: `Bearer ${auth?.token}` }
                });
                toast.success("Admin created successfully");
            }
            setShowCreateForm(false);
            setIsEditing(false);
            setEditingAdminId(null);
            setNewAdmin({ name: '', email: '', mobile: '', password: '', permissions: [] });
            fetchAdmins();
        } catch (error) {
            toast.error(error.response?.data?.message || "Operation failed");
        }
    };

    const handleDeleteAdmin = async (id) => {
        if (!window.confirm("Are you sure you want to delete this admin?")) return;
        try {
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            await axios.delete(`${import.meta.env.VITE_API_URL}/admin/admins/${id}`, {
                headers: { Authorization: `Bearer ${auth?.token}` }
            });
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
            permissions: admin.permissions || []
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
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            await axios.put(`${import.meta.env.VITE_API_URL}/admin/admins/${admin._id}/permissions`, {
                permissions: admin.permissions
            }, {
                headers: { Authorization: `Bearer ${auth?.token}` }
            });
            toast.success(`Permissions updated for ${admin.name}`);
            setAdmins(admins.map(a => a._id === admin._id ? { ...a, isModified: false } : a));
        } catch (error) {
            toast.error("Failed to save permissions");
        }
    };

    const handleUpdatePin = async () => {
        if (newPin.length !== 4) return toast.error("PIN must be 4 digits");
        try {
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            await axios.post(`${import.meta.env.VITE_API_URL}/admin/update-pin`, { pin: newPin }, {
                headers: { Authorization: `Bearer ${auth?.token}` }
            });
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
                                setNewAdmin({ name: '', email: '', mobile: '', password: '', permissions: [] });
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

                    {/* Elite Subscription Card */}
                    <Card className="border-gray-200 shadow-xl shadow-gray-50 bg-emerald-900 group overflow-hidden">
                        <CardHeader className="bg-emerald-950/20 border-b border-emerald-800/50">
                            <CardTitle className="text-xl flex items-center gap-3 text-white">
                                <Zap className="h-5 w-5 text-amber-400 fill-amber-400" />
                                Subscription Plan
                            </CardTitle>
                            <CardDescription className="text-emerald-300/80">Manage the elite provider subscription (₹999)</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="flex items-center justify-between p-4 bg-emerald-950/40 rounded-2xl border border-emerald-800 transition-all hover:bg-emerald-950/60">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black text-white">Active Status</Label>
                                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Enable Subscriptions</p>
                                </div>
                                <Switch
                                    checked={settings.subscription_enabled}
                                    onCheckedChange={(val) => updateAdminSetting('subscription_enabled', val)}
                                    className="data-[state=checked]:bg-amber-400"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black text-emerald-400 uppercase">Plan Price (₹)</Label>
                                    <Input
                                        type="number"
                                        className="bg-emerald-950/40 border-emerald-800 text-white font-black rounded-xl h-10"
                                        value={settings.subscription_price}
                                        onChange={(e) => setSettings(prev => ({ ...prev, subscription_price: e.target.value }))}
                                    />
                                    <Button
                                        onClick={() => updateAdminSetting('subscription_price', Number(settings.subscription_price))}
                                        className="w-full bg-emerald-700 hover:bg-white hover:text-emerald-900 text-white font-bold h-9 rounded-xl text-xs transition-all"
                                    >
                                        Update Price
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black text-emerald-400 uppercase">Disc. Rate (%)</Label>
                                    <Input
                                        type="number"
                                        className="bg-emerald-950/40 border-emerald-800 text-white font-black rounded-xl h-10"
                                        value={settings.subscription_commission_rate}
                                        onChange={(e) => setSettings(prev => ({ ...prev, subscription_commission_rate: e.target.value }))}
                                    />
                                    <Button
                                        onClick={() => updateAdminSetting('subscription_commission_rate', Number(settings.subscription_commission_rate))}
                                        className="w-full bg-emerald-700 hover:bg-white hover:text-emerald-900 text-white font-bold h-9 rounded-xl text-xs transition-all"
                                    >
                                        Update Rate
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <Users className="h-6 w-6 text-emerald-600" />
                            Administrative Accounts
                        </h2>
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full border border-emerald-100">
                            {admins.length} ACTIVE STAFF
                        </span>
                    </div>
                    {admins.map((admin) => (
                        <Card key={admin._id} className="border-gray-200 hover:border-emerald-200 transition-all shadow-sm overflow-hidden group">
                            <div className="flex flex-col">
                                {/* Admin Info Header */}
                                <div className="bg-gray-50/50 p-6 md:p-8 border-b border-gray-100">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center gap-5">
                                            <div className={`h-16 w-16 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner ${admin.role === 'superadmin' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                                {admin.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-xl font-black text-gray-900">{admin.name}</h3>
                                                    <span className={`text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-full ${admin.role === 'superadmin' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                                        {admin.role}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                                        <Shield className="h-3.5 w-3.5 text-gray-400" /> {admin.email}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                                        <Shield className="h-3.5 w-3.5 text-gray-400" /> {admin.mobile}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {admin.role !== 'superadmin' && (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => startEditing(admin)}
                                                        className="border-gray-200 hover:border-emerald-200 hover:bg-emerald-50 text-gray-600 font-bold rounded-xl"
                                                    >
                                                        <Fingerprint className="h-4 w-4 mr-2" /> Edit Details
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteAdmin(admin._id)}
                                                        className="bg-red-50 hover:bg-red-100 text-red-600 border-none font-bold rounded-xl"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                    </Button>
                                                    <Button
                                                        disabled={!admin.isModified}
                                                        onClick={() => savePermissions(admin)}
                                                        className={`font-black text-sm px-6 rounded-xl transition-all ${admin.isModified
                                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100"
                                                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                            }`}
                                                    >
                                                        <Save className="h-4 w-4 mr-2" />
                                                        Save Access
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Permissions Section */}
                                <div className="p-6 md:p-8">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                                <Shield className="h-4 w-4 text-emerald-600" />
                                                Module Access Permissions
                                            </h4>
                                            <p className="text-[11px] text-gray-500 font-bold mt-1">Select which dashboard modules this administrator can access</p>
                                        </div>
                                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-4 py-2 rounded-xl border border-emerald-100">
                                            {admin.role === 'superadmin' ? 'UNRESTRICTED ACCESS' : `${admin.permissions?.length || 0} MODULES ALLOWED`}
                                        </span>
                                    </div>

                                    {admin.role === 'superadmin' ? (
                                        <div className="bg-amber-50/50 border-2 border-dashed border-amber-100 rounded-2xl p-10 text-center">
                                            <Shield className="h-10 w-10 text-amber-400 mx-auto mb-3 opacity-50" />
                                            <p className="font-black text-amber-700 uppercase tracking-widest text-xs">Super Admin has full system access</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                                            {adminSidebarLinks.map((section) => (
                                                <label
                                                    key={section.path}
                                                    htmlFor={`${admin._id}-${section.path}`}
                                                    className={`group relative flex flex-col items-center text-center p-5 rounded-[1.5rem] border transition-all cursor-pointer min-h-[150px] select-none ${admin.permissions?.includes(section.path)
                                                        ? "bg-emerald-50 border-emerald-200 shadow-lg shadow-emerald-100/50"
                                                        : "bg-white border-gray-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-gray-200/50"
                                                        }`}
                                                >
                                                    <div className={`p-3 rounded-2xl mb-3 transition-all ${admin.permissions?.includes(section.path) ? "bg-emerald-200 text-emerald-800 scale-110" : "bg-gray-50 text-gray-400 group-hover:bg-emerald-100 group-hover:text-emerald-600"}`}>
                                                        <section.icon className="h-5 w-5" />
                                                    </div>

                                                    <div className="flex-1 flex flex-col justify-center mb-4 min-w-0 w-full">
                                                        <span className={`text-[10px] font-black leading-tight uppercase tracking-widest break-words ${admin.permissions?.includes(section.path) ? "text-emerald-900" : "text-gray-500 group-hover:text-emerald-600"
                                                            }`}>
                                                            {section.label}
                                                        </span>
                                                    </div>

                                                    <Switch
                                                        id={`${admin._id}-${section.path}`}
                                                        checked={admin.permissions?.includes(section.path)}
                                                        onCheckedChange={() => togglePermission(admin._id, section.path)}
                                                        className="data-[state=checked]:bg-emerald-600 shadow-sm pointer-events-none"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminSuper;
