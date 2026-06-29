import React from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Truck, AlertCircle, FileClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const TravelAnalytics = ({ data, isLoading, hasData }) => {
    const trendData = (data?.trend || []).map((t, idx) => ({ date: t.date, amount: t.value }));

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-lg">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        {payload[0].payload.date}
                    </p>
                    <p className="mt-0.5 text-xs font-black text-blue-600">
                        ₹{payload[0].value.toLocaleString()}
                    </p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                        Travel Fee
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col h-[400px]">
            {/* Title */}
            <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                <div>
                    <h3 className="text-base font-black text-gray-900 tracking-tight">Travel Charge Analytics</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">Metrics relating to provider distance billing.</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                    <Truck className="h-4 w-4" />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col mt-5 justify-between">
                {isLoading ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : !hasData || !data || data.totalTravelCharges === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center py-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3">
                            <FileClock className="h-6 w-6" />
                        </div>
                        <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">No Travel Charges</h4>
                        <p className="mt-1 max-w-[240px] text-[10px] font-semibold text-gray-400">
                            No travel distance fees were billed during this period.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* 100% Policy Notice */}
                        <div className="flex items-center gap-2.5 rounded-xl bg-cyan-50/50 border border-cyan-100/50 p-3 mb-3">
                            <AlertCircle className="h-4 w-4 text-cyan-600 flex-shrink-0" />
                            <p className="text-[10px] font-bold text-cyan-700 leading-normal">
                                <span className="font-black">100% Paid to Partner:</span> RozSewa distributes all collected distance fees directly to providers without charging a platform commission fee.
                            </p>
                        </div>

                        {/* Top Highlights */}
                        <div className="grid grid-cols-3 gap-2.5">
                            <div className="rounded-xl bg-gray-50/50 border border-gray-100 p-3">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Collected</p>
                                <h4 className="text-sm font-black text-gray-900 mt-1">
                                    ₹{(data.totalTravelCharges || 0).toLocaleString()}
                                </h4>
                            </div>
                            <div className="rounded-xl bg-emerald-50/30 border border-emerald-100/55 p-3">
                                <p className="text-[9px] font-bold text-emerald-600/80 uppercase tracking-wider">Paid to Partner</p>
                                <h4 className="text-sm font-black text-emerald-700 mt-1">
                                    ₹{(data.paidToPartners || 0).toLocaleString()}
                                </h4>
                            </div>
                            <div className="rounded-xl bg-gray-50/50 border border-gray-100 p-3">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Today's Fee</p>
                                <h4 className="text-sm font-black text-gray-900 mt-1">
                                    ₹{(data.travelChargesToday || 0).toLocaleString()}
                                </h4>
                            </div>
                        </div>

                        {/* Secondary Stats */}
                        <div className="grid grid-cols-3 gap-4 border-y border-gray-50 py-3.5 my-3">
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-gray-400 block">Avg Distance</span>
                                <span className="text-xs font-black text-gray-800 mt-1 block">
                                    {data.averageDistance || 0} km
                                </span>
                            </div>
                            <div className="text-center border-x border-gray-100">
                                <span className="text-[10px] font-bold text-gray-400 block">Avg Travel Charge</span>
                                <span className="text-xs font-black text-gray-800 mt-1 block">
                                    ₹{Math.round(data.averageTravelCharge || 0)}
                                </span>
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-gray-400 block">Highest Charge</span>
                                <span className="text-xs font-black text-gray-800 mt-1 block">
                                    ₹{Math.round(data.highestCharge || 0)}
                                </span>
                            </div>
                        </div>

                        {/* Spark Trend */}
                        <div className="h-16 w-full mt-1">
                            {trendData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey="amount"
                                            stroke="#06b6d4"
                                            strokeWidth={2}
                                            dot={{ stroke: "#06b6d4", strokeWidth: 1.5, r: 2, fill: "#fff" }}
                                            activeDot={{ stroke: "#06b6d4", strokeWidth: 1.5, r: 4, fill: "#06b6d4" }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center border-t border-dashed border-gray-100 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                                    No Daily Trend Available
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TravelAnalytics;
