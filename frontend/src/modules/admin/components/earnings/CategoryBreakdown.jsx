import React, { useState, useMemo } from "react";
import { ArrowUpDown, HelpCircle, FileClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const CategoryBreakdown = ({ data, isLoading, hasData }) => {
    const [sortField, setSortField] = useState("revenue");
    const [sortAsc, setSortAsc] = useState(false);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    const sortedData = useMemo(() => {
        if (!data) return [];
        return [...data].sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            // Case-insensitive sort for text fields
            if (typeof valA === "string") {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [data, sortField, sortAsc]);

    // Distinct background progress colors for categories
    const colors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];

    return (
        <TooltipProvider>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col h-[400px]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <div>
                        <h3 className="text-base font-black text-gray-900 tracking-tight">Revenue by Category</h3>
                        <p className="text-xs font-semibold text-gray-400 mt-0.5">Performance breakdown by service type.</p>
                    </div>
                </div>

                {/* Table container */}
                <div className="flex-1 overflow-y-auto mt-4 pr-1">
                    {isLoading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-4 w-28" />
                                        <Skeleton className="h-4 w-14" />
                                    </div>
                                    <Skeleton className="h-2 w-full rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : !hasData || !data || data.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center py-8">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3">
                                <FileClock className="h-6 w-6" />
                            </div>
                            <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">No Category Data</h4>
                            <p className="mt-1 max-w-[240px] text-[10px] font-semibold text-gray-400">
                                No category bookings were executed in this period.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto min-w-full">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        <th
                                            onClick={() => handleSort("category")}
                                            className="pb-3 cursor-pointer hover:text-gray-700 select-none transition-colors"
                                        >
                                            <span className="flex items-center gap-1">
                                                Category
                                                <ArrowUpDown className="h-3 w-3" />
                                            </span>
                                        </th>
                                        <th
                                            onClick={() => handleSort("bookings")}
                                            className="pb-3 text-right cursor-pointer hover:text-gray-700 select-none transition-colors"
                                        >
                                            <span className="flex items-center justify-end gap-1">
                                                Bookings
                                                <ArrowUpDown className="h-3 w-3" />
                                            </span>
                                        </th>
                                        <th
                                            onClick={() => handleSort("averageTicket")}
                                            className="pb-3 text-right cursor-pointer hover:text-gray-700 select-none transition-colors"
                                        >
                                            <span className="flex items-center justify-end gap-1">
                                                Avg Ticket
                                                <ArrowUpDown className="h-3 w-3" />
                                            </span>
                                        </th>
                                        <th
                                            onClick={() => handleSort("revenue")}
                                            className="pb-3 text-right cursor-pointer hover:text-gray-700 select-none transition-colors"
                                        >
                                            <span className="flex items-center justify-end gap-1">
                                                Revenue
                                                <ArrowUpDown className="h-3 w-3" />
                                            </span>
                                        </th>
                                        <th
                                            onClick={() => handleSort("commission")}
                                            className="pb-3 text-right cursor-pointer hover:text-gray-700 select-none transition-colors"
                                        >
                                            <span className="flex items-center justify-end gap-1">
                                                Commission
                                                <ArrowUpDown className="h-3 w-3" />
                                            </span>
                                        </th>
                                        <th className="pb-3 text-right">Share</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {sortedData.map((item, idx) => {
                                        const colorClass = colors[idx % colors.length];
                                        return (
                                            <tr key={item.category} className="group hover:bg-gray-50/50 transition-colors">
                                                <td className="py-3 font-bold text-gray-800 uppercase tracking-wide">
                                                    {item.category}
                                                </td>
                                                <td className="py-3 text-right font-semibold text-gray-500">
                                                    {item.bookings}
                                                </td>
                                                <td className="py-3 text-right font-semibold text-gray-500">
                                                    ₹{Math.round(item.averageTicket).toLocaleString()}
                                                </td>
                                                <td className="py-3 text-right font-black text-gray-900">
                                                    ₹{Math.round(item.revenue).toLocaleString()}
                                                </td>
                                                <td className="py-3 text-right font-bold text-emerald-600">
                                                    ₹{Math.round(item.commission).toLocaleString()}
                                                </td>
                                                <td className="py-3 pl-4 text-right">
                                                    <div className="flex items-center justify-end gap-2.5">
                                                        <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden flex-shrink-0">
                                                            <div
                                                                className={`h-full rounded-full ${colorClass}`}
                                                                style={{ width: `${item.percent}%` }}
                                                            />
                                                        </div>
                                                        <span className="font-bold text-gray-700 min-w-[28px]">
                                                            {item.percent}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
};

export default CategoryBreakdown;
