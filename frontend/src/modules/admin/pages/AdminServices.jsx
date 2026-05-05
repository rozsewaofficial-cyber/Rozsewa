import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Search, Edit, Trash2, Loader2, Image as ImageIcon, ChevronRight, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminServices = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [newCat, setNewCat] = useState({
    name: "",
    icon: "Scissors",
    description: "",
    image: "",
    services: [] // Default sub-services
  });

  useEffect(() => {
    setTitle("Category & Service Manager");
    fetchCategories();
  }, [setTitle]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/admin/categories");
      setCategories(data);
    } catch (err) {
      toast({ title: "Fetch Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const upData = new FormData();
    upData.append("image", file);
    setIsUploading(true);
    try {
      const { data } = await API.post("/upload", upData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setNewCat({ ...newCat, image: data.url });
      toast({ title: "Photo Uploaded" });
    } catch { toast({ title: "Upload Failed", variant: "destructive" }); }
    finally { setIsUploading(false); }
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!newCat.name) return;

    try {
      if (editingCat) {
        const { data } = await API.put(`/admin/categories/${editingCat._id}`, newCat);
        setCategories(categories.map(c => c._id === data._id ? data : c));
        toast({ title: "Category Updated" });
      } else {
        const { data } = await API.post("/admin/categories", newCat);
        setCategories([...categories, data]);
        toast({ title: "Category Created" });
      }
      setShowModal(false);
      setEditingCat(null);
      setNewCat({ name: "", icon: "Scissors", description: "", image: "", services: [] });
    } catch (err) {
      toast({ title: "Save Failed", variant: "destructive" });
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Delete this category and all its default services?")) return;
    try {
      await API.delete(`/admin/categories/${id}`);
      setCategories(categories.filter(c => c._id !== id));
      toast({ title: "Category Removed" });
    } catch (err) {
      toast({ title: "Delete Failed", variant: "destructive" });
    }
  };

  const addServiceRow = () => {
    setNewCat({ ...newCat, services: [...newCat.services, { name: "", basePrice: 0 }] });
  };

  const removeServiceRow = (idx) => {
    const updated = [...newCat.services];
    updated.splice(idx, 1);
    setNewCat({ ...newCat, services: updated });
  };

  const updateServiceRow = (idx, field, value) => {
    const updated = [...newCat.services];
    updated[idx][field] = value;
    setNewCat({ ...newCat, services: updated });
  };

  const startEdit = (cat) => {
    setEditingCat(cat);
    setNewCat({
      name: cat.name,
      icon: cat.icon || "Scissors",
      description: cat.description || "",
      image: cat.image || "",
      services: cat.services || []
    });
    setShowModal(true);
  };

  const filteredCategories = (categories || []).filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      <p className="text-xs font-black uppercase tracking-widest text-gray-400">Loading Industries...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Industries & Services</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">Define the core categories and services available on RozSewa.</p>
        </div>
        <button onClick={() => { setEditingCat(null); setNewCat({ name: "", icon: "Scissors", description: "", image: "", services: [] }); setShowModal(true); }} className="flex h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all hover:-translate-y-0.5 active:translate-y-0">
          <Plus className="h-5 w-5" /> Add Industry
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm" placeholder="Search major categories..." />
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCategories.length === 0 ? (
          <div className="col-span-full py-20 text-center text-gray-400 italic">No categories found. Add one to get started.</div>
        ) : (
          filteredCategories.map(cat => (
            <motion.div key={cat._id} whileHover={{ y: -4 }} className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/40 hover:border-emerald-200 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="h-16 w-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-inner overflow-hidden">
                  {cat.image ? (
                    <img src={cat.image} className="h-full w-full object-cover" />
                  ) : (
                    <Layers className="h-6 w-6" />
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(cat)} className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => deleteCategory(cat._id)} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">{cat.name}</h3>
              <p className="text-xs text-gray-500 font-bold mb-4 line-clamp-2">{cat.description || "No description provided."}</p>

              <div className="space-y-2 border-t border-gray-50 pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Included Services ({cat.services?.length || 0})</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.services?.slice(0, 4).map((s, i) => (
                    <span key={i} className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[9px] font-black uppercase text-gray-500">{s.name}</span>
                  ))}
                  {(cat.services?.length || 0) > 4 && (
                    <span className="px-2 py-0.5 text-[9px] font-black text-gray-400">+{cat.services.length - 4} more</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-2xl rounded-[2.5rem] bg-white shadow-2xl p-8 border border-gray-100 my-auto">
              <h3 className="text-2xl font-black text-gray-900 mb-6">{editingCat ? "Edit Industry" : "Add New Industry"}</h3>

              <form onSubmit={handleSaveCategory} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Category Name</label>
                    <input type="text" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 outline-none" placeholder="e.g. Salon & Grooming" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Icon Name (Lucide)</label>
                    <input type="text" value={newCat.icon} onChange={e => setNewCat({ ...newCat, icon: e.target.value })} className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 outline-none" placeholder="e.g. Scissors" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Category Image</label>
                    <label className="relative flex flex-col items-center justify-center w-full h-40 rounded-3xl border-2 border-dashed border-gray-100 bg-gray-50 hover:bg-gray-100 cursor-pointer overflow-hidden transition-all">
                      <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                      {newCat.image ? (
                        <img src={newCat.image} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center">
                          <ImageIcon className="h-8 w-8 text-gray-300 mb-2" />
                          <span className="text-[9px] font-black text-gray-400 uppercase">Upload Photo</span>
                        </div>
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                        </div>
                      )}
                    </label>
                  </div>
                  <div className="col-span-2 space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Description</label>
                      <textarea value={newCat.description} onChange={e => setNewCat({ ...newCat, description: e.target.value })} className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 outline-none h-[120px]" placeholder="Brief summary of this industry..." />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center decoration-emerald-500">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Manage Services</label>
                    <button type="button" onClick={addServiceRow} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">+ Add Service</button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    {newCat.services.map((s, idx) => (
                      <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-right-4 duration-300">
                        <input type="text" placeholder="Service Name" value={s.name} onChange={e => updateServiceRow(idx, 'name', e.target.value)} className="flex-1 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs font-bold" />
                        <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] uppercase font-black">₹</span>
                          <input type="number" placeholder="Base" value={s.basePrice} onChange={e => updateServiceRow(idx, 'basePrice', e.target.value)} className="w-full rounded-xl border border-gray-100 bg-gray-50 p-3 pl-6 text-xs font-bold" />
                        </div>
                        <button type="button" onClick={() => removeServiceRow(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    {newCat.services.length === 0 && (
                      <p className="text-center py-6 text-xs font-bold italic text-gray-300">No services added yet.</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-2xl border border-gray-200 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 rounded-2xl bg-emerald-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdminServices;
