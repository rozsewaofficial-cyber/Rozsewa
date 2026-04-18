import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Loader2, Navigation, MapPin, X, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

const containerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '24px'
};

const LiveTrackingView = ({ destination, onClose }) => {
    const [currentPos, setCurrentPos] = useState(null);
    const [directions, setDirections] = useState(null);
    const [error, setError] = useState(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    });

    const [map, setMap] = useState(null);

    const onLoad = useCallback(function callback(map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map) {
        setMap(null);
    }, []);

    useEffect(() => {
        let watchId;
        if ("geolocation" in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    setCurrentPos({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                },
                (err) => setError("Location access denied"),
                { enableHighAccuracy: true }
            );
        }
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    useEffect(() => {
        if (isLoaded && currentPos && destination) {
            const directionsService = new window.google.maps.DirectionsService();
            directionsService.route(
                {
                    origin: currentPos,
                    destination: { lat: destination[1], lng: destination[0] },
                    travelMode: window.google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === window.google.maps.DirectionsStatus.OK) {
                        setDirections(result);
                    } else {
                        console.error(`error fetching directions ${result}`);
                    }
                }
            );
        }
    }, [isLoaded, currentPos, destination]);

    if (!isLoaded) return <div className="h-[400px] flex items-center justify-center bg-muted rounded-3xl"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative w-full max-w-2xl bg-card rounded-[32px] overflow-hidden border border-border shadow-2xl"
            >
                <div className="p-4 flex items-center justify-between border-b bg-card">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Navigation className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-foreground">Live Route Tracking</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">On the Way to Customer</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="relative">
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={currentPos || { lat: destination[1], lng: destination[0] }}
                        zoom={14}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                        options={{
                            disableDefaultUI: true,
                            styles: [
                                {
                                    "featureType": "all",
                                    "elementType": "labels.text.fill",
                                    "stylers": [{ "color": "#7c93a3" }]
                                },
                                {
                                    "featureType": "water",
                                    "elementType": "geometry",
                                    "stylers": [{ "color": "#c8d7d4" }]
                                }
                            ]
                        }}
                    >
                        {directions && <DirectionsRenderer directions={directions} options={{
                            polylineOptions: { strokeColor: '#10b981', strokeWeight: 6 },
                            suppressMarkers: false
                        }} />}

                        {currentPos && (
                            <Marker
                                position={currentPos}
                                icon={{
                                    url: "https://maps.google.com/mapfiles/kml/shapes/cabs.png",
                                    scaledSize: new window.google.maps.Size(32, 32)
                                }}
                            />
                        )}

                        <Marker
                            position={{ lat: destination[1], lng: destination[0] }}
                            icon={{
                                url: "https://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png",
                                scaledSize: new window.google.maps.Size(32, 32)
                            }}
                        />
                    </GoogleMap>

                    <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                        <button
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination[1]},${destination[0]}`, "_blank")}
                            className="flex-1 bg-white text-slate-900 border border-slate-200 py-3 rounded-2xl text-xs font-black shadow-lg flex items-center justify-center gap-2"
                        >
                            <ExternalLink className="h-4 w-4" /> Open External Maps
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Distance</p>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{directions?.routes[0]?.legs[0]?.distance?.text || '-- km'}</p>
                    </div>
                    <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-1 text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arrival In</p>
                        <p className="text-sm font-black text-emerald-600">{directions?.routes[0]?.legs[0]?.duration?.text || '-- mins'}</p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LiveTrackingView;
