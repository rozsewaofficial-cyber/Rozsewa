import React from "react";
import { Download, Calendar, Search, RefreshCw } from "lucide-react";

const Header = ({
    range,
    setRange,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    globalSearch,
    setGlobalSearch,
    onExport,
    onRefresh,
    isExporting,
    isLoading
}) => {
    return (
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            {/* Title Block */}
            <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Revenue & Earnings</h1>
                <p className="mt-1 text-sm font-medium text-gray-500">
                    Oversight of platform commissions, settlement schedules, travel charges, and partner payouts.
                </p>
            </div>

            {/* Actions Block */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative min-w-[200px] sm:min-w-[240px]">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-xs font-semibold text-gray-800 placeholder-gray-400 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                    />
                </div>

                {/* Date Picker Selector */}
                <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                    {[
                        { label: "Today", value: "today" },
                        { label: "7D", value: "7d" },
                        { label: "30D", value: "30d" },
                        { label: "12M", value: "year" }
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setRange(opt.value)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                                range === opt.value
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-gray-600 hover:bg-gray-50"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setRange("custom")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                            range === "custom"
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                        <Calendar className="h-3.5 w-3.5" />
                        Custom
                    </button>
                </div>

                {/* Custom Date Picker Fields */}
                {range === "custom" && (
                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1 shadow-sm">
                        <input
                            type="date"
                            value={startDate}
                            max={new Date().toLocaleDateString("en-CA")}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-gray-400">to</span>
                        <input
                            type="date"
                            value={endDate}
                            min={startDate || undefined}
                            max={new Date().toLocaleDateString("en-CA")}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none"
                        />
                    </div>
                )}

                {/* Refresh Trigger */}
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-all hover:bg-gray-50 active:scale-95 disabled:opacity-50"
                    title="Refresh data"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
                </button>

                {/* Export Button */}
                <button
                    onClick={onExport}
                    disabled={isExporting}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                >
                    <Download className={`h-4 w-4 ${isExporting ? "animate-bounce" : ""}`} />
                    {isExporting ? "Exporting..." : "Export Report"}
                </button>
            </div>
        </div>
    );
};

export default Header;
