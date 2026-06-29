import React from "react";
import { X, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const FiltersDrawer = ({
    isOpen,
    onClose,
    filters,
    setFilters,
    categories = [],
    partners = [],
    cities = [],
    onReset
}) => {
    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value
        }));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black"
                    />

                    {/* Drawer Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-sm bg-white p-6 shadow-xl border-l border-gray-100 flex flex-col h-screen"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div>
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Advanced Filters</h3>
                                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Narrow down financial transaction records.</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Filter Fields */}
                        <div className="flex-1 overflow-y-auto py-6 space-y-5">
                            {/* Category Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                                    Service Category
                                </label>
                                <select
                                    value={filters.category || ""}
                                    onChange={(e) => handleFilterChange("category", e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Partner Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                                    Service Partner
                                </label>
                                <select
                                    value={filters.partnerId || ""}
                                    onChange={(e) => handleFilterChange("partnerId", e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">All Partners</option>
                                    {partners.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* City Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                                    City
                                </label>
                                <select
                                    value={filters.city || ""}
                                    onChange={(e) => handleFilterChange("city", e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">All Cities</option>
                                    {cities.map((city) => (
                                        <option key={city} value={city}>
                                            {city}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Payment Method Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                                    Payment Method
                                </label>
                                <select
                                    value={filters.paymentMethod || ""}
                                    onChange={(e) => handleFilterChange("paymentMethod", e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">All Payment Modes</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Wallet">Wallet</option>
                                    <option value="Card">Card</option>
                                    <option value="Net Banking">Net Banking</option>
                                </select>
                            </div>

                            {/* Booking Status Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                                    Booking Status
                                </label>
                                <select
                                    value={filters.bookingStatus || ""}
                                    onChange={(e) => handleFilterChange("bookingStatus", e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            {/* Transaction Type Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                                    Transaction Type
                                </label>
                                <select
                                    value={filters.transactionType || ""}
                                    onChange={(e) => handleFilterChange("transactionType", e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">All Types</option>
                                    <option value="Commission">Commission</option>
                                    <option value="Partner Payout">Partner Payout</option>
                                    <option value="Travel Charge">Travel Charge</option>
                                    <option value="Refund">Refund</option>
                                </select>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-gray-100 pt-4 flex gap-3">
                            <button
                                onClick={onReset}
                                className="flex items-center gap-1.5 justify-center flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-bold text-gray-500 shadow-sm transition-all hover:bg-gray-50"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default FiltersDrawer;
