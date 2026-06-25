import React, { useState, useEffect, useMemo } from 'react';
import { useScrollLock } from '@/lib/scrollLock';
import {
    Users, Plus, Search, Phone, Mail, Trash2, Building2,
    Briefcase, FileCheck, XCircle, Eye, EyeOff, Edit3, Loader2,
    UserPlus, CheckCircle2, Shield, AlertCircle, X, Camera, Fingerprint, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from "sonner";
import API from "@/lib/api";
import { validateEmail, sanitizeEmail } from "@/lib/emailValidation";
import { validatePhone, sanitizePhone } from "@/lib/phoneValidation";
import { validateName, sanitizeName, sanitizeNameOnChange } from "@/lib/nameValidation";
import axios from 'axios';

const InputField = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
        {children}
    </div>
);

const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";

const SewakManagement = () => {
    const [sewaks, setSewaks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useScrollLock(showCreateForm);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [uploadingDoc, setUploadingDoc] = useState(null);
    const [categories, setCategories] = useState([]);
    const [editId, setEditId] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [ifscLoading, setIfscLoading] = useState(false);

    const [newSewak, setNewSewak] = useState({
        ownerName: '', email: '', mobile: '', password: '', confirmPassword: '',
        address: '', city: '', state: '', businessType: 'Internal Service',
        documents: [], bankDetails: { accountNumber: '', ifscCode: '', bankName: '', accountHolderName: '' }
    });

    const fetchLiveLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        setLocationLoading(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await res.json();
                
                if (data && data.address) {
                    const addr = data.address;
                    const city = addr.city || addr.town || addr.village || addr.county || "";
                    const state = addr.state || "";
                    const fullAddress = data.display_name || "";

                    setNewSewak(prev => ({
                        ...prev,
                        city: city,
                        state: state,
                        address: fullAddress
                    }));
                    toast.success("Location fetched successfully");
                } else {
                    toast.error("Could not fetch address details");
                }
            } catch (error) {
                toast.error("Failed to fetch location details");
            } finally {
                setLocationLoading(false);
            }
        }, (error) => {
            toast.error("Location permission denied or unavailable");
            setLocationLoading(false);
        });
    };

    const handleIfscChange = async (e) => {
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        setNewSewak(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, ifscCode: value } }));
        
        if (value.length === 11) {
            setIfscLoading(true);
            try {
                const res = await fetch(`https://ifsc.razorpay.com/${value}`);
                if (res.ok) {
                    const data = await res.json();
                    setNewSewak(prev => ({
                        ...prev,
                        bankDetails: {
                            ...prev.bankDetails,
                            bankName: data.BANK
                        }
                    }));
                    toast.success(`Bank details fetched: ${data.BANK}, ${data.BRANCH}`);
                } else {
                    toast.error("Invalid IFSC Code");
                }
            } catch (error) {
                toast.error("Failed to verify IFSC Code");
            } finally {
                setIfscLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchSewaks();
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchSewaks();
    }, []);

    const fetchCategories = async () => {
        try {
            const { data } = await API.get('/admin/categories');
            setCategories(data);
        } catch (error) {
            console.error("Failed to fetch categories");
        }
    };

    const fetchSewaks = async () => {
        try {
            const { data } = await API.get('/admin/sewaks');
            setSewaks(data);
        } catch (error) {
            toast.error("Failed to fetch Sewak list");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSewak = async (id) => {
        if (!window.confirm("Are you sure you want to delete this Sewak? All their services and combos will also be removed.")) return;
        try {
            await API.delete(`/admin/providers/${id}`);
            toast.success("Sewak deleted successfully");
            setSewaks(prev => prev.filter(s => s._id !== id));
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to delete Sewak");
        }
    };

    const handleCreateSewak = async (e) => {
        e.preventDefault();
        const sanitizedOwnerName = sanitizeName(newSewak.ownerName);
        const nameValidation = validateName(sanitizedOwnerName);
        if (!nameValidation.isValid) {
            toast.error(`Full Name: ${nameValidation.message}`);
            return;
        }

        let sanitizedHolderName = "";
        if (newSewak.bankDetails && newSewak.bankDetails.accountHolderName) {
            sanitizedHolderName = sanitizeName(newSewak.bankDetails.accountHolderName);
            const holderNameValidation = validateName(sanitizedHolderName);
            if (!holderNameValidation.isValid) {
                toast.error(`Account Name: ${holderNameValidation.message}`);
                return;
            }
        }

        if (newSewak.email && !validateEmail(newSewak.email)) {
            toast.error("Please enter a valid email address.");
            return;
        }
        const phoneValidation = validatePhone(newSewak.mobile);
        if (!phoneValidation.isValid) {
            toast.error(phoneValidation.message);
            return;
        }
        if (newSewak.password !== newSewak.confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        const sanitizedSewak = {
            ...newSewak,
            ownerName: sanitizedOwnerName,
            bankDetails: newSewak.bankDetails
                ? { ...newSewak.bankDetails, accountHolderName: sanitizedHolderName }
                : undefined
        };

        setUploadingDoc("saving");
        try {
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            
            if (editId) {
                await axios.put(`${import.meta.env.VITE_API_URL}/admin/sewaks/${editId}`, sanitizedSewak, {
                    headers: { Authorization: `Bearer ${auth?.token}` }
                });
                toast.success("Sewak updated successfully");
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL}/admin/sewaks`, sanitizedSewak, {
                    headers: { Authorization: `Bearer ${auth?.token}` }
                });
                toast.success("Sewak registered successfully");
            }
            
            setShowCreateForm(false);
            resetForm();
            fetchSewaks();
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to ${editId ? 'update' : 'register'} Sewak`);
        } finally {
            setUploadingDoc(null);
        }
    };

    const resetForm = () => {
        setEditId(null);
        setNewSewak({
            ownerName: '', email: '', mobile: '', password: '', confirmPassword: '',
            address: '', city: '', state: '', businessType: 'Internal Service',
            documents: [], bankDetails: { accountNumber: '', ifscCode: '', bankName: '', accountHolderName: '' }
        });
    };

    const handleEditClick = (sewak) => {
        setEditId(sewak._id);
        setNewSewak({
            ownerName: sewak.ownerName || '',
            email: sewak.email || '',
            mobile: sewak.mobile || '',
            password: '',
            confirmPassword: '',
            address: sewak.address || '',
            city: sewak.city || '',
            state: sewak.state || '',
            businessType: sewak.businessType || 'Internal Service',
            documents: sewak.documents || [],
            bankDetails: sewak.bankDetails || { accountNumber: '', ifscCode: '', bankName: '', accountHolderName: '' }
        });
        setShowCreateForm(true);
    };

    // Stats
    const stats = useMemo(() => ({
        total: sewaks.length,
        internal: sewaks.filter(s => s.businessType === 'Internal Service').length,
        specialized: sewaks.filter(s => s.businessType !== 'Internal Service').length,
        verified: sewaks.filter(s => s.status === 'verified').length,
    }), [sewaks]);

    // Categories for filter
    const uniqueCategories = useMemo(() => {
        const cats = new Set(sewaks.map(s => s.businessType || 'Internal Service'));
        return Array.from(cats);
    }, [sewaks]);

    const filteredSewaks = sewaks.filter(s => {
        const searchMatch = s.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            s.mobile.includes(searchTerm) ||
                            (s.vendorCode && s.vendorCode.toLowerCase().includes(searchTerm.toLowerCase()));
        const categoryMatch = categoryFilter === 'all' || s.businessType === categoryFilter;
        return searchMatch && categoryMatch;
    });

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Sewak Management</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">{stats.total} total internal staff registered</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowCreateForm(true); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-sm active:scale-95"
                >
                    <Plus className="h-3.5 w-3.5" /> Register New Sewak
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Sewaks",   value: stats.total,       icon: Users,    cls: "text-gray-700 bg-gray-50 border-gray-200" },
                    { label: "Internal Service", value: stats.internal,  icon: Briefcase, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Specialized",    value: stats.specialized, icon: Building2, cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
                    { label: "Verified KYC",   value: stats.verified,    icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
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

            {/* Filters & Search */}
            <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setCategoryFilter('all')}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                            categoryFilter === 'all' ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                    >
                        All
                        <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-black ${categoryFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>{sewaks.length}</span>
                    </button>
                    {uniqueCategories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                categoryFilter === cat ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                        >
                            {cat}
                            <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-black ${categoryFilter === cat ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {sewaks.filter(s => s.businessType === cat).length}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
                        placeholder="Search by name, mobile, ID..."
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                <th className="py-4 px-5">Sewak Details</th>
                                <th className="py-4 px-5">Category</th>
                                <th className="py-4 px-5">Contact</th>
                                <th className="py-4 px-5">Address</th>
                                <th className="py-4 px-5 text-center">Status</th>
                                <th className="py-4 px-5 text-center">Documents</th>
                                <th className="py-4 px-5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="py-20 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                                        <p className="text-sm text-gray-400 mt-3 font-medium">Loading sewaks...</p>
                                    </td>
                                </tr>
                            ) : filteredSewaks.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-20 text-center">
                                        <Users className="h-10 w-10 text-gray-200 mx-auto" />
                                        <p className="text-sm text-gray-400 mt-3 font-bold">No sewaks found</p>
                                        <p className="text-xs text-gray-300 mt-1">Try adjusting your search or filter</p>
                                    </td>
                                </tr>
                            ) : (
                                <AnimatePresence>
                                    {filteredSewaks.map((sewak, idx) => (
                                        <motion.tr
                                            key={sewak._id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className="hover:bg-gray-50/80 transition-colors group"
                                        >
                                            {/* Sewak Details */}
                                            <td className="py-3.5 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-black border bg-blue-50 text-blue-700 border-blue-200">
                                                        {(sewak.ownerName || "?").charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{sewak.ownerName}</p>
                                                        <p className="text-[10px] font-mono font-bold text-blue-600 mt-0.5">{sewak.vendorCode || '-'}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-3.5 px-5">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-indigo-50 text-indigo-700 border-indigo-200">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                                                    {sewak.businessType || 'Internal Service'}
                                                </span>
                                            </td>

                                            {/* Contact */}
                                            <td className="py-3.5 px-5">
                                                <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5"><Mail className="h-3 w-3 text-gray-400" />{sewak.email || '-'}</p>
                                                <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5 mt-0.5"><Phone className="h-3 w-3 text-gray-400" />{sewak.mobile || '-'}</p>
                                            </td>

                                            {/* Address */}
                                            <td className="py-3.5 px-5">
                                                <p className="text-xs font-bold text-gray-800 truncate max-w-[150px]">{sewak.city || '-'}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{sewak.state || '-'}</p>
                                            </td>

                                            {/* Status */}
                                            <td className="py-3.5 px-5 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    sewak.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                    sewak.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                    'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                    {sewak.status || 'Pending'}
                                                </span>
                                            </td>

                                            {/* Documents */}
                                            <td className="py-3.5 px-5 text-center">
                                                {sewak.documents?.length > 0 ? (
                                                    <div className="flex justify-center gap-1">
                                                        {sewak.documents.map(doc => (
                                                            <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" title={doc.id} className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 hover:bg-blue-100 transition-colors">
                                                                <FileCheck className="h-3.5 w-3.5" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-gray-400 font-bold italic">No Docs</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => handleEditClick(sewak)} title="Edit" className="h-7 w-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDeleteSewak(sewak._id)} title="Delete" className="h-7 w-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Footer */}
                {filteredSewaks.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Showing {filteredSewaks.length} of {sewaks.length} sewaks</p>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showCreateForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">{editId ? "Edit Sewak Profile" : "Register Internal Sewak"}</h3>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">Internal employees with 0% Commission</p>
                                </div>
                                <button onClick={() => { setShowCreateForm(false); resetForm(); }} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSewak} className="p-6 space-y-6">
                                <div>
                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Briefcase className="h-4 w-4"/> Personal Details</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <InputField label="Full Name">
                                            <input required type="text" value={newSewak.ownerName}
                                                onChange={(e) => setNewSewak({ ...newSewak, ownerName: sanitizeNameOnChange(e.target.value) })}
                                                className={inputCls} placeholder="Sewak Name" />
                                        </InputField>
                                        <InputField label="Mobile Number">
                                            <input required type="tel" value={newSewak.mobile}
                                                onChange={(e) => setNewSewak({ ...newSewak, mobile: sanitizePhone(e.target.value) })}
                                                maxLength="10"
                                                className={inputCls} placeholder="10 digit mobile" />
                                        </InputField>
                                        <InputField label="Email Address">
                                            <input required type="email" value={newSewak.email}
                                                onChange={(e) => { setNewSewak({ ...newSewak, email: sanitizeEmail(e.target.value) }); }}
                                                className={inputCls} placeholder="email@rozsewa.com" />
                                        </InputField>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Shield className="h-4 w-4"/> Security & Category</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <InputField label="Service Category">
                                            <select required value={newSewak.businessType} onChange={(e) => setNewSewak({ ...newSewak, businessType: e.target.value })} className={inputCls}>
                                                <option value="">Select Category</option>
                                                {categories.map(cat => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
                                                <option value="Internal Service">Internal Service (Other)</option>
                                            </select>
                                        </InputField>
                                        <InputField label={editId ? "Password (Edit to Change)" : "Login Password"}>
                                            <div className="relative">
                                                <input required={!editId} type={showPassword ? "text" : "password"} value={newSewak.password}
                                                    onChange={(e) => setNewSewak({ ...newSewak, password: e.target.value })}
                                                    className={`${inputCls} pr-10`} placeholder={editId ? "Leave blank to keep" : "Set password"} />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors">
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </InputField>
                                        <InputField label="Confirm Password">
                                            <div className="relative">
                                                <input required={!editId} type={showConfirmPassword ? "text" : "password"} value={newSewak.confirmPassword}
                                                    onChange={(e) => setNewSewak({ ...newSewak, confirmPassword: e.target.value })}
                                                    className={`${inputCls} pr-10`} placeholder="Re-enter password" />
                                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors">
                                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </InputField>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Building2 className="h-4 w-4"/> Location</h4>
                                        <button type="button" onClick={fetchLiveLocation} disabled={locationLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50">
                                            {locationLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                                            {locationLoading ? "Fetching..." : "Fetch Live Location"}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InputField label="Full Address">
                                            <input required type="text" value={newSewak.address} onChange={(e) => setNewSewak({ ...newSewak, address: e.target.value })} className={inputCls} placeholder="Complete address" />
                                        </InputField>
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField label="City">
                                                <input required type="text" value={newSewak.city} onChange={(e) => setNewSewak({ ...newSewak, city: e.target.value })} className={inputCls} placeholder="City" />
                                            </InputField>
                                            <InputField label="State">
                                                <input required type="text" value={newSewak.state} onChange={(e) => setNewSewak({ ...newSewak, state: e.target.value })} className={inputCls} placeholder="State" />
                                            </InputField>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100">
                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2 mt-4"><Fingerprint className="h-4 w-4"/> Bank Details</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <InputField label="Account Name">
                                            <input type="text" value={newSewak.bankDetails.accountHolderName}
                                                onChange={(e) => setNewSewak({ ...newSewak, bankDetails: { ...newSewak.bankDetails, accountHolderName: sanitizeNameOnChange(e.target.value) } })}
                                                className={inputCls} placeholder="As per passbook" />
                                        </InputField>
                                        <InputField label="Bank Name">
                                            <input type="text" value={newSewak.bankDetails.bankName}
                                                onChange={(e) => setNewSewak({ ...newSewak, bankDetails: { ...newSewak.bankDetails, bankName: e.target.value } })}
                                                className={inputCls} placeholder="e.g. SBI, HDFC" />
                                        </InputField>
                                        <InputField label="Account Number">
                                            <input required minLength={9} maxLength={20} type="text" value={newSewak.bankDetails.accountNumber}
                                                onChange={(e) => setNewSewak({ ...newSewak, bankDetails: { ...newSewak.bankDetails, accountNumber: e.target.value.replace(/\D/g, "") } })}
                                                className={inputCls} placeholder="Bank account no" />
                                        </InputField>
                                        <InputField label="IFSC Code">
                                            <div className="relative">
                                                <input required minLength={11} maxLength={11} type="text" value={newSewak.bankDetails.ifscCode}
                                                    onChange={handleIfscChange}
                                                    className={`${inputCls} uppercase ${ifscLoading ? 'pr-10' : ''}`} placeholder="11 digit code" />
                                                {ifscLoading && (
                                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-600" />
                                                )}
                                            </div>
                                        </InputField>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-6 border-t border-gray-100">
                                    <button type="button" onClick={() => { setShowCreateForm(false); resetForm(); }} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={uploadingDoc !== null} className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                        {uploadingDoc ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : (editId ? "Update Sewak Profile" : "Register Internal Sewak")}
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

export default SewakManagement;
