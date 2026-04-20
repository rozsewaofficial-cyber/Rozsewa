import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Shield, Trash2, MapPin, Phone, Mail,
    Briefcase, UserPlus, Fingerprint, Search, Building2,
    Camera, X, Loader2, FileCheck, FileText, XCircle, ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from 'axios';
import API from "@/lib/api";

const SewakManagement = () => {
    const [sewaks, setSewaks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [uploadingDoc, setUploadingDoc] = useState(null);
    const [categories, setCategories] = useState([]);

    const [newSewak, setNewSewak] = useState({
        ownerName: '',
        email: '',
        mobile: '',
        password: '',
        address: '',
        city: '',
        state: '',
        businessType: '',
        documents: []
    });

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
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/sewaks`, {
                headers: { Authorization: `Bearer ${auth?.token}` }
            });
            setSewaks(response.data);
        } catch (error) {
            toast.error("Failed to fetch Sewak list");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSewaks();
        fetchCategories();
    }, []);

    const handleCreateSewak = async (e) => {
        e.preventDefault();
        try {
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            await axios.post(`${import.meta.env.VITE_API_URL}/admin/sewaks`, newSewak, {
                headers: { Authorization: `Bearer ${auth?.token}` }
            });
            toast.success("Sewak registered successfully");
            setShowCreateForm(false);
            setNewSewak({
                ownerName: '', email: '', mobile: '', password: '',
                address: '', city: '', state: '', businessType: 'Internal Service'
            });
            fetchSewaks();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create Sewak");
        }
    };

    const handleFileUpload = async (e, docId) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const data = new FormData();
        data.append("image", file);
        setUploadingDoc(docId);

        try {
            const res = await API.post("/upload", data, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const newDoc = {
                id: docId,
                url: res.data.url,
                status: 'verified', // Admin uploaded, so pre-verified
                verifiedAt: new Date()
            };

            setNewSewak(prev => ({
                ...prev,
                documents: [...prev.documents.filter(d => d.id !== docId), newDoc]
            }));

            toast.success(`${docId.toUpperCase()} uploaded successfully`);
        } catch (err) {
            toast.error("Upload Failed");
        } finally {
            setUploadingDoc(null);
        }
    };

    const getDoc = (id) => newSewak.documents.find(d => d.id === id);

    const filteredSewaks = sewaks.filter(s =>
        s.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.mobile.includes(searchTerm)
    );

    if (loading) return <div className="p-8 text-center">Loading Sewak Management...</div>;

    return (
        <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Sewak Management</h1>
                    <p className="text-gray-500 font-bold mt-1">Manage Rozsewa internal employee providers (0% Commission)</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Search by name or mobile..."
                            className="pl-10 w-full sm:w-64 rounded-2xl border-gray-200 focus:ring-blue-500 h-[52px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-[52px] px-8 font-black shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2"
                    >
                        {showCreateForm ? <XCircle className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                        {showCreateForm ? "Cancel" : "Add New Sewak"}
                    </Button>
                </div>
            </div>

            {showCreateForm && (
                <Card className="border-blue-100 shadow-xl shadow-blue-50 bg-blue-50/30 overflow-hidden">
                    <CardHeader className="bg-white border-b border-gray-100 p-6">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Briefcase className="h-5 w-5 text-blue-600" />
                            Register Internal Sewak (Employee)
                        </CardTitle>
                        <CardDescription>
                            Create a provider profile for a Rozsewa employee. They work for the company and do not earn personal commission from bookings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 bg-white space-y-8">
                        <form onSubmit={handleCreateSewak} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    <Label className="font-bold text-gray-700 uppercase text-[10px] tracking-widest">Full Name</Label>
                                    <Input required placeholder="Employee Name" value={newSewak.ownerName} onChange={(e) => setNewSewak({ ...newSewak, ownerName: e.target.value })} className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-gray-700 uppercase text-[10px] tracking-widest">Email Address</Label>
                                    <Input required type="email" placeholder="email@rozsewa.com" value={newSewak.email} onChange={(e) => setNewSewak({ ...newSewak, email: e.target.value })} className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-gray-700 uppercase text-[10px] tracking-widest">Mobile Number</Label>
                                    <Input required placeholder="10 digit mobile" value={newSewak.mobile} onChange={(e) => setNewSewak({ ...newSewak, mobile: e.target.value })} className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-gray-700 uppercase text-[10px] tracking-widest">Default Password</Label>
                                    <Input required type="password" placeholder="Min 6 characters" value={newSewak.password} onChange={(e) => setNewSewak({ ...newSewak, password: e.target.value })} className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-gray-700 uppercase text-[10px] tracking-widest">Service Category</Label>
                                    <div className="relative">
                                        <select
                                            required
                                            className="w-full h-[52px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 outline-none appearance-none pr-10"
                                            value={newSewak.businessType}
                                            onChange={(e) => setNewSewak({ ...newSewak, businessType: e.target.value })}
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map(cat => (
                                                <option key={cat._id} value={cat.name}>{cat.name}</option>
                                            ))}
                                            <option value="Internal Service">Internal Service (Other)</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                            <ChevronDown className="h-4 w-4 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-gray-700 uppercase text-[10px] tracking-widest">Full Address</Label>
                                    <Input required placeholder="Complete address" value={newSewak.address} onChange={(e) => setNewSewak({ ...newSewak, address: e.target.value })} className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-gray-700 uppercase text-[10px] tracking-widest">City</Label>
                                    <Input required placeholder="Indore" value={newSewak.city} onChange={(e) => setNewSewak({ ...newSewak, city: e.target.value })} className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-gray-700 uppercase text-[10px] tracking-widest">State</Label>
                                    <Input required placeholder="Madhya Pradesh" value={newSewak.state} onChange={(e) => setNewSewak({ ...newSewak, state: e.target.value })} className="rounded-xl" />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <Label className="font-black text-gray-900 uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-blue-600" />
                                    Identity Documents (KYC)
                                </Label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {[
                                        { id: 'aadhaar_front', label: 'Aadhaar Front' },
                                        { id: 'aadhaar_back', label: 'Aadhaar Back' },
                                        { id: 'pan_card', label: 'PAN Card' }
                                    ].map(doc => (
                                        <div key={doc.id} className="space-y-3">
                                            <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{doc.label}</Label>
                                            <label className={`relative block h-32 rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${getDoc(doc.id) ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, doc.id)} accept="image/*" />
                                                {getDoc(doc.id) ? (
                                                    <div className="h-full w-full relative">
                                                        <img src={getDoc(doc.id).url} className="h-full w-full object-cover opacity-60" />
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-600/10">
                                                            <FileCheck className="h-6 w-6 text-blue-600" />
                                                            <span className="text-[8px] font-black text-blue-600 mt-1 uppercase">Uploaded</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-full w-full flex flex-col items-center justify-center">
                                                        {uploadingDoc === doc.id ? (
                                                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                                        ) : (
                                                            <>
                                                                <Camera className="h-6 w-6 text-gray-300" />
                                                                <span className="text-[8px] font-black text-gray-300 mt-1 uppercase tracking-widest">Click to Upload</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-100">
                                <Button
                                    type="submit"
                                    disabled={uploadingDoc !== null}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-16 rounded-2xl shadow-xl shadow-blue-600/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                                >
                                    {uploadingDoc ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <UserPlus className="h-5 w-5" />
                                            <span>Register & Save Sewak</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSewaks.map((sewak) => (
                    <Card key={sewak._id} className="border-gray-100 hover:border-blue-200 transition-all group hover:shadow-lg hover:shadow-blue-50/50 rounded-2xl overflow-hidden">
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center font-black text-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0">
                                    {sewak.ownerName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-base text-gray-900 leading-tight truncate">{sewak.ownerName}</h3>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[8px] uppercase tracking-widest font-black bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full">
                                            SEWAK
                                        </span>
                                        <span className="text-[8px] uppercase tracking-widest font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                            {sewak.vendorCode}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2.5 text-gray-500 bg-gray-50/40 p-2 rounded-xl border border-gray-50 group-hover:border-blue-100 transition-colors">
                                    <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                                        <Phone className="h-3.5 w-3.5 text-blue-500" />
                                    </div>
                                    <span className="text-xs font-bold truncate">{sewak.mobile}</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-gray-500 bg-gray-50/40 p-2 rounded-xl border border-gray-50 group-hover:border-blue-100 transition-colors">
                                    <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                                        <Mail className="h-3.5 w-3.5 text-blue-500" />
                                    </div>
                                    <span className="text-xs font-bold truncate">{sewak.email || 'No email'}</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-gray-500 bg-gray-50/40 p-2 rounded-xl border border-gray-50 group-hover:border-blue-100 transition-colors">
                                    <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                                        <Building2 className="h-3.5 w-3.5 text-blue-500" />
                                    </div>
                                    <span className="text-xs font-bold truncate">{sewak.businessType}</span>
                                </div>
                            </div>

                            {sewak.documents?.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap gap-1.5">
                                    {sewak.documents.map(doc => (
                                        <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[7px] font-black text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors whitespace-nowrap">
                                            <FileCheck className="h-2 w-2" /> {doc.id.replace('_', '').toUpperCase()}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {filteredSewaks.length === 0 && !loading && (
                <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
                    <Users className="h-16 w-16 text-gray-200 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-gray-400 uppercase tracking-tighter">No Sewaks registered yet</h3>
                    <p className="text-gray-400 font-bold max-w-xs mx-auto mt-2">Start by clicking the "Add New Sewak" button above.</p>
                </div>
            )}
        </div>
    );
};

export default SewakManagement;
