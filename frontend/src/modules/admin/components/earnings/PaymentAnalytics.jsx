import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Wallet, FileClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const PAYMENT_COLORS = {
    "UPI": "#2563eb",         // Blue
    "Cash": "#10b981",        // Emerald
    "Wallet": "#7c3aed",      // Purple
    "Card": "#d97706",        // Amber
    "Net Banking": "#6366f1"  // Indigo
};

const PaymentAnalytics = ({ data, isLoading, hasData }) => {
    const totalPayments = (data || []).reduce((sum, item) => sum + item.value, 0);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const pct = totalPayments > 0 ? Math.round((payload[0].value / totalPayments) * 1000) / 10 : 0;
            return (
                <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-lg">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        {payload[0].name}
                    </p>
                    <p className="mt-1 text-sm font-black text-gray-900">
                        ₹{payload[0].value.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[9px] font-bold text-blue-600 mt-0.5">
                        {pct}% Share ({payload[0].payload.count} transactions)
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
                    <h3 className="text-base font-black text-gray-900 tracking-tight">Payment Analytics</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">Volume distribution across customer payment methods.</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Wallet className="h-4.5 w-4.5" />
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
                        </div>
                    </div>
                ) : !hasData || !data || data.length === 0 || totalPayments === 0 ? (
                    <div className="flex h-full w-full flex-col items-center justify-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3">
                            <FileClock className="h-6 w-6" />
                        </div>
                        <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">No Payment Data</h4>
                        <p className="mt-1 max-w-[240px] text-[10px] font-semibold text-gray-400">
                            No billing transactions recorded in this range.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Donut Chart */}
                        <div className="relative h-44 w-44 flex-shrink-0 mx-auto">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={75}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {data.map((entry, index) => {
                                            const strokeColor = PAYMENT_COLORS[entry.name] || "#6b7280";
                                            return <Cell key={`cell-${index}`} fill={strokeColor} />;
                                        })}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                                    Total Paid
                                </span>
                                <span className="text-sm font-black text-gray-900 mt-1.5 tracking-tight">
                                    ₹{Math.round(totalPayments).toLocaleString("en-IN")}
                                </span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex-1 overflow-y-auto max-h-[260px] pr-2 w-full">
                            <div className="grid grid-cols-1 gap-2.5">
                                {data.map((item) => {
                                    const itemColor = PAYMENT_COLORS[item.name] || "#6b7280";
                                    const sharePct = totalPayments > 0 ? Math.round((item.value / totalPayments) * 1000) / 10 : 0;
                                    return (
                                        <div
                                            key={item.name}
                                            className="flex items-center justify-between border-b border-gray-50 pb-1.5 p-1 rounded-lg hover:bg-gray-50/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: itemColor }}
                                                />
                                                <span className="text-xs font-bold text-gray-600">
                                                    {item.name}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black text-gray-800">
                                                    ₹{Math.round(item.value).toLocaleString("en-IN")}
                                                </span>
                                                <span className="text-[9px] font-bold text-gray-400 block mt-0.5">
                                                    {sharePct}% ({item.count})
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PaymentAnalytics;
