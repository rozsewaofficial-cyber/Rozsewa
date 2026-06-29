import React from "react";
import { Award, Star, ArrowUpRight, ArrowDownRight, TrendingUp, HelpCircle, FileClock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

const PartnerLeaderboard = ({ data, isLoading }) => {
    const topPartners = data?.topPartners || [];
    const topCategories = data?.topCategories || [];

    const getInitials = (name) => {
        return (name || "")
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Partners Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col h-[380px]">
                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <div>
                        <h3 className="text-base font-black text-gray-900 tracking-tight">Top Performing Partners</h3>
                        <p className="text-xs font-semibold text-gray-400 mt-0.5">Top 5 service providers by completed sales.</p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                        <Award className="h-4.5 w-4.5" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto mt-4 pr-1">
                    {isLoading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-9 w-9 rounded-full" />
                                        <div>
                                            <Skeleton className="h-4 w-28" />
                                            <Skeleton className="h-3 w-16 mt-1" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-4 w-16" />
                                </div>
                            ))}
                        </div>
                    ) : topPartners.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3">
                                <FileClock className="h-6 w-6" />
                            </div>
                            <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">No Partner Leaderboard</h4>
                            <p className="mt-1 text-[10px] font-semibold text-gray-400">
                                No partner bookings recorded for this range.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {topPartners.map((p, idx) => (
                                <div
                                    key={p.name}
                                    className="flex items-center justify-between group hover:bg-gray-50/50 p-2 rounded-xl transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <Avatar className="h-9 w-9 border border-gray-100 shadow-xs">
                                                <AvatarImage src={p.avatar} alt={p.name} />
                                                <AvatarFallback className="bg-purple-100 text-[10px] font-black text-purple-700">
                                                    {getInitials(p.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-black text-white shadow-xs border border-white">
                                                {idx + 1}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-black text-gray-800 tracking-tight block">
                                                {p.name}
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] font-bold text-gray-400">
                                                    {p.bookings} bookings
                                                </span>
                                                <span className="text-gray-300">•</span>
                                                <div className="flex items-center gap-0.5 text-yellow-500">
                                                    <Star className="h-2.5 w-2.5 fill-current" />
                                                    <span className="text-[9px] font-black">{p.rating}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-black text-gray-900 block">
                                            ₹{Math.round(p.revenue).toLocaleString()}
                                        </span>
                                        <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-widest mt-0.5">
                                            Gross
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Top Categories Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col h-[380px]">
                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <div>
                        <h3 className="text-base font-black text-gray-900 tracking-tight">Trending Categories</h3>
                        <p className="text-xs font-semibold text-gray-400 mt-0.5">Top performance categories by growth and share.</p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <TrendingUp className="h-4.5 w-4.5" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto mt-4 pr-1">
                    {isLoading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div>
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-12 mt-1" />
                                    </div>
                                    <Skeleton className="h-4 w-14" />
                                </div>
                            ))}
                        </div>
                    ) : topCategories.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3">
                                <FileClock className="h-6 w-6" />
                            </div>
                            <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">No Category Leaderboard</h4>
                            <p className="mt-1 text-[10px] font-semibold text-gray-400">
                                No category bookings recorded for this range.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {topCategories.map((c) => {
                                const isPositive = c.growth >= 0;
                                const growthVal = Math.abs(c.growth);

                                return (
                                    <div
                                        key={c.category}
                                        className="flex items-center justify-between group hover:bg-gray-50/50 p-2 rounded-xl transition-all"
                                    >
                                        <div>
                                            <span className="text-xs font-black text-gray-800 uppercase tracking-wide block">
                                                {c.category}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-400 block mt-0.5">
                                                {c.bookings} bookings executed
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <span className="text-xs font-black text-gray-900 block">
                                                    ₹{Math.round(c.revenue).toLocaleString()}
                                                </span>
                                            </div>
                                            {c.growth !== 0 ? (
                                                <span
                                                    className={`inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                                        isPositive
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-rose-50 text-rose-700"
                                                    }`}
                                                >
                                                    {isPositive ? (
                                                        <ArrowUpRight className="h-2.5 w-2.5" />
                                                    ) : (
                                                        <ArrowDownRight className="h-2.5 w-2.5" />
                                                    )}
                                                    {growthVal}%
                                                </span>
                                            ) : (
                                                <span className="inline-flex rounded-lg bg-gray-50 px-2 py-0.5 text-[9px] font-black text-gray-500 uppercase tracking-wider">
                                                    0%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PartnerLeaderboard;
