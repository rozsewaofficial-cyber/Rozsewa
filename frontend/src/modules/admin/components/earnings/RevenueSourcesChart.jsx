import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Landmark, FileClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
    "#2563eb", // Service: Blue
    "#10b981", // Visit: Emerald
    "#7c3aed", // Night: Purple
    "#d97706", // Holiday: Amber
    "#e11d48", // Urgent: Rose
    "#0891b2", // Travel: Cyan
    "#6b7280"  // Other: Gray
];

const RevenueSourcesChart = ({ data, isLoading, hasData }) => {
    // Filter out 0 amount items for donut chart visualization
    const chartData = (data || []).filter(item => item.amount > 0);

    const totalAmount = (data || []).reduce((sum, item) => sum + item.amount, 0);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-lg">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        {payload[0].name}
                    </p>
                    <p className="mt-1 text-xs font-black text-gray-900">
                        ₹{payload[0].value.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[9px] font-bold text-blue-600 mt-0.5">
                        {payload[0].payload.percentage}% Share
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col h-[380px]">
            {/* Title */}
            <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                <div>
                    <h3 className="text-base font-black text-gray-900 tracking-tight">Revenue Sources</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">Distribution of platform fee aggregates.</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Landmark className="h-4 w-4" />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-6 mt-6 overflow-hidden">
                {isLoading ? (
                    <div className="flex h-full w-full items-center justify-center gap-6">
                        <Skeleton className="h-40 w-40 rounded-full" />
                        <div className="flex flex-col gap-2 flex-1">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>
                    </div>
                ) : !hasData || !data || data.length === 0 || totalAmount === 0 ? (
                    <div className="flex h-full w-full flex-col items-center justify-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3">
                            <FileClock className="h-6 w-6" />
                        </div>
                        <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">No Revenue Breakdown</h4>
                        <p className="mt-1 max-w-[240px] text-[10px] font-semibold text-gray-400 leading-normal">
                            No billing distributions found for this period.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Donut Canvas */}
                        <div className="relative h-44 w-44 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={75}
                                        paddingAngle={3}
                                        dataKey="amount"
                                    >
                                        {chartData.map((entry, index) => {
                                            // Keep colors consistent with index in overall list
                                            const origIdx = data.findIndex(item => item.name === entry.name);
                                            return <Cell key={`cell-${index}`} fill={COLORS[origIdx % COLORS.length]} />;
                                        })}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                                    Total GMV
                                </span>
                                <span className="text-sm font-black text-gray-900 mt-1.5 tracking-tight">
                                    ₹{Math.round(totalAmount).toLocaleString("en-IN")}
                                </span>
                            </div>
                        </div>

                        {/* Legend List */}
                        <div className="flex-1 overflow-y-auto max-h-[260px] pr-2 w-full">
                            <div className="grid grid-cols-1 gap-2.5">
                                {data.map((item, idx) => (
                                    <div
                                        key={item.name}
                                        className="flex items-center justify-between border-b border-gray-50 pb-1.5 group hover:bg-gray-50/50 p-1 rounded-lg transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                            />
                                            <span className="text-xs font-bold text-gray-600 truncate max-w-[120px]">
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black text-gray-800">
                                                ₹{Math.round(item.amount).toLocaleString("en-IN")}
                                            </span>
                                            <span className="text-[9px] font-bold text-gray-400 block mt-0.5">
                                                {item.percentage}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default RevenueSourcesChart;
