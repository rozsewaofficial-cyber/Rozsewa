import React from "react";
import { TrendingUp, IndianRupee, CreditCard, Users, Truck, Undo2, ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const KpiCards = ({ data, isLoading }) => {
    const formatValue = (val) => {
        return `₹${Math.round(val).toLocaleString("en-IN")}`;
    };

    const cards = [
        {
            key: "grossSales",
            label: "Gross Sales (GMV)",
            icon: TrendingUp,
            color: "text-blue-600 bg-blue-50 border-blue-100",
            stroke: "#2563eb",
            tooltip: "Total booking transaction volume processed on the platform before payouts and fees."
        },
        {
            key: "companyRevenue",
            label: "Company Revenue",
            icon: IndianRupee,
            color: "text-emerald-600 bg-emerald-50 border-emerald-100",
            stroke: "#059669",
            tooltip: "Total platform commission earnings generated from completed bookings."
        },
        {
            key: "partnerPayout",
            label: "Partner Payouts",
            icon: Users,
            color: "text-purple-600 bg-purple-50 border-purple-100",
            stroke: "#7c3aed",
            tooltip: "Total earnings distributed to service partners (completed bookings volume minus commissions)."
        },
        {
            key: "pendingSettlement",
            label: "Pending Settlements",
            icon: CreditCard,
            color: "text-amber-600 bg-amber-50 border-amber-100",
            stroke: "#d97706",
            tooltip: "Dues accumulated in partner wallets awaiting withdrawal reconciliation."
        },
        {
            key: "travelCharges",
            label: "Travel Charges",
            icon: Truck,
            color: "text-cyan-600 bg-cyan-50 border-cyan-100",
            stroke: "#0891b2",
            tooltip: "Total distance fees collected from customers, which are 100% paid out to partners."
        },
        {
            key: "refunds",
            label: "Refunds / Adjustments",
            icon: Undo2,
            color: "text-rose-600 bg-rose-50 border-rose-100",
            stroke: "#e11d48",
            tooltip: "Total amounts returned to customers due to booking cancellations or pricing modifications."
        }
    ];

    if (isLoading) {
        return (
            <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 xl:grid-cols-6 scrollbar-none">
                {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                        key={idx}
                        className="min-w-[240px] flex-shrink-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:min-w-0"
                    >
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-8 rounded-xl" />
                        </div>
                        <Skeleton className="mt-4 h-8 w-32" />
                        <Skeleton className="mt-3 h-8 w-full" />
                        <Skeleton className="mt-2 h-3 w-28" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 md:grid md:grid-cols-3 xl:grid-cols-6 scrollbar-none">
                {cards.map((card) => {
                    const stats = data?.[card.key] || { value: 0, prevValue: 0, percentageChange: 0, sparkline: [] };
                    const isPositive = stats.percentageChange >= 0;
                    const changeVal = Math.abs(stats.percentageChange);
                    const sparklineData = (stats.sparkline || []).map((val, idx) => ({ value: val, index: idx }));

                    return (
                        <div
                            key={card.key}
                            className="min-w-[260px] flex-shrink-0 snap-align-start snap-always rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md md:min-w-0"
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    {card.label}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button className="text-gray-300 hover:text-gray-500 transition-colors">
                                                <Info className="h-3.5 w-3.5" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[200px] text-xs leading-relaxed">
                                            {card.tooltip}
                                        </TooltipContent>
                                    </Tooltip>
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${card.color}`}>
                                        <card.icon className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>

                            {/* Large Value */}
                            <div className="mt-3">
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                                    {formatValue(stats.value)}
                                </h3>
                            </div>

                            {/* Sparkline Chart */}
                            <div className="mt-4 h-8 w-full">
                                {sparklineData.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={sparklineData}>
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke={card.stroke}
                                                strokeWidth={1.5}
                                                dot={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center border-t border-dashed border-gray-100 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                                        No Trend Data
                                    </div>
                                )}
                            </div>

                            {/* Trend Indicator & Previous Period Comparison */}
                            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                                {stats.percentageChange !== 0 ? (
                                    <span
                                        className={`inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-black tracking-wider uppercase ${
                                            isPositive
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-rose-50 text-rose-700"
                                        }`}
                                    >
                                        {isPositive ? (
                                            <ArrowUpRight className="h-3 w-3" />
                                        ) : (
                                            <ArrowDownRight className="h-3 w-3" />
                                        )}
                                        {changeVal}%
                                    </span>
                                ) : (
                                    <span className="inline-flex rounded-lg bg-gray-50 px-2 py-0.5 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                        0.0%
                                    </span>
                                )}
                                <span className="text-[10px] font-bold text-gray-400">
                                    vs {formatValue(stats.prevValue)} prev
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </TooltipProvider>
    );
};

export default KpiCards;
