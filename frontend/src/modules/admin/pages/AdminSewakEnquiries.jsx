import { useState, useEffect, useMemo } from "react";
import { Search, Loader2, ArrowLeft, Filter, Phone, Mail, Clock, CheckCircle, AlertCircle, Users, PhoneCall, CheckCircle2 } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const AdminSewakEnquiries = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [enquiries, setEnquiries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    useEffect(() => {
        setTitle("Sewak Enquiries");
        fetchEnquiries();
    }, [setTitle]);

    const fetchEnquiries = async () => {
        setIsLoading(true);
        try {
            const { data } = await API.get("/admin/sewak-enquiries");
            setEnquiries(data);
        } catch (error) {
            toast({
                title: "Error fetching enquiries",
                description: error.response?.data?.message || "Something went wrong",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            const { data } = await API.put(`/admin/sewak-enquiries/${id}/status`, { status: newStatus });
            if (data.success) {
                toast({ title: "Status Updated", description: "Enquiry status updated successfully" });
                setEnquiries(enquiries.map(enq => enq._id === id ? data.data : enq));
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update status",
                variant: "destructive"
            });
        }
    };

    const filteredEnquiries = enquiries.filter(enq => {
        const matchesSearch = enq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            enq.phone.includes(searchTerm) ||
            enq.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || enq.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const stats = useMemo(() => {
        return {
            total: enquiries.length,
            pending: enquiries.filter(e => e.status === 'pending').length,
            contacted: enquiries.filter(e => e.status === 'contacted').length,
            resolved: enquiries.filter(e => e.status === 'resolved').length
        };
    }, [enquiries]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest border border-amber-100"><AlertCircle className="w-3 h-3" /> Pending</span>;
            case 'contacted': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-widest border border-blue-100"><PhoneCall className="w-3 h-3" /> Contacted</span>;
            case 'resolved': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> Resolved</span>;
            default: return null;
        }
    };

    if (isLoading && enquiries.length === 0) return (
        <div className="flex h-96 flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Enquiries...</p>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                <div className="flex items-center gap-4">
                    <Link to="/admin" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Sewak Enquiries</h2>
                        <p className="mt-1 text-sm text-gray-500 font-medium">Manage candidate applications for Sewak</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Applications", value: stats.total, icon: Users, cls: "text-gray-700 bg-gray-50 border-gray-200" },
                    { label: "Pending", value: stats.pending, icon: AlertCircle, cls: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Contacted", value: stats.contacted, icon: PhoneCall, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Resolved", value: stats.resolved, icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
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

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, phone or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm font-bold placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm outline-none"
                    />
                </div>
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm overflow-x-auto">
                    {['all', 'pending', 'contacted', 'resolved'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === status ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Candidate Info</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Contact Details</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Date Submitted</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredEnquiries.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-gray-100 shadow-sm">
                                            <Search className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-900">No enquiries found</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Try adjusting your filters</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredEnquiries.map((enq) => (
                                    <tr key={enq._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 font-black text-lg uppercase tracking-tighter shadow-sm">
                                                    {enq.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-extrabold text-gray-900 tracking-tight">{enq.name}</p>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">ID: {enq._id.slice(-6)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                                    <Phone className="w-3 h-3 text-gray-400" />
                                                    <a href={`tel:${enq.phone}`} className="hover:text-blue-600 hover:underline">{enq.phone}</a>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                                    <Mail className="w-3 h-3 text-gray-400" />
                                                    <a href={`mailto:${enq.email}`} className="hover:text-blue-600 hover:underline">{enq.email}</a>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                                <Clock className="w-3 h-3 text-gray-400" />
                                                {format(new Date(enq.createdAt), "dd MMM yyyy, p")}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(enq.status)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <select
                                                value={enq.status}
                                                onChange={(e) => handleStatusChange(enq._id, e.target.value)}
                                                className="text-[10px] font-black uppercase tracking-widest bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 outline-none hover:bg-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-all"
                                            >
                                                <option value="pending">Mark Pending</option>
                                                <option value="contacted">Mark Contacted</option>
                                                <option value="resolved">Mark Resolved</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminSewakEnquiries;
