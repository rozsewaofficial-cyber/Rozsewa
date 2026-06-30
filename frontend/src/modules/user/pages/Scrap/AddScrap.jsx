import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Image, Loader2, MapPin, X, IndianRupee, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { z } from "zod";
import api from '@/lib/api';

const conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor', 'Not Applicable'];

const adSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100, "Title too long"),
  description: z.string().min(20, "Description must be at least 20 characters").max(2000, "Description too long"),
  category: z.string().min(2, "Category is required"),
  brand: z.string().optional(),
  condition: z.enum(['New', 'Like New', 'Good', 'Fair', 'Poor', 'Not Applicable']),
  price: z.number().min(0, "Price cannot be negative"),
  isNegotiable: z.boolean(),
  location: z.object({
    areaName: z.string().min(3, "Area name is required"),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    exactAddress: z.string().min(5, "Exact address is required"),
    houseNumber: z.string().optional()
  })
});

const AddScrap = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    brand: '',
    condition: 'Good',
    price: '',
    isNegotiable: false,
    location: {
      areaName: '',
      city: '',
      state: '',
      exactAddress: '',
      houseNumber: '',
      coordinates: [0, 0] // Dummy for now without GPS
    }
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/bazaar/categories');
      if (res.data.success && res.data.data.length > 0) {
        setCategories(res.data.data);
        setFormData(prev => ({ ...prev, category: res.data.data[0].name }));
      }
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  // Removed automatic location fetch on mount. Added manual button instead.

  const fetchLiveLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: 'Geolocation is not supported by your browser', variant: 'destructive' });
      return;
    }

    const toastId = toast({ title: 'Fetching location...', description: 'Please wait' });

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          coordinates: [lng, lat]
        }
      }));

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        
        if (data && data.address) {
          setFormData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              areaName: data.address.suburb || data.address.neighbourhood || data.address.residential || prev.location.areaName,
              city: data.address.city || data.address.town || data.address.county || prev.location.city,
              state: data.address.state || prev.location.state,
              exactAddress: data.display_name || prev.location.exactAddress
            }
          }));
          toast({ title: 'Location fetched successfully!' });
        }
      } catch (err) {
        console.error("Reverse geocoding failed", err);
        toast({ title: 'Got coordinates, but failed to fetch address names.', variant: 'default' });
      }
    }, (err) => {
      toast({ title: 'Failed to get location', description: err.message, variant: 'destructive' });
    });
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedFiles.length > 10) {
      toast({ title: 'Maximum 10 images allowed', variant: 'destructive' });
      return;
    }

    const newFiles = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'idle'
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const removeImage = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (selectedFiles.length < 2) {
      toast({ title: 'Minimum 2 images are required to post an ad', variant: 'destructive' });
      return;
    }

    const payload = { ...formData, price: Number(formData.price) };
    const validationResult = adSchema.safeParse(payload);
    
    if (!validationResult.success) {
      toast({ title: validationResult.error.errors[0].message, variant: 'destructive' });
      return;
    }

    try {
      setIsUploading(true);

      const imageUrls = [];
      const updatedFiles = [...selectedFiles];

      for (let i = 0; i < updatedFiles.length; i++) {
        const item = updatedFiles[i];
        try {
          setSelectedFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));
          const uploadData = new FormData();
          uploadData.append('image', item.file);

          const uploadRes = await api.post('/upload', uploadData);
          
          if(uploadRes.data.url) imageUrls.push(uploadRes.data.url);
          else imageUrls.push("https://via.placeholder.com/400"); // fallback

          setSelectedFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', progress: 100 } : f));
        } catch (err) {
          console.error('Image upload failed', err);
          setSelectedFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f));
        }
      }

      if (imageUrls.length < 2) {
        setIsUploading(false);
        toast({ title: 'Failed to upload enough images.', variant: 'destructive' });
        return;
      }

      const finalData = { ...payload, images: imageUrls };

      const res = await api.post('/bazaar/post', finalData);
      if (res.data.success) {
        toast({ title: 'Ad submitted for review!' });
        navigate('/bazaar');
      }
    } catch (err) {
      toast({ title: err.response?.data?.message || 'Failed to post ad', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const updateLocation = (field, value) => {
    setFormData(prev => ({ ...prev, location: { ...prev.location, [field]: value } }));
  };

  return (
    <div className="min-h-screen pb-20 relative bg-slate-50 dark:bg-slate-950">
      <div className="relative z-10">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-black/[0.03] dark:border-white/[0.02] px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm border border-black/[0.02] dark:border-white/[0.02]">
            <ArrowLeft className="w-5 h-5 text-slate-800 dark:text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Post an Ad</h1>
            <p className="text-[11px] font-semibold text-slate-500">RozSewa Bazaar</p>
          </div>
        </header>

        <form onSubmit={handleCreate} className="p-4 space-y-4 pb-8 max-w-xl mx-auto">
          {/* Photos */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <label className="block text-sm font-black text-slate-800 dark:text-white mb-1">Add Photos</label>
            <p className="text-[11px] text-slate-500 mb-4 font-medium">Upload 2 to 10 photos of your item.</p>
            <div className="grid grid-cols-4 gap-2">
              {selectedFiles.map((item, index) => (
                <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 group">
                  <img src={item.preview} alt="Preview" className="w-full h-full object-cover" />
                  {item.status === 'done' && (
                    <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-0.5"><CheckCircle size={10} /></div>
                  )}
                  {item.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center"><X className="text-red-500" /></div>
                  )}
                  <button type="button" onClick={() => removeImage(index)} disabled={isUploading} className="absolute top-1 right-1 w-5 h-5 bg-black/50 backdrop-blur-sm text-white rounded-full flex items-center justify-center">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {selectedFiles.length < 10 && !isUploading && (
                <div onClick={() => document.getElementById('ad-photo-upload')?.click()} className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <Image className="w-5 h-5 text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Upload</span>
                  <input id="ad-photo-upload" type="file" className="hidden" accept="image/*" multiple onChange={handleImageSelect} />
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
            <h2 className="text-sm font-black text-slate-800 dark:text-white">Ad Details</h2>
            
            <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Category</label>
                <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm outline-none dark:text-white focus:border-blue-500" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required>
                  {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                </select>
              </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Ad Title</label>
              <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" placeholder="Brand, model, key details" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Description (min 20 chars)</label>
              <textarea className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white min-h-[100px]" placeholder="Include condition, features, reason for selling..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Brand (Optional)</label>
                <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" placeholder="e.g. Apple, Sony" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Condition</label>
                <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" value={formData.condition} onChange={e => setFormData({ ...formData, condition: e.target.value })}>
                  {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-black text-slate-800 dark:text-white mb-4">Pricing</h2>
            <div className="space-y-4">
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="number" className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-base font-black outline-none dark:text-white" placeholder="0" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required min="0" />
              </div>
              <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
                <input type="checkbox" checked={formData.isNegotiable} onChange={e => setFormData({ ...formData, isNegotiable: e.target.checked })} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-bold text-slate-800 dark:text-white">Price is Negotiable</span>
              </label>
            </div>
          </div>

          {/* Location details (Masked in public) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <MapPin className="text-blue-600 w-4 h-4" /> Location Details
              </h2>
              <button
                type="button"
                onClick={fetchLiveLocation}
                className="text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <MapPin className="w-3 h-3" /> Fetch Live Location
              </button>
            </div>
            
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-xl mb-4">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-semibold text-blue-800 dark:text-blue-300">Your exact address and phone number are hidden. Buyers will only see your Area Name and City.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Exact Full Address (Hidden)</label>
                <input type="text" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" placeholder="e.g. 42 MG Road, near Apollo" value={formData.location.exactAddress} onChange={e => updateLocation('exactAddress', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Area Name (Public)</label>
                  <input type="text" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" placeholder="e.g. MG Road" value={formData.location.areaName} onChange={e => updateLocation('areaName', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">House No. (Hidden)</label>
                  <input type="text" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" placeholder="e.g. 42" value={formData.location.houseNumber} onChange={e => updateLocation('houseNumber', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">City (Public)</label>
                  <input type="text" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" placeholder="e.g. Mumbai" value={formData.location.city} onChange={e => updateLocation('city', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">State</label>
                  <input type="text" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none dark:text-white" placeholder="e.g. MH" value={formData.location.state} onChange={e => updateLocation('state', e.target.value)} required />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" disabled={isUploading} className="w-full py-4 rounded-2xl text-white font-black shadow-lg shadow-blue-200 dark:shadow-none active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700">
              {isUploading ? (<><Loader2 className="animate-spin w-5 h-5" /><span>Processing Ad...</span></>) : 'Post Ad for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddScrap;
