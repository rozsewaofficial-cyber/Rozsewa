import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

// Modular sub-components imports
import Header from "../components/earnings/Header";
import KpiCards from "../components/earnings/KpiCards";
import RevenueTrendChart from "../components/earnings/RevenueTrendChart";
import CommissionTrendChart from "../components/earnings/CommissionTrendChart";
import RevenueSourcesChart from "../components/earnings/RevenueSourcesChart";
import CategoryBreakdown from "../components/earnings/CategoryBreakdown";
import TravelAnalytics from "../components/earnings/TravelAnalytics";
import SettlementWidget from "../components/earnings/SettlementWidget";
import PartnerLeaderboard from "../components/earnings/PartnerLeaderboard";
import PaymentAnalytics from "../components/earnings/PaymentAnalytics";
import TransactionsTable from "../components/earnings/TransactionsTable";
import FiltersDrawer from "../components/earnings/FiltersDrawer";

const AdminEarnings = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();

    // Primary search and date filters
    const [range, setRange] = useState("30d");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [globalSearch, setGlobalSearch] = useState("");
    const [isExporting, setIsExporting] = useState(false);

    // Advanced Drawer filters
    const [advancedFilters, setAdvancedFilters] = useState({
        category: "",
        partnerId: "",
        city: "",
        paymentMethod: "",
        bookingStatus: "",
        transactionType: ""
    });
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    // Data states
    const [analyticsData, setAnalyticsData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Set page title on mount
    useEffect(() => {
        setTitle("Revenue & Earnings");
    }, [setTitle]);

    // Fetch dashboard statistics from backend API
    const fetchAnalytics = useCallback(async () => {
        setIsLoading(true);
        try {
            // Build query params
            const params = {
                range,
                startDate,
                endDate,
                ...advancedFilters
            };

            // Remove empty keys
            Object.keys(params).forEach((key) => {
                if (params[key] === "" || params[key] === undefined || params[key] === null) {
                    delete params[key];
                }
            });

            const { data } = await API.get("/admin/earnings", { params });
            setAnalyticsData(data);
        } catch (error) {
            console.error("fetchAnalytics error:", error);
            toast({
                title: "Fetch Error",
                description: error.response?.data?.message || "Failed to load financial aggregates.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [range, startDate, endDate, advancedFilters, toast]);

    // Trigger API call when filters change
    useEffect(() => {
        // Prevent fetching if range is custom but date values are incomplete
        if (range === "custom" && (!startDate || !endDate)) {
            return;
        }
        fetchAnalytics();
    }, [fetchAnalytics, range, startDate, endDate]);

    const handleRefresh = () => {
        fetchAnalytics();
        toast({
            title: "Re-cleared",
            description: "Analytics successfully synced with live ledger."
        });
    };

    // Export complete aggregated data as CSV
    const handleExportReport = () => {
        if (!analyticsData) return;
        setIsExporting(true);
        toast({
            title: "Generating report",
            description: "Exporting consolidated financial report..."
        });

        setTimeout(() => {
            // Build CSV rows from analyticsData
            const rows = [];

            // Summary section
            rows.push(["ROZSEWA EARNINGS REPORT", `Range: ${range}`]);
            rows.push([]);
            rows.push(["--- SUMMARY ---"]);
            rows.push(["Metric", "Value"]);
            rows.push(["Total Revenue (₹)", analyticsData.totalRevenue ?? ""]);
            rows.push(["Total Commission (₹)", analyticsData.totalCommission ?? ""]);
            rows.push(["Total Settlements (₹)", analyticsData.totalSettlements ?? ""]);
            rows.push(["Total Bookings", analyticsData.totalBookings ?? ""]);
            rows.push([]);

            // Transactions section
            if (Array.isArray(analyticsData.transactions) && analyticsData.transactions.length > 0) {
                rows.push(["--- TRANSACTIONS ---"]);
                const txKeys = Object.keys(analyticsData.transactions[0]);
                rows.push(txKeys);
                analyticsData.transactions.forEach(tx => {
                    rows.push(txKeys.map(k => tx[k] ?? ""));
                });
                rows.push([]);
            }

            // Settlements section
            if (Array.isArray(analyticsData.settlements) && analyticsData.settlements.length > 0) {
                rows.push(["--- SETTLEMENTS ---"]);
                const sKeys = Object.keys(analyticsData.settlements[0]);
                rows.push(sKeys);
                analyticsData.settlements.forEach(s => {
                    rows.push(sKeys.map(k => s[k] ?? ""));
                });
                rows.push([]);
            }

            // Convert rows to CSV string
            const csvContent = rows.map(row =>
                row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
            ).join("\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const downloadAnchorNode = document.createElement("a");
            downloadAnchorNode.setAttribute("href", url);
            downloadAnchorNode.setAttribute("download", `rozsewa_earnings_report_${range}.csv`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(url);

            setIsExporting(false);
            toast({
                title: "Report Exported",
                description: "CSV file downloaded successfully. Open with Excel or Google Sheets."
            });
        }, 1200);
    };

    // Reset advanced drawer filters
    const handleResetFilters = () => {
        setAdvancedFilters({
            category: "",
            partnerId: "",
            city: "",
            paymentMethod: "",
            bookingStatus: "",
            transactionType: ""
        });
        setIsFiltersOpen(false);
        toast({
            title: "Filters Cleared",
            description: "Advanced query filters reset to default parameters."
        });
    };

    // Calculate active filters count for badge display
    const activeFiltersCount = useMemo(() => {
        return Object.values(advancedFilters).filter((val) => val !== "").length;
    }, [advancedFilters]);

    // Derive filter options dynamically from data records to prevent hardcoding
    const dropdownOptions = useMemo(() => {
        if (!analyticsData || !analyticsData.hasHistoricalData) {
            return { categories: [], partners: [], cities: [] };
        }

        const categoriesSet = new Set();
        const partnersMap = new Map();
        const citiesSet = new Set();

        // Extract from transactions ledger to ensure accuracy
        const txns = analyticsData.transactions || [];
        txns.forEach((t) => {
            if (t.category && t.category !== "Settlement") {
                categoriesSet.add(t.category);
            }
            if (t.partner && t.partner.name !== "Partner" && t.partner.name !== "N/A") {
                const pId = t.partner.id && t.partner.id !== "N/A" ? t.partner.id : t.partner.name;
                partnersMap.set(pId, { id: pId, name: t.partner.name });
            }
            if (t.city) {
                citiesSet.add(t.city);
            }
        });

        // Fallbacks if tables are empty
        if (categoriesSet.size === 0 && analyticsData.categories) {
            analyticsData.categories.forEach((c) => categoriesSet.add(c.category));
        }

        return {
            categories: Array.from(categoriesSet),
            partners: Array.from(partnersMap.values()),
            cities: Array.from(citiesSet)
        };
    }, [analyticsData]);

    const hasData = analyticsData?.hasHistoricalData ?? false;

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-16">
            {/* Header section with Picker actions */}
            <Header
                range={range}
                setRange={setRange}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                globalSearch={globalSearch}
                setGlobalSearch={setGlobalSearch}
                onExport={handleExportReport}
                onRefresh={handleRefresh}
                isExporting={isExporting}
                isLoading={isLoading}
            />

            {/* KPI Cards (6 metrics) */}
            <KpiCards data={analyticsData?.overview} isLoading={isLoading} />

            {/* Grid 1: Revenue Trends & Commission Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RevenueTrendChart
                    data={analyticsData?.trends?.activeTrendRevenue}
                    isLoading={isLoading}
                    hasData={hasData}
                />
                <CommissionTrendChart
                    data={analyticsData?.trends?.activeTrendCommission}
                    isLoading={isLoading}
                    hasData={hasData}
                />
            </div>

            {/* Grid 2: Revenue Categories & Sources share */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CategoryBreakdown data={analyticsData?.categories} isLoading={isLoading} hasData={hasData} />
                <RevenueSourcesChart data={analyticsData?.revenueSources} isLoading={isLoading} hasData={hasData} />
            </div>

            {/* Grid 3: Core Travel Charges & Settlements Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TravelAnalytics data={analyticsData?.travel} isLoading={isLoading} hasData={hasData} />
                <SettlementWidget data={analyticsData?.settlements} isLoading={isLoading} />
            </div>

            {/* Grid 4: Leaderboard Performance & Payment Shares */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <PartnerLeaderboard data={analyticsData?.partners} isLoading={isLoading} />
                </div>
                <div>
                    <PaymentAnalytics data={analyticsData?.payments} isLoading={isLoading} hasData={hasData} />
                </div>
            </div>

            {/* Audit Table Ledger */}
            <TransactionsTable
                transactions={analyticsData?.transactions}
                isLoading={isLoading}
                onOpenFilters={() => setIsFiltersOpen(true)}
                activeFiltersCount={activeFiltersCount}
                globalSearch={globalSearch}
                setGlobalSearch={setGlobalSearch}
            />

            {/* Slide-out Filters Drawer */}
            <FiltersDrawer
                isOpen={isFiltersOpen}
                onClose={() => setIsFiltersOpen(false)}
                filters={advancedFilters}
                setFilters={setAdvancedFilters}
                categories={dropdownOptions.categories}
                partners={dropdownOptions.partners}
                cities={dropdownOptions.cities}
                onReset={handleResetFilters}
            />
        </div>
    );
};

export default AdminEarnings;
