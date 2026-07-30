import { useState, useEffect } from "react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Coins, Save, Info } from "lucide-react";

const AdminFeeSettings = () => {
    const { toast } = useToast();
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [gstPercent, setGstPercent] = useState(0);
    const [platformFee, setPlatformFee] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await API.get(`/admin/categories`);
            setCategories(res.data);
        } catch (error) {
            toast({ title: "Failed to fetch categories", variant: "destructive" });
        }
    };

    const handleCategoryChange = (e) => {
        const catId = e.target.value;
        const cat = categories.find((c) => c._id === catId);
        setSelectedCategory(cat);
        if (cat) {
            setGstPercent(cat.gstPercent || 0);
            setPlatformFee(cat.platformFee || 0);
        } else {
            setGstPercent(0);
            setPlatformFee(0);
        }
    };

    const handleSave = async () => {
        if (!selectedCategory) {
            return toast({ title: "Please select a category first.", variant: "destructive" });
        }
        setLoading(true);
        try {
            await API.put(
                `/admin/categories/${selectedCategory._id}`,
                {
                    gstPercent: Number(gstPercent),
                    platformFee: Number(platformFee)
                }
            );
            toast({ title: "Fees updated successfully!" });
            fetchCategories();
        } catch (error) {
            toast({ title: error.response?.data?.message || "Failed to update fees", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <Coins className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-bold">Category Fee Management</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Category</label>
                    <select
                        className="w-full border-gray-300 rounded-lg p-3 border focus:ring-primary focus:border-primary"
                        onChange={handleCategoryChange}
                        value={selectedCategory?._id || ""}
                    >
                        <option value="">-- Select a Category --</option>
                        {categories.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedCategory && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                            <div className="text-sm text-blue-700">
                                <p><strong>GST:</strong> Always calculated as a percentage (%) of the base service amount.</p>
                                <p><strong>Platform Fee:</strong> Always a flat positive number (₹) added to the final amount.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    GST Percentage (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={gstPercent}
                                    onChange={(e) => setGstPercent(e.target.value)}
                                    className="w-full border-gray-300 rounded-lg p-3 border focus:ring-primary focus:border-primary"
                                    placeholder="e.g., 18"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Platform Fee (Flat ₹)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={platformFee}
                                    onChange={(e) => setPlatformFee(e.target.value)}
                                    className="w-full border-gray-300 rounded-lg p-3 border focus:ring-primary focus:border-primary"
                                    placeholder="e.g., 50"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="w-full sm:w-auto px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {loading ? "Saving..." : "Save Fee Settings"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminFeeSettings;
