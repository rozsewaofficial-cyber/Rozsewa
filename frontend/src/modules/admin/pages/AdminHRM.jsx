import { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Plus, Search, Mail, Phone, Trash2,
    UserCircle, BadgeCheck, AlertCircle, Loader2,
    X, IndianRupee, Key, Edit3, Shield, MapPin, Eye, EyeOff,
    CheckCircle2, XCircle, Clock
} from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { validateEmail, sanitizeEmail } from "@/lib/emailValidation";
import { validatePhone, sanitizePhone } from "@/lib/phoneValidation";
import { validateName, sanitizeName, sanitizeNameOnChange } from "@/lib/nameValidation";
import { useAuth } from "@/context/AuthContext";
import { INDIAN_STATES_AND_CITIES } from "@/lib/statesAndCities";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const ROLE_CONFIG = {
    supervisor: { label: "Supervisor", color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500", badge: "bg-purple-50 text-purple-700 border border-purple-200" },
    field_staff: { label: "Field Staff", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border border-orange-200" },
    employee: { label: "Employee", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border border-blue-200" },
};

const STATUS_CONFIG = {
    verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border border-red-200" },
};

const InputField = ({ label, required, children }) => (
    <div className="space-y-1.5 relative text-left">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            {label} {required && <span className="text-red-500 font-bold ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all";

const AdminHRM = ({ view }) => {
    const { setTitle } = useOutletContext();
    const [allEmployees, setAllEmployees] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showStateSuggestions, setShowStateSuggestions] = useState(false);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);

    useScrollLock(showAddModal);
    const [editId, setEditId] = useState(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [cityFilter, setCityFilter] = useState("all");
    const [supervisorFilter, setSupervisorFilter] = useState("all");
    const { toast } = useToast();
    const { user } = useAuth();

    const getDefaultRole = () => {
        if (view === 'supervisor') return 'supervisor';
        if (view === 'employee') return 'employee';
        return user?.role === 'supervisor' ? "employee" : "supervisor";
    };

    const [formData, setFormData] = useState({
        name: "", email: "", mobile: "", password: "",
        role: getDefaultRole(), supervisorCode: "",
        registrationCommission: 50, panCard: "", aadharCard: "",
        state: "Delhi", city: "Delhi", address: "",
        allowedCreationScope: "employee_only",
        panCardPhoto: "", aadharCardPhoto: ""
    });
    const [panPhotoFile, setPanPhotoFile] = useState(null);
    const [aadharPhotoFile, setAadharPhotoFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Verification States
    const [panVerified, setPanVerified] = useState(false);
    const [aadhaarVerified, setAadhaarVerified] = useState(false);
    const [isVerifyingPan, setIsVerifyingPan] = useState(false);
    const [aadhaarSessionId, setAadhaarSessionId] = useState("");
    const [aadhaarOTP, setAadhaarOTP] = useState("");
    const [showAadhaarOTP, setShowAadhaarOTP] = useState(false);
    const [isVerifyingAadhaar, setIsVerifyingAadhaar] = useState(false);
    const [aadhaarCooldown, setAadhaarCooldown] = useState(0);

    const verifyPan = async () => {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panCard)) {
            return toast({ title: "Invalid PAN", description: "Format: ABCDE1234F", variant: "destructive" });
        }
        setIsVerifyingPan(true);
        try {
            const { data } = await API.post('/verify/pan', { pan: formData.panCard });
            if (data.status === "VALID" || data.success) {
                setPanVerified(true);
                toast({ title: "PAN Verified", description: `Name: ${data.data?.full_name || "Success"}` });
            } else {
                toast({ title: "Verification Failed", description: "Invalid PAN", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Verification Failed", description: error.response?.data?.message || "Could not verify PAN", variant: "destructive" });
        } finally {
            setIsVerifyingPan(false);
        }
    };

    const initiateAadhaar = async () => {
        if (!/^\d{12}$/.test(formData.aadharCard)) {
            return toast({ title: "Invalid Aadhaar", description: "Must be 12 digits.", variant: "destructive" });
        }
        setIsVerifyingAadhaar(true);
        try {
            const { data } = await API.post('/verify/okyc/initiate', { aadhaarNumber: formData.aadharCard });
            const sid = data.data?.sessionId || data.sessionId || data.data?.session_id || data.session_id;
            if (sid) {
                setAadhaarSessionId(sid);
                setShowAadhaarOTP(true);
                setAadhaarCooldown(45);
                toast({ title: "OTP Sent", description: data.data?.message || data.message || "OTP sent to Aadhaar linked mobile" });
            } else {
                toast({ title: "Initiation Failed", description: data.message || "Could not send OTP", variant: "destructive" });
            }
        } catch (error) {
            const msg = error.response?.data?.message || "";
            if (msg.includes("45 seconds")) {
                setAadhaarCooldown(45);
            }
            toast({ title: "Initiation Failed", description: msg || "Could not initiate Aadhaar OKYC", variant: "destructive" });
        } finally {
            setIsVerifyingAadhaar(false);
        }
    };

    const verifyAadhaarOtpSubmit = async () => {
        if (!aadhaarOTP || aadhaarOTP.length !== 6) {
            return toast({ title: "Invalid OTP", description: "Please enter 6 digit OTP", variant: "destructive" });
        }
        setIsVerifyingAadhaar(true);
        try {
            const { data } = await API.post('/verify/okyc/verify', {
                sessionId: aadhaarSessionId,
                otp: aadhaarOTP,
                aadhaarNumber: formData.aadharCard
            });
            if (data.success || data.status === "VERIFIED" || data.data?.status === "VALID" || data.data?.status === "VERIFIED") {
                setAadhaarVerified(true);
                setShowAadhaarOTP(false);
                toast({ title: "Aadhaar Verified", description: `Name: ${data.data?.full_name || "Success"}` });
            } else {
                toast({ title: "Verification Failed", description: data.message || "Invalid OTP", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Verification Failed", description: error.response?.data?.message || "Could not verify OTP", variant: "destructive" });
        } finally {
            setIsVerifyingAadhaar(false);
        }
    };

    useEffect(() => { setFormData(prev => ({ ...prev, role: getDefaultRole() })); }, [view, user]);
    useEffect(() => {
        if (view === 'supervisor') setTitle("Supervisors");
        else if (view === 'employee') setTitle("Staff / Employees");
        else setTitle("HRM Portal");
    }, [view, setTitle]);
    useEffect(() => { fetchEmployees(); }, []);

    useEffect(() => {
        if (aadhaarCooldown <= 0) return;
        const timer = setInterval(() => {
            setAadhaarCooldown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [aadhaarCooldown]);


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
        if (view === 'supervisor') filtered = allEmployees.filter(e => e.role === 'supervisor');
        else if (view === 'employee') filtered = allEmployees.filter(e => e.role !== 'supervisor');

        if (cityFilter !== "all") {
            filtered = filtered.filter(e => e.city === cityFilter || e.userId?.city === cityFilter);
        }

        if (supervisorFilter !== "all") {
            filtered = filtered.filter(e => (e.managedBy?.ownCode === supervisorFilter) || (e.supervisorCode === supervisorFilter));
        }

        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(e =>
                e.name.toLowerCase().includes(s) ||
                (e.email || "").toLowerCase().includes(s) ||
                (e.mobile || "").includes(s) ||
                (e.ownCode || "").toLowerCase().includes(s) ||
                (e.city || e.userId?.city || "").toLowerCase().includes(s) ||
                (e.supervisorCode || e.managedBy?.ownCode || "").toLowerCase().includes(s)
            );
        }
        if (roleFilter !== "all") filtered = filtered.filter(e => e.role === roleFilter);
        setEmployees(filtered);
    }, [allEmployees, view, search, roleFilter, cityFilter, supervisorFilter, user]);

    const uniqueCities = useMemo(() => {
        const cities = allEmployees.map(e => e.city || e.userId?.city).filter(Boolean);
        return [...new Set(cities)].sort();
    }, [allEmployees]);

    const uniqueSupervisors = useMemo(() => {
        const sups = allEmployees.map(e => e.managedBy?.ownCode || e.supervisorCode).filter(Boolean);
        return [...new Set(sups)].sort();
    }, [allEmployees]);

    // Stats
    const stats = useMemo(() => {
        const supervisorsList = allEmployees.filter(e => e.role === 'supervisor');
        const employeesList = allEmployees.filter(e => e.role !== 'supervisor');

        if (view === 'supervisor') {
            return {
                total: supervisorsList.length,
                verified: supervisorsList.filter(e => e.status === 'verified').length,
                pending: supervisorsList.filter(e => e.status === 'pending').length,
            };
        } else {
            return {
                total: employeesList.length,
                fieldStaff: employeesList.filter(e => e.role === 'field_staff').length,
                employees: employeesList.filter(e => e.role === 'employee').length,
                pending: employeesList.filter(e => e.status === 'pending').length,
            };
        }
    }, [allEmployees, view]);

    const filteredStates = useMemo(() => {
        const val = (formData.state || "").trim().toLowerCase();
        const allStates = Object.keys(INDIAN_STATES_AND_CITIES);
        if (!val) return allStates.slice(0, 5);
        return allStates.filter(s => s.toLowerCase().includes(val));
    }, [formData.state]);

    const filteredCities = useMemo(() => {
        const val = (formData.city || "").trim().toLowerCase();
        const selectedState = formData.state;
        let citiesPool = [];
        if (selectedState && INDIAN_STATES_AND_CITIES[selectedState]) {
            citiesPool = INDIAN_STATES_AND_CITIES[selectedState];
        } else {
            citiesPool = Object.values(INDIAN_STATES_AND_CITIES).flat();
            citiesPool = [...new Set(citiesPool)];
        }
        if (!val) return citiesPool.slice(0, 5);
        return citiesPool.filter(c => c.toLowerCase().includes(val));
    }, [formData.city, formData.state]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const sanitizedName = sanitizeName(formData.name);
        const nameValidation = validateName(sanitizedName);
        if (!nameValidation.isValid) {
            return toast({ title: "Invalid Name", description: nameValidation.message, variant: "destructive" });
        }
        setFormData(prev => ({ ...prev, name: sanitizedName }));
        const finalFormData = { ...formData, name: sanitizedName };

        if (finalFormData.email && !validateEmail(finalFormData.email)) {
            return toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
        }
        const phoneValidation = validatePhone(finalFormData.mobile);
        if (!phoneValidation.isValid) {
            return toast({ title: "Invalid Mobile", description: phoneValidation.message, variant: "destructive" });
        }
        if (finalFormData.panCard && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(finalFormData.panCard)) {
            return toast({ title: "Invalid PAN", description: "Format: ABCDE1234F", variant: "destructive" });
        }
        if (finalFormData.aadharCard && !/^\d{12}$/.test(finalFormData.aadharCard)) {
            return toast({ title: "Invalid Aadhaar", description: "Must be 12 digits.", variant: "destructive" });
        }
        if (!editId) {
            if (!finalFormData.panCard || !finalFormData.aadharCard) {
                return toast({ title: "Documents Required", description: "Enter both PAN and Aadhaar numbers.", variant: "destructive" });
            }
            if (!panVerified) {
                return toast({ title: "PAN Verification Required", description: "Please verify PAN Card before submitting.", variant: "destructive" });
            }
            if (!aadhaarVerified) {
                return toast({ title: "Aadhaar Verification Required", description: "Please verify Aadhaar with OTP before submitting.", variant: "destructive" });
            }
            if (!panPhotoFile || !aadharPhotoFile) {
                return toast({ title: "Photos Required", description: "Upload both PAN and Aadhaar photos.", variant: "destructive" });
            }
        }
        setUploading(true);
        try {
            let panCardPhoto = "", aadharCardPhoto = "";
            if (panPhotoFile) {
                const fd = new FormData(); fd.append('image', panPhotoFile);
                const { data } = await API.post('/upload', fd);
                panCardPhoto = data.url;
            }
            if (aadharPhotoFile) {
                const fd = new FormData(); fd.append('image', aadharPhotoFile);
                const { data } = await API.post('/upload', fd);
                aadharCardPhoto = data.url;
            }
            const submitData = { ...finalFormData, panCardPhoto, aadharCardPhoto };
            if (submitData.password === "********") delete submitData.password;

            if (editId) {
                const { data } = await API.put(`/admin/employees/${editId}`, submitData);
                setAllEmployees(allEmployees.map(emp => emp._id === editId ? data : emp));
                toast({ title: "Staff updated!" });
            } else {
                const { data } = await API.post("/admin/employees", submitData);
                setAllEmployees([data.employee, ...allEmployees]);
                toast({
                    title: "Staff registered!",
                    description: `ID: ${data.employee.ownCode}`,
                    duration: 8000
                });
            }
            setShowAddModal(false);
            resetForm();
        } catch (err) {
            toast({ title: "Failed", description: err.response?.data?.message || "Something went wrong", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: "", email: "", mobile: "", password: "", role: getDefaultRole(), supervisorCode: "", registrationCommission: 50, panCard: "", aadharCard: "", state: "Delhi", city: "Delhi", address: "", allowedCreationScope: "employee_only", panCardPhoto: "", aadharCardPhoto: "" });
        setEditId(null);
        setPanPhotoFile(null);
        setAadharPhotoFile(null);
        setPanVerified(false);
        setAadhaarVerified(false);
        setShowAadhaarOTP(false);
        setAadhaarOTP("");
        setAadhaarSessionId("");
    };

    const openEditModal = (emp) => {
        setFormData({
            name: emp.name, email: emp.email, mobile: emp.mobile,
            password: emp.userId?.plainPassword || emp.plainPassword || "********",
            role: emp.role || "employee", supervisorCode: emp.supervisorCode || "",
            registrationCommission: emp.registrationCommission, panCard: emp.panCard || "", aadharCard: emp.aadharCard || "",
            state: emp.state || emp.userId?.state || "Delhi",
            city: emp.city || emp.userId?.city || "Delhi",
            address: emp.address || emp.userId?.address || "",
            allowedCreationScope: emp.allowedCreationScope || "employee_only",
            panCardPhoto: emp.panCardPhoto || "",
            aadharCardPhoto: emp.aadharCardPhoto || ""
        });
        setEditId(emp._id);
        // Assume existing staff are verified to bypass check on edit unless they change it
        setPanVerified(!!emp.panCard);
        setAadhaarVerified(!!emp.aadharCard);
        setShowAadhaarOTP(false);
        setShowAddModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Remove this staff member?")) return;
        try {
            await API.delete(`/admin/employees/${id}`);
            setAllEmployees(prev => prev.filter(e => e._id !== id));
            toast({ title: "Staff removed" });
        } catch { toast({ title: "Delete failed", variant: "destructive" }); }
    };

    const handleVerify = async (id) => {
        try {
            await API.put(`/admin/employees/${id}/verify`);
            setAllEmployees(prev => prev.map(e => e._id === id ? { ...e, status: 'verified', isActive: true } : e));
            toast({ title: "Employee Verified" });
        } catch { toast({ title: "Verification Failed", variant: "destructive" }); }
    };

    const handleReject = async (id) => {
        try {
            await API.put(`/admin/employees/${id}/reject`);
            setAllEmployees(prev => prev.map(e => e._id === id ? { ...e, status: 'rejected' } : e));
            toast({ title: "Employee Rejected" });
        } catch { toast({ title: "Action Failed", variant: "destructive" }); }
    };

    const pageTitle = view === 'supervisor' ? 'Supervisors' : view === 'employee' ? 'Field & Office Staff' : user?.role === 'supervisor' ? 'My Team' : 'HRM — Staff Management';

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">{pageTitle}</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">{stats.total} total staff members registered</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
                >
                    <Plus className="h-3.5 w-3.5" /> {view === 'supervisor' ? 'Add Supervisor' : 'Add Employee'}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {view === 'supervisor' ? (
                    <>
                        <div className="rounded-xl border p-4 text-gray-700 bg-gray-50 border-gray-200">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Users className="h-3.5 w-3.5 opacity-70" />
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Total Supervisors</p>
                            </div>
                            <h3 className="text-2xl font-black">{stats.total}</h3>
                        </div>
                        <div className="rounded-xl border p-4 text-purple-700 bg-purple-50 border-purple-200">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Shield className="h-3.5 w-3.5 opacity-70" />
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Verified</p>
                            </div>
                            <h3 className="text-2xl font-black">{stats.verified}</h3>
                        </div>
                        <div className="rounded-xl border p-4 text-amber-700 bg-amber-50 border-amber-200">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Clock className="h-3.5 w-3.5 opacity-70" />
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">Pending Verification</p>
                            </div>
                            <h3 className="text-2xl font-black">{stats.pending}</h3>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="rounded-xl border p-4 text-gray-700 bg-gray-50 border-gray-200">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Users className="h-3.5 w-3.5 opacity-70" />
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Total Staff</p>
                            </div>
                            <h3 className="text-2xl font-black">{stats.total}</h3>
                        </div>
                        <div className="rounded-xl border p-4 text-orange-700 bg-orange-50 border-orange-200">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <MapPin className="h-3.5 w-3.5 opacity-70" />
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Field Staff</p>
                            </div>
                            <h3 className="text-2xl font-black">{stats.fieldStaff}</h3>
                        </div>
                        <div className="rounded-xl border p-4 text-blue-700 bg-blue-50 border-blue-200">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Users className="h-3.5 w-3.5 opacity-70" />
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Employees</p>
                            </div>
                            <h3 className="text-2xl font-black">{stats.employees}</h3>
                        </div>
                        <div className="rounded-xl border p-4 text-amber-700 bg-amber-50 border-amber-200">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Clock className="h-3.5 w-3.5 opacity-70" />
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Pending KYC</p>
                            </div>
                            <h3 className="text-2xl font-black">{stats.pending}</h3>
                        </div>
                    </>
                )}
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col xl:flex-row gap-3 justify-between items-stretch xl:items-center">
                <div className="flex flex-col lg:flex-row gap-3 flex-grow">
                    <div className="flex flex-wrap gap-1.5">
                        {view !== 'supervisor' && [
                            { key: "all", label: "All", count: stats.total },
                            { key: "field_staff", label: "Field Staff", count: stats.fieldStaff },
                            { key: "employee", label: "Employees", count: stats.employees },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setRoleFilter(f.key)}
                                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${roleFilter === f.key ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    }`}
                            >
                                {f.label}
                                <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-black ${roleFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>{f.count}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {uniqueCities.length > 0 && (
                            <select
                                value={cityFilter}
                                onChange={(e) => setCityFilter(e.target.value)}
                                className="rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-8 text-xs font-bold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                            >
                                <option value="all">All Cities</option>
                                {uniqueCities.map(city => (
                                    <option key={city} value={city}>{city}</option>
                                ))}
                            </select>
                        )}

                        {uniqueSupervisors.length > 0 && (
                            <select
                                value={supervisorFilter}
                                onChange={(e) => setSupervisorFilter(e.target.value)}
                                className="rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-8 text-xs font-bold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                            >
                                <option value="all">All Supervisors</option>
                                {uniqueSupervisors.map(sup => (
                                    <option key={sup} value={sup}>{sup}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="relative w-full xl:w-72 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
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
                                <th className="py-4 px-5">Staff Member</th>
                                <th className="py-4 px-5">Role</th>
                                <th className="py-4 px-5">Contact</th>
                                <th className="py-4 px-5 text-center">Hierarchy</th>
                                <th className="py-4 px-5 text-center">Referrals</th>
                                <th className="py-4 px-5 text-right">Commission</th>
                                <th className="py-4 px-5 text-center">Status</th>
                                <th className="py-4 px-5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="py-20 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                                        <p className="text-sm text-gray-400 mt-3 font-medium">Loading staff...</p>
                                    </td>
                                </tr>
                            ) : employees.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-20 text-center">
                                        <Users className="h-10 w-10 text-gray-200 mx-auto" />
                                        <p className="text-sm text-gray-400 mt-3 font-bold">No staff members found</p>
                                        <p className="text-xs text-gray-300 mt-1">Try adjusting your search or filter</p>
                                    </td>
                                </tr>
                            ) : (
                                <AnimatePresence>
                                    {employees.map((emp, idx) => {
                                        const rc = ROLE_CONFIG[emp.role] || ROLE_CONFIG.employee;
                                        const sc = STATUS_CONFIG[emp.status] || STATUS_CONFIG.pending;
                                        return (
                                            <motion.tr
                                                key={emp._id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className="hover:bg-gray-50/80 transition-colors group"
                                            >
                                                {/* Name */}
                                                <td className="py-3.5 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-black border ${rc.color}`}>
                                                            {(emp.name || "?").charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                                                            <p className="text-[10px] font-mono font-bold text-emerald-600 mt-0.5">{emp.ownCode || emp.employeeId || '-'}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Role */}
                                                <td className="py-3.5 px-5">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${rc.color}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${rc.dot}`}></span>
                                                        {rc.label}
                                                    </span>
                                                    {emp.role === 'supervisor' && (
                                                        <p className="text-[9px] font-bold text-gray-500 mt-1">
                                                            Scope: <span className={emp.allowedCreationScope === 'all' ? 'text-purple-600' : 'text-gray-600'}>
                                                                {emp.allowedCreationScope === 'all' ? 'Emp + Sup' : 'Emp Only'}
                                                            </span>
                                                        </p>
                                                    )}
                                                </td>

                                                {/* Contact */}
                                                <td className="py-3.5 px-5">
                                                    <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5"><Mail className="h-3 w-3 text-gray-400" />{emp.email || '-'}</p>
                                                    <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5 mt-0.5"><Phone className="h-3 w-3 text-gray-400" />{emp.mobile || '-'}</p>
                                                </td>

                                                {/* Hierarchy */}
                                                <td className="py-3.5 px-5 text-center">
                                                    {emp.managedBy ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">{emp.managedBy.ownCode || emp.supervisorCode}</span>
                                                            <span className="text-[9px] text-gray-450 mt-0.5 font-semibold">({emp.managedBy.name})</span>
                                                        </div>
                                                    ) : (emp.createdBy && emp.createdBy.role === 'supervisor') ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">{emp.supervisorCode || "Supervisor"}</span>
                                                            <span className="text-[9px] text-gray-450 mt-0.5 font-semibold">({emp.createdBy.name})</span>
                                                        </div>
                                                    ) : emp.supervisorCode ? (
                                                        <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">{emp.supervisorCode}</span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-300 font-bold uppercase">Direct</span>
                                                    )}
                                                </td>

                                                {/* Referrals */}
                                                <td className="py-3.5 px-5 text-center">
                                                    <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">{emp.referralCount || 0}</span>
                                                </td>

                                                {/* Commission */}
                                                <td className="py-3.5 px-5 text-right">
                                                    <span className="text-sm font-black text-gray-800">₹{emp.registrationCommission || 0}</span>
                                                </td>

                                                {/* Status */}
                                                <td className="py-3.5 px-5 text-center">
                                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${sc.cls}`}>
                                                        {sc.label}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 px-5 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {(user?.role === 'admin' || user?.role === 'superadmin') && emp.status === 'pending' && (
                                                            <>
                                                                <button onClick={() => handleVerify(emp._id)} title="Approve" className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button onClick={() => handleReject(emp._id)} title="Reject" className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                                                                    <XCircle className="h-3.5 w-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                        <button onClick={() => openEditModal(emp)} title="Edit" className="h-7 w-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                                                            <Edit3 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDelete(emp._id)} title="Delete" className="h-7 w-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Footer */}
                {employees.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Showing {employees.length} of {stats.total} {view === 'supervisor' ? 'supervisors' : 'staff'}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Commission: ₹{employees.reduce((s, e) => s + (e.registrationCommission || 0), 0).toLocaleString()}</p>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">{editId ? (view === 'supervisor' ? "Edit Supervisor Details" : "Edit Employee Details") : (view === 'supervisor' ? "Add Supervisor" : "Add Employee")}</h3>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">Admin → Supervisor → Field Staff</p>
                                </div>
                                <button onClick={() => { setShowAddModal(false); resetForm(); }} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Role" required>
                                        <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className={inputCls}>
                                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                                <>
                                                    <option value="supervisor">Supervisor</option>
                                                    <option value="employee">Employee</option>
                                                </>
                                            )}
                                            {user?.role === 'supervisor' && (
                                                <>
                                                    <option value="employee">Employee</option>
                                                    {user?.allowedCreationScope === "all" && (
                                                        <option value="supervisor">Supervisor</option>
                                                    )}
                                                </>
                                            )}
                                            {!user && (
                                                <>
                                                    <option value="supervisor">Supervisor</option>
                                                    <option value="employee">Employee</option>
                                                </>
                                            )}
                                        </select>
                                    </InputField>
                                    <InputField label="Full Name" required>
                                        <input required type="text" value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: sanitizeNameOnChange(e.target.value) })}
                                            maxLength={50} className={inputCls} placeholder="Rahul Verma" />
                                    </InputField>
                                </div>

                                {formData.role === 'supervisor' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField label="Allowed Creation Scope" required>
                                            <select value={formData.allowedCreationScope}
                                                onChange={(e) => setFormData({ ...formData, allowedCreationScope: e.target.value })}
                                                className={inputCls}>
                                                <option value="employee_only">Employee Only</option>
                                                <option value="all">Employee & Sewak</option>
                                            </select>
                                        </InputField>
                                        <div /> {/* Spacer */}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Mobile" required>
                                        <input required type="tel" value={formData.mobile}
                                            onChange={(e) => setFormData({ ...formData, mobile: sanitizePhone(e.target.value) })}
                                            maxLength="10"
                                            className={inputCls} placeholder="9876543210" />
                                    </InputField>
                                    <InputField label="Email" required>
                                        <input required type="email" value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: sanitizeEmail(e.target.value) })}
                                            className={inputCls} placeholder="email@rozsewa.com" />
                                    </InputField>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="State" required>
                                        <div className="relative">
                                            <input required type="text" value={formData.state}
                                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                                onFocus={() => setShowStateSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowStateSuggestions(false), 200)}
                                                className={inputCls} placeholder="State (e.g. Maharashtra)" />
                                            {showStateSuggestions && filteredStates.length > 0 && (
                                                <ul className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-sm">
                                                    {filteredStates.map(st => (
                                                        <li key={st}
                                                            onMouseDown={() => {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    state: st,
                                                                    city: INDIAN_STATES_AND_CITIES[st]?.[0] || prev.city
                                                                }));
                                                            }}
                                                            className="px-4 py-2 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer font-medium transition-colors text-left"
                                                        >
                                                            {st}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </InputField>
                                    <InputField label="City" required>
                                        <div className="relative">
                                            <input required type="text" value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                onFocus={() => setShowCitySuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                                                className={inputCls} placeholder="City (e.g. Mumbai)" />
                                            {showCitySuggestions && filteredCities.length > 0 && (
                                                <ul className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-sm">
                                                    {filteredCities.map(ct => (
                                                        <li key={ct}
                                                            onMouseDown={() => {
                                                                setFormData(prev => ({ ...prev, city: ct }));
                                                            }}
                                                            className="px-4 py-2 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer font-medium transition-colors text-left"
                                                        >
                                                            {ct}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </InputField>
                                </div>

                                <InputField label="Full Address" required>
                                    <input required type="text" value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className={inputCls} placeholder="Flat, Street, Area" />
                                </InputField>

                                {formData.role === 'field_staff' && user?.role !== 'supervisor' && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <InputField label="Supervisor Code (Required)">
                                            <input required type="text" value={formData.supervisorCode}
                                                onChange={(e) => setFormData({ ...formData, supervisorCode: e.target.value.toUpperCase() })}
                                                className={`${inputCls} border-purple-200 bg-purple-50/30 text-purple-700 font-bold`} placeholder="RSUP1001" />
                                        </InputField>
                                    </motion.div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="PAN Card No" required={!editId}>
                                        <div className="relative">
                                            <input type="text" value={formData.panCard}
                                                onChange={(e) => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); if (v.length <= 10) { setFormData({ ...formData, panCard: v }); setPanVerified(false); } }}
                                                className={`${inputCls} uppercase font-mono pr-20`} placeholder="ABCDE1234F" />
                                            {panVerified ? (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-[10px] font-bold">
                                                    <CheckCircle2 className="h-3 w-3" /> Verified
                                                </div>
                                            ) : (
                                                <button type="button" onClick={verifyPan} disabled={isVerifyingPan || formData.panCard?.length !== 10} className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                                                    {isVerifyingPan ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                                                </button>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" onChange={(e) => setPanPhotoFile(e.target.files[0])}
                                            className="mt-1.5 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200 w-full" />
                                        {formData.panCardPhoto && (
                                            <a href={formData.panCardPhoto} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline font-bold mt-1 block">
                                                View Current PAN Photo
                                            </a>
                                        )}
                                    </InputField>
                                    <InputField label="Aadhaar No" required={!editId}>
                                        <div className="relative">
                                            <input type="text" value={formData.aadharCard}
                                                onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); if (v.length <= 12) { setFormData({ ...formData, aadharCard: v }); setAadhaarVerified(false); setShowAadhaarOTP(false); } }}
                                                className={`${inputCls} font-mono pr-24`} placeholder="12-digit number" />
                                            {aadhaarVerified ? (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-[10px] font-bold">
                                                    <CheckCircle2 className="h-3 w-3" /> Verified
                                                </div>
                                            ) : (
                                                <button type="button" onClick={initiateAadhaar} disabled={isVerifyingAadhaar || formData.aadharCard?.length !== 12 || aadhaarCooldown > 0} className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                                                    {isVerifyingAadhaar && !showAadhaarOTP ? <Loader2 className="h-3 w-3 animate-spin" /> : (aadhaarCooldown > 0 ? `Retry in ${aadhaarCooldown}s` : (showAadhaarOTP ? "Resend" : "Send OTP"))}
                                                </button>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" onChange={(e) => setAadharPhotoFile(e.target.files[0])}
                                            className="mt-1.5 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200 w-full" />
                                        {formData.aadharCardPhoto && (
                                            <a href={formData.aadharCardPhoto} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline font-bold mt-1 block">
                                                View Current Aadhaar Photo
                                            </a>
                                        )}
                                    </InputField>
                                </div>
                                {showAadhaarOTP && !aadhaarVerified && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <InputField label="Enter Aadhaar OTP" required>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex justify-center py-2">
                                                    <InputOTP maxLength={6} value={aadhaarOTP} onChange={setAadhaarOTP}>
                                                        <InputOTPGroup className="gap-2">
                                                            {Array.from({ length: 6 }).map((_, i) => (
                                                                <InputOTPSlot
                                                                    key={i}
                                                                    index={i}
                                                                    className="h-12 w-10 rounded-xl border-2 border-gray-200 bg-gray-50 text-center text-xl font-black text-gray-900 first:rounded-xl first:border-2 last:rounded-xl focus-visible:border-emerald-500 focus-visible:ring-0 focus-visible:outline-none"
                                                                />
                                                            ))}
                                                        </InputOTPGroup>
                                                    </InputOTP>
                                                </div>
                                                <button type="button" onClick={verifyAadhaarOtpSubmit} disabled={isVerifyingAadhaar || aadhaarOTP.length !== 6} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                                    {isVerifyingAadhaar ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify OTP"}
                                                </button>
                                            </div>
                                        </InputField>
                                    </motion.div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label={editId ? "Password (Edit to Change)" : "Login Password"} required={!editId}>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input type={showPassword ? "text" : "password"} value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className={`${inputCls} pl-10 pr-10`} placeholder="Set password" />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-600 transition-colors">
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </InputField>
                                    <InputField label="Registration Commission (₹)" required>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input required type="number" min="0" value={formData.registrationCommission}
                                                onChange={(e) => { const v = parseFloat(e.target.value); if (e.target.value === "" || (!isNaN(v) && v >= 0)) setFormData({ ...formData, registrationCommission: e.target.value }); }}
                                                className={`${inputCls} pl-10`} />
                                        </div>
                                    </InputField>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={uploading} className="flex-1 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                        {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : (editId ? (view === 'supervisor' ? "Update Supervisor" : "Update Employee") : (view === 'supervisor' ? "Add Supervisor" : "Add Employee"))}
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
