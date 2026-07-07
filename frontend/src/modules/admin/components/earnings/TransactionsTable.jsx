import React, { useState, useMemo } from "react";
import {
    ArrowUpDown,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    ChevronLeft,
    ChevronRight,
    ReceiptText,
    ExternalLink,
    Eye,
    X,
    FileSpreadsheet,
    FileClock
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const TransactionsTable = ({
    transactions = [],
    isLoading = false,
    onOpenFilters,
    activeFiltersCount = 0,
    globalSearch = "",
    setGlobalSearch
}) => {
    const [sortField, setSortField] = useState("rawDate");
    const [sortAsc, setSortAsc] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedTxn, setSelectedTxn] = useState(null);

    // Sort Handler
    const handleSort = (field) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
        setCurrentPage(1);
    };

    // Filter and search logic
    const filteredTransactions = useMemo(() => {
        return transactions.filter((txn) => {
            const matchesSearch =
                (txn.id || "").toLowerCase().includes(globalSearch.toLowerCase()) ||
                (txn.bookingId || "").toLowerCase().includes(globalSearch.toLowerCase()) ||
                (txn.partner?.name || "").toLowerCase().includes(globalSearch.toLowerCase()) ||
                (txn.customer?.name || "").toLowerCase().includes(globalSearch.toLowerCase()) ||
                (txn.category || "").toLowerCase().includes(globalSearch.toLowerCase());
            return matchesSearch;
        });
    }, [transactions, globalSearch]);

    // Sorting logic
    const sortedTransactions = useMemo(() => {
        return [...filteredTransactions].sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (sortField === "customer") valA = a.customer?.name || "";
            if (sortField === "customer") valB = b.customer?.name || "";
            if (sortField === "partner") valA = a.partner?.name || "";
            if (sortField === "partner") valB = b.partner?.name || "";

            if (typeof valA === "string") {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [filteredTransactions, sortField, sortAsc]);

    // Pagination
    const totalPages = Math.ceil(sortedTransactions.length / pageSize) || 1;
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedTransactions.slice(start, start + pageSize);
    }, [sortedTransactions, currentPage, pageSize]);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Export current filtered records to CSV
    const handleExportCSV = () => {
        const headers = [
            "Transaction ID",
            "Booking ID",
            "Customer Name",
            "Partner Name",
            "Category",
            "Payment Method",
            "Transaction Type",
            "Amount",
            "Status",
            "Date"
        ];
        const rows = sortedTransactions.map((t) => [
            t.id,
            t.bookingId,
            t.customer?.name || "N/A",
            t.partner?.name || "N/A",
            t.category,
            t.paymentMethod,
            t.transactionType,
            t.amount,
            t.status,
            t.date
        ]);

        const csvContent =
            "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell || ""}"`).join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `rozsewa_ledger_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getInitials = (name) => {
        return (name || "")
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
            {/* Table Action Bar */}
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-gray-50/20">
                <div>
                    <h3 className="text-base font-black text-gray-900 tracking-tight">Ledger & Transaction Logs</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">Auditable records of all financial events.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search Field */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter table..."
                            value={globalSearch}
                            onChange={(e) => {
                                setGlobalSearch?.(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full sm:w-60 rounded-xl border border-gray-200 bg-white py-1.5 pl-9 pr-4 text-xs font-semibold text-gray-700 placeholder-gray-400 shadow-xs focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Advanced Filters Button */}
                    <button
                        onClick={onOpenFilters}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all ${
                            activeFiltersCount > 0
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        } shadow-xs`}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        Filters
                        {activeFiltersCount > 0 && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[8px] font-black text-white">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>

                    {/* Export CSV Button */}
                    <button
                        onClick={handleExportCSV}
                        disabled={sortedTransactions.length === 0}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-600 hover:bg-gray-50 shadow-xs active:scale-95 disabled:opacity-50"
                        title="Export current rows to CSV"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <tr>
                            <th className="px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("id")}>
                                <span className="flex items-center gap-1">Txn ID <ArrowUpDown className="h-3 w-3" /></span>
                            </th>
                            <th className="px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("bookingId")}>
                                <span className="flex items-center gap-1">Booking ID <ArrowUpDown className="h-3 w-3" /></span>
                            </th>
                            <th className="px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("customer")}>
                                <span className="flex items-center gap-1">Customer <ArrowUpDown className="h-3 w-3" /></span>
                            </th>
                            <th className="px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("partner")}>
                                <span className="flex items-center gap-1">Partner <ArrowUpDown className="h-3 w-3" /></span>
                            </th>
                            <th className="px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("category")}>
                                <span className="flex items-center gap-1">Category <ArrowUpDown className="h-3 w-3" /></span>
                            </th>
                            <th className="px-6 py-4">Payment Method</th>
                            <th className="px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("transactionType")}>
                                <span className="flex items-center gap-1">Type <ArrowUpDown className="h-3 w-3" /></span>
                            </th>
                            <th className="px-6 py-4 text-right cursor-pointer select-none" onClick={() => handleSort("amount")}>
                                <span className="flex items-center justify-end gap-1">Amount <ArrowUpDown className="h-3 w-3" /></span>
                            </th>
                            <th className="px-6 py-4 text-center cursor-pointer select-none" onClick={() => handleSort("status")}>
                                <span className="flex items-center justify-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></span>
                            </th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                                <tr key={idx}>
                                    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-4 w-14" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-4 w-14" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                                    <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-16" /></td>
                                    <td className="px-6 py-4 text-center"><Skeleton className="h-5 w-16 rounded-full" /></td>
                                    <td className="px-6 py-4 text-center"><Skeleton className="h-6 w-6 rounded-md mx-auto" /></td>
                                </tr>
                            ))
                        ) : paginatedTransactions.length === 0 ? (
                            <tr>
                                <td colSpan="10" className="px-6 py-16 text-center">
                                    <FileClock className="h-10 w-10 text-gray-200 mx-auto" />
                                    <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider mt-3">No Transactions Found</h4>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Try adjusting your search criteria or date filter boundaries.
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            paginatedTransactions.map((t) => {
                                // Color badges mapping for types
                                const typeBadges = {
                                    "Commission": "bg-blue-50 text-blue-700 border-blue-100",
                                    "Partner Payout": "bg-purple-50 text-purple-700 border-purple-100",
                                    "Travel Charge": "bg-cyan-50 text-cyan-700 border-cyan-100",
                                    "Refund": "bg-rose-50 text-rose-700 border-rose-100",
                                    "Wallet": "bg-amber-50 text-amber-700 border-amber-100",
                                    "Adjustment": "bg-gray-100 text-gray-700 border-gray-200"
                                };
                                const typeClass = typeBadges[t.transactionType] || "bg-gray-50 text-gray-600";

                                // Status styles
                                const statusClasses = {
                                    "success": "bg-emerald-50 text-emerald-700 border-emerald-100",
                                    "pending": "bg-amber-50 text-amber-700 border-amber-100",
                                    "processing": "bg-blue-50 text-blue-700 border-blue-100",
                                    "failed": "bg-rose-50 text-rose-700 border-rose-100"
                                };
                                const statusClass = statusClasses[t.status] || "bg-gray-50 text-gray-600 border-gray-100";

                                return (
                                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                                        {/* Txn ID */}
                                        <td className="px-6 py-3.5">
                                            <span className="font-mono font-black text-gray-900 text-xs">{t.id}</span>
                                            <span className="text-[9px] font-bold text-gray-400 block mt-0.5">{t.date}</span>
                                        </td>

                                        {/* Booking ID */}
                                        <td className="px-6 py-3.5">
                                            <span className="font-mono font-bold text-gray-500">{t.bookingId}</span>
                                        </td>

                                        {/* Customer */}
                                        <td className="px-6 py-3.5">
                                            {t.customer?.name === "N/A" ? (
                                                <span className="text-xs font-bold text-gray-400">N/A</span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={t.customer?.avatar} alt={t.customer?.name} />
                                                        <AvatarFallback className="bg-gray-100 text-[8px] font-black text-gray-500">
                                                            {getInitials(t.customer?.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-bold text-gray-700 truncate max-w-[100px]" title={t.customer?.name}>
                                                        {t.customer?.name}
                                                    </span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Partner */}
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={t.partner?.avatar} alt={t.partner?.name} />
                                                    <AvatarFallback className="bg-blue-100 text-[8px] font-black text-blue-700">
                                                        {getInitials(t.partner?.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="font-bold text-gray-700 truncate max-w-[120px]" title={t.partner?.name}>
                                                    {t.partner?.name}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Category */}
                                        <td className="px-6 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                                            {t.category}
                                        </td>

                                        {/* Method */}
                                        <td className="px-6 py-3.5 font-semibold text-gray-600">
                                            {t.paymentMethod}
                                        </td>

                                        {/* Transaction Type */}
                                        <td className="px-6 py-3.5">
                                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${typeClass}`}>
                                                {t.transactionType}
                                            </span>
                                        </td>

                                        {/* Amount */}
                                        <td className="px-6 py-3.5 text-right font-black text-sm">
                                            <div className={`flex items-center justify-end gap-0.5 ${t.transactionType === 'Refund' || t.status === 'failed' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {t.transactionType === 'Refund' || t.status === 'failed' ? (
                                                    <ArrowDownRight className="h-3.5 w-3.5" />
                                                ) : (
                                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                                )}
                                                ₹{t.amount.toLocaleString()}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-3.5 text-center">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusClass}`}>
                                                {t.status}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-3.5 text-center">
                                            <button
                                                onClick={() => setSelectedTxn(t)}
                                                className="h-7 w-7 inline-flex items-center justify-center border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg shadow-xs transition-colors"
                                                title="View transaction details"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {sortedTransactions.length > 0 && (
                <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/20 text-xs">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-500 font-semibold">
                            <span>Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-blue-500 font-black text-gray-700 shadow-sm"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <span className="font-bold text-gray-400">
                            Showing {Math.min(sortedTransactions.length, (currentPage - 1) * pageSize + 1)} to{" "}
                            {Math.min(sortedTransactions.length, currentPage * pageSize)} of {sortedTransactions.length} entries
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1 || isLoading}
                            className="h-8 px-2.5 inline-flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-xs"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => {
                            const pageNum = i + 1;
                            // Show limited page numbers to avoid overflow
                            if (totalPages > 5 && Math.abs(currentPage - pageNum) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                                if (pageNum === 2 || pageNum === totalPages - 1) {
                                    return <span key={pageNum} className="text-gray-300 px-1 font-bold">...</span>;
                                }
                                return null;
                            }

                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => handlePageChange(pageNum)}
                                    className={`h-8 w-8 inline-flex items-center justify-center rounded-lg text-xs font-black transition-colors ${
                                        currentPage === pageNum
                                            ? "bg-blue-600 text-white shadow-xs"
                                            : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages || isLoading}
                            className="h-8 px-2.5 inline-flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-xs"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Details Modal Popup */}
            {selectedTxn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40" onClick={() => setSelectedTxn(null)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100 animate-in zoom-in-95">
                        <button
                            onClick={() => setSelectedTxn(null)}
                            className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-150 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                            <ReceiptText className="h-5 w-5 text-blue-600" />
                            <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                                Transaction Audit Card
                            </h4>
                        </div>
                        <div className="mt-4 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-y-3.5 border-b border-gray-50 pb-3">
                                <div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Transaction ID</span>
                                    <span className="font-mono font-black text-gray-800 text-xs">{selectedTxn.id}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Booking ID</span>
                                    <span className="font-mono font-black text-gray-800 text-xs">{selectedTxn.bookingId}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Timestamp</span>
                                    <span className="font-bold text-gray-700">{selectedTxn.date}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Transaction Type</span>
                                    <span className="font-black text-blue-600 uppercase tracking-wider text-[10px]">
                                        {selectedTxn.transactionType}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2 pb-3 border-b border-gray-50">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Parties Involved</span>
                                <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                    <div>
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Customer</span>
                                        <span className="font-bold text-gray-700">{selectedTxn.customer?.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Service Partner</span>
                                        <span className="font-bold text-gray-700">{selectedTxn.partner?.name}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-3.5">
                                <div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Category</span>
                                    <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">{selectedTxn.category}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Method</span>
                                    <span className="font-bold text-gray-700">{selectedTxn.paymentMethod}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Clearing Status</span>
                                    <span className="inline-block px-2 py-0.5 rounded-full font-black text-[9px] uppercase border bg-blue-50 text-blue-700 border-blue-100">
                                        {selectedTxn.status}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Transfer Value</span>
                                    <span className="font-black text-sm text-emerald-600">₹{selectedTxn.amount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionsTable;
