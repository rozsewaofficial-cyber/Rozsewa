import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, FileClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const RevenueTrendChart = ({ data, isLoading, hasData }) => {
    const formatYAxis = (tickItem) => {
        if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
        if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(0)}k`;
        return `₹${tickItem}`;
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-lg">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        {payload[0].payload.date}
                    </p>
                    <p className="mt-1 text-sm font-black text-blue-600">
                        ₹{payload[0].value.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                        Gross Sales (GMV)
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col h-[380px]">
            {/* Chart Title */}
            <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                <div>
                    <h3 className="text-base font-black text-gray-900 tracking-tight">Revenue Trend</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">Gross sales volume trajectory over time.</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <TrendingUp className="h-4 w-4" />
                </div>
            </div>

            {/* Chart Canvas */}
            <div className="flex-1 mt-6">
                {isLoading ? (
                    <div className="flex h-full flex-col justify-end gap-3 pb-2">
                        <Skeleton className="h-[60%] w-full" />
                        <div className="flex justify-between">
                            <Skeleton className="h-3 w-10" />
                            <Skeleton className="h-3 w-10" />
                            <Skeleton className="h-3 w-10" />
                            <Skeleton className="h-3 w-10" />
                        </div>
                    </div>
                ) : !hasData || !data || data.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3">
                            <FileClock className="h-6 w-6" />
                        </div>
                        <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">No Revenue Trend Data</h4>
                        <p className="mt-1 max-w-[240px] text-[10px] font-semibold text-gray-400 leading-normal">
                            Not enough historical booking records available in this range.
                        </p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 700, fill: "#9ca3af" }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={formatYAxis}
                                tick={{ fontSize: 10, fontWeight: 700, fill: "#9ca3af" }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }} />
                            <Line
                                type="monotone"
                                dataKey="revenue"
                                stroke="#2563eb"
                                strokeWidth={2.5}
                                dot={{ stroke: "#2563eb", strokeWidth: 2, r: 3, fill: "#fff" }}
                                activeDot={{ stroke: "#2563eb", strokeWidth: 2, r: 5, fill: "#2563eb" }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default RevenueTrendChart;
