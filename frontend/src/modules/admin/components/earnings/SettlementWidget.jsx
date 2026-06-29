import React from "react";
import { CreditCard, ExternalLink, Calendar, Hourglass, CheckCircle2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

const SettlementWidget = ({ data, isLoading }) => {
    const navigate = useNavigate();

    const handleViewSettlements = () => {
        navigate("/admin/withdrawals");
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col h-[400px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                <div>
                    <h3 className="text-base font-black text-gray-900 tracking-tight">Settlement Dashboard</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">Partner payouts and withdrawal clearing logs.</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <CreditCard className="h-4 w-4" />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-between mt-5">
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-20 w-full" />
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <>
                        {/* SLA / Time Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center border border-gray-200 text-gray-500 shadow-xs">
                                    <Hourglass className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Avg Settlement</span>
                                    <span className="text-sm font-black text-gray-800 mt-0.5 block">
                                        {data?.avgSettlementTime || "4.0 hours"}
                                    </span>
                                </div>
                            </div>
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center border border-gray-200 text-gray-500 shadow-xs">
                                    <UsersIcon className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Pending Partners</span>
                                    <span className="text-sm font-black text-gray-800 mt-0.5 block">
                                        {data?.pendingPartnersCount || 0} Providers
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Status Grid */}
                        <div className="grid grid-cols-2 gap-3.5 my-4">
                            <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <span className="text-xs font-semibold text-gray-600">Paid Today</span>
                                </div>
                                <span className="text-xs font-black text-gray-800">
                                    ₹{(data?.paidToday || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Hourglass className="h-4 w-4 text-amber-500" />
                                    <span className="text-xs font-semibold text-gray-600">Pending</span>
                                </div>
                                <span className="text-xs font-black text-gray-800">
                                    ₹{(data?.pending || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-blue-500" />
                                    <span className="text-xs font-semibold text-gray-600">Processing</span>
                                </div>
                                <span className="text-xs font-black text-gray-800">
                                    ₹{(data?.processing || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                                    <span className="text-xs font-semibold text-gray-600">Failed</span>
                                </div>
                                <span className="text-xs font-black text-rose-600">
                                    ₹{(data?.failed || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Payout Action */}
                        <button
                            onClick={handleViewSettlements}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-black text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-98"
                        >
                            View Settlements
                            <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

// Simple Users Icon helper inside module
const UsersIcon = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

export default SettlementWidget;
