import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { MapPin, Plus, Move, X, Save, Trash2, Loader2, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";

const containerStyle = { width: '100%', height: '100%' };
const center = { lat: 28.6139, lng: 77.2090 }; // Delhi

const AdminZones = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [zones, setZones] = useState([]);
    const [newZone, setNewZone] = useState({ name: "", type: "Tier 1 Metro", location: center });
    const [map, setMap] = useState(null);

    useScrollLock(showModal);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    });

    useEffect(() => {
        setTitle("Zones & Cities");
        fetchZones();
    }, [setTitle]);

    const fetchZones = async () => {
        try {
            const { data } = await API.get("/admin/zones");
            setZones(data);
        } catch (error) {
            toast({ title: "Fetch Failed", description: "Could not load zones.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleAddZone = async (e) => {
        e.preventDefault();
        if (!newZone.name) {
            toast({ title: "Name is required", variant: "destructive" });
            return;
        }
        try {
            const { data } = await API.post("/admin/zones", newZone);
            setZones([data, ...zones]);
            setShowModal(false);
            setNewZone({ name: "", type: "Tier 1 Metro", location: center });
            toast({ title: "Zone Added", description: `${newZone.name} is now operational.` });
        } catch (error) {
            toast({ title: "Error", description: error.response?.data?.message || "Could not add zone.", variant: "destructive" });
        }
    };

    const handleDeleteZone = async (id) => {
        if (!window.confirm("Are you sure you want to remove this zone?")) return;
        try {
            await API.delete(`/admin/zones/${id}`);
            setZones(zones.filter(z => z._id !== id));
            toast({ title: "Zone Removed", variant: "default" });
        } catch (error) {
            toast({ title: "Delete Failed", description: "Could not remove zone.", variant: "destructive" });
        }
    };

    const onMapClick = useCallback((e) => {
        setNewZone(prev => ({
            ...prev,
            location: { lat: e.latLng.lat(), lng: e.latLng.lng() }
        }));
    }, []);

    const zoomToZone = (loc) => {
        if (map) {
            map.panTo(loc);
            map.setZoom(14);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-foreground text-gray-900">City & Zone Management</h1>
                    <p className="text-sm text-muted-foreground mt-1 text-gray-500">Configure operational perimeters and geo-fenced boundaries.</p>
                </div>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-emerald-700 transition"
                >
                    <Plus className="h-4 w-4" /> Add New Zone
                </motion.button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-3xl border border-border bg-white shadow-xl h-[450px] relative overflow-hidden group border-gray-100">
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={center}
                            zoom={11}
                            onLoad={map => setMap(map)}
                            options={{
                                disableDefaultUI: true,
                                zoomControl: true,
                                styles: [
                                    { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#7c93a3" }, { "lightness": "-10" }] },
                                    { "featureType": "administrative.country", "elementType": "geometry", "stylers": [{ "visibility": "on" }] },
                                    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
                                    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }] }
                                ]
                            }}
                        >
                            {zones.map(zone => (
                                <MarkerF
                                    key={zone._id}
                                    position={zone.location}
                                    title={zone.name}
                                    label={{ text: zone.name, className: "font-black text-[10px] -mt-8 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100" }}
                                />
                            ))}
                        </GoogleMap>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
                            <p className="text-sm font-bold text-gray-500 italic">Initializing Satellite Network...</p>
                        </div>
                    )}
                    <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
                        <span className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-700 shadow-lg border border-emerald-50 pointer-events-auto flex items-center gap-2">
                            <Navigation className="h-3 w-3" /> Live Geofencing Active
                        </span>
                    </div>
                </div>

                <div className="rounded-3xl border border-border bg-white shadow-xl overflow-hidden border-gray-100 flex flex-col h-[450px]">
                    <div className="px-6 py-4 border-b border-border bg-gray-50/50 border-gray-100 flex items-center justify-between">
                        <h3 className="font-black text-gray-900 flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-emerald-600" /> Active Service Zones
                        </h3>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{zones.length} TOTAL</span>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-border border-gray-100 no-scrollbar">
                        {loading ? (
                            <div className="p-8 flex items-center justify-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                            </div>
                        ) : zones.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm italic flex flex-col items-center justify-center h-full gap-2">
                                <MapPin className="h-10 w-10 text-gray-100" />
                                No active zones found.
                            </div>
                        ) : (
                            zones.map((zone) => (
                                <div key={zone._id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition group cursor-pointer" onClick={() => zoomToZone(zone.location)}>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                            <MapPin className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-sm text-gray-900">{zone.name}</h4>
                                            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">{zone.type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="font-black text-gray-900 leading-none">{zone.activeProviders || 0}</p>
                                            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Providers</p>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone._id); }}
                                            className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-[40px] p-8 w-full max-w-2xl shadow-2xl border border-gray-100 overflow-hidden relative"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900">Define New Territory</h3>
                                    <p className="text-xs text-gray-500 font-bold">Pick coordinates and assign zone details.</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition active:scale-90">
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>
                            <form onSubmit={handleAddZone} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Zone Name</label>
                                        <input
                                            type="text"
                                            value={newZone.name}
                                            onChange={e => setNewZone({ ...newZone, name: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition font-black"
                                            placeholder="e.g. West Mumbai"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Market Type</label>
                                        <select
                                            value={newZone.type}
                                            onChange={e => setNewZone({ ...newZone, type: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition font-black appearance-none"
                                        >
                                            <option>Tier 1 Metro</option>
                                            <option>Tier 1 Premium</option>
                                            <option>Tier 2 City</option>
                                            <option>New Market</option>
                                        </select>
                                    </div>
                                    <div className="pt-4 border-t border-gray-50">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Navigation className="h-3.5 w-3.5" /> Selected Coordinates
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                                <p className="text-[8px] font-bold text-gray-400 uppercase">Latitude</p>
                                                <p className="text-xs font-black text-gray-700">{newZone.location.lat.toFixed(6)}</p>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                                <p className="text-[8px] font-bold text-gray-400 uppercase">Longitude</p>
                                                <p className="text-xs font-black text-gray-700">{newZone.location.lng.toFixed(6)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-sm shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-2 mt-4 active:scale-95"
                                    >
                                        <Save className="h-5 w-5" /> Deploy Zone
                                    </button>
                                </div>
                                <div className="h-[350px] md:h-full rounded-3xl overflow-hidden border border-gray-100 shadow-inner bg-gray-50 relative group">
                                    {isLoaded ? (
                                        <GoogleMap
                                            mapContainerStyle={containerStyle}
                                            center={newZone.location}
                                            zoom={13}
                                            onClick={onMapClick}
                                            options={{ disableDefaultUI: true, zoomControl: false }}
                                        >
                                            <MarkerF position={newZone.location} />
                                        </GoogleMap>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-4 px-4 pointer-events-none">
                                        <p className="bg-white/80 backdrop-blur px-3 py-2 rounded-xl text-[9px] font-black text-center text-gray-500 border border-white shadow-sm">
                                            Click on map to set hub location
                                        </p>
                                    </div>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminZones;
