import { useEffect, useRef, useState } from "react";
import { GoogleMap, MarkerF, Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { Crosshair, Home, Briefcase, MapPin, Loader2, Check } from "lucide-react";
import API from "@/lib/api";

// Same loader options as everywhere else in the app, so the one script tag is shared.
const libraries = ["places"];
const mapStyle = { width: "100%", height: "180px", borderRadius: "14px" };

export const EMPTY_PLACE = {
  lat: null,
  lng: null,
  details: { house: "", building: "", landmark: "", area: "", city: "", state: "", pincode: "" },
  contactName: "",
  contactMobile: "",
  source: "",
  confirmed: false,
};

/** One line, in the order a worker reads an address. */
export const formatAddress = (d = {}) =>
  [d.house, d.building, d.landmark && `Near ${d.landmark}`, d.area, d.city, d.state, d.pincode]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(", ");

/** Pulls city/state/PIN/area out of a Google geocoder result. */
const fromGeocoder = (result) => {
  const get = (...types) =>
    result?.address_components?.find((c) => types.some((t) => c.types.includes(t)))?.long_name || "";
  return {
    area: get("sublocality_level_1", "sublocality", "neighborhood"),
    city: get("locality", "administrative_area_level_3", "administrative_area_level_2"),
    state: get("administrative_area_level_1"),
    pincode: get("postal_code"),
    building: get("route", "premise"),
  };
};

const iconFor = (icon) => (icon === "work" || icon === "office" ? Briefcase : icon === "home" ? Home : MapPin);

/**
 * Where the worker should come (spec §6): current location, a saved address,
 * or a new one placed with a map pin. Nothing books until the customer has
 * confirmed the location.
 */
const InstaLocationPicker = ({ value, onChange, user }) => {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });
  const [saved, setSaved] = useState([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [saveAs, setSaveAs] = useState("");
  const [saving, setSaving] = useState(false);
  const autoRef = useRef(null);

  const v = value || EMPTY_PLACE;
  const set = (patch) => onChange({ ...v, confirmed: false, ...patch });
  const setDetail = (k, val) => set({ details: { ...v.details, [k]: val } });

  useEffect(() => {
    API.get("/auth/profile")
      .then(({ data }) => setSaved((data.addresses || []).filter((a) => a.location?.coordinates?.length === 2)))
      .catch(() => {});
  }, []);

  // Contact person defaults to the signed-in customer.
  useEffect(() => {
    if (!v.contactName && !v.contactMobile && user) {
      onChange({ ...v, contactName: user.name || "", contactMobile: (user.mobile || "").replace(/\D/g, "").slice(-10) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const reverseGeocode = (lat, lng, extra = {}) => {
    if (!isLoaded || !window.google?.maps?.Geocoder) {
      set({ lat, lng, ...extra });
      return;
    }
    new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      const parsed = status === "OK" && results?.[0] ? fromGeocoder(results[0]) : {};
      onChange({
        ...v,
        lat,
        lng,
        confirmed: false,
        ...extra,
        details: { ...v.details, ...Object.fromEntries(Object.entries(parsed).filter(([, x]) => x)) },
      });
    });
  };

  const useCurrent = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Location is not available on this device. Search for your address instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        reverseGeocode(pos.coords.latitude, pos.coords.longitude, { source: "current" });
      },
      () => {
        setLocating(false);
        setError("Could not get your location. Allow location access, or search for your address.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const pickSaved = (a) => {
    const [lng, lat] = a.location.coordinates;
    onChange({
      ...v,
      lat,
      lng,
      source: `saved:${a._id}`,
      confirmed: false,
      details: { ...EMPTY_PLACE.details, house: a.address },
    });
  };

  const onPlace = () => {
    const place = autoRef.current?.getPlace();
    const loc = place?.geometry?.location;
    if (!loc) return;
    const parsed = fromGeocoder(place);
    onChange({
      ...v,
      lat: loc.lat(),
      lng: loc.lng(),
      source: "search",
      confirmed: false,
      details: { ...v.details, ...Object.fromEntries(Object.entries(parsed).filter(([, x]) => x)) },
    });
  };

  const saveAddress = async () => {
    if (!saveAs || v.lat === null) return;
    setSaving(true);
    try {
      const icon = saveAs === "Home" ? "home" : saveAs === "Office" ? "work" : "other";
      const { data } = await API.post("/auth/addresses", {
        label: saveAs,
        address: formatAddress(v.details),
        icon,
        location: { type: "Point", coordinates: [v.lng, v.lat] },
      });
      setSaved((data || []).filter((a) => a.location?.coordinates?.length === 2));
      setSaveAs("");
    } catch {
      setError("Could not save this address.");
    } finally {
      setSaving(false);
    }
  };

  const hasPin = v.lat !== null && v.lng !== null;
  const canConfirm = hasPin && formatAddress(v.details).length > 3 && (v.details.house || "").trim()
    && /^\d{10}$/.test((v.contactMobile || "").replace(/\D/g, "")) && (v.contactName || "").trim();
  const field = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-amber-500";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={useCurrent}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black ${v.source === "current" ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30" : "border-border"}`}
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          Use current location
        </button>
        {saved.map((a) => {
          const Icon = iconFor(a.icon);
          return (
            <button
              type="button"
              key={a._id}
              onClick={() => pickSaved(a)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black ${v.source === `saved:${a._id}` ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30" : "border-border"}`}
            >
              <Icon className="h-3.5 w-3.5" /> {a.label}
            </button>
          );
        })}
      </div>

      {isLoaded && (
        <Autocomplete onLoad={(a) => { autoRef.current = a; }} onPlaceChanged={onPlace} options={{ componentRestrictions: { country: "in" } }}>
          <input placeholder="Search a new address or area" className={field} />
        </Autocomplete>
      )}

      {isLoaded && hasPin && (
        <div>
          <GoogleMap mapContainerStyle={mapStyle} center={{ lat: v.lat, lng: v.lng }} zoom={16} options={{ disableDefaultUI: true, zoomControl: true }}
            onClick={(e) => reverseGeocode(e.latLng.lat(), e.latLng.lng(), { source: "pin" })}>
            <MarkerF position={{ lat: v.lat, lng: v.lng }} draggable onDragEnd={(e) => reverseGeocode(e.latLng.lat(), e.latLng.lng(), { source: "pin" })} />
          </GoogleMap>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">Drag the pin to the exact door the worker should come to.</p>
        </div>
      )}
      {!isLoaded && hasPin && (
        <p className="text-[11px] font-semibold text-muted-foreground">Location set ({v.lat.toFixed(5)}, {v.lng.toFixed(5)})</p>
      )}

      {hasPin && (
        <div className="grid grid-cols-2 gap-2">
          <input className={`${field} col-span-2`} placeholder="House / Flat No. *" value={v.details.house} onChange={(e) => setDetail("house", e.target.value)} />
          <input className={`${field} col-span-2`} placeholder="Building / Street" value={v.details.building} onChange={(e) => setDetail("building", e.target.value)} />
          <input className={field} placeholder="Landmark" value={v.details.landmark} onChange={(e) => setDetail("landmark", e.target.value)} />
          <input className={field} placeholder="Area / Locality" value={v.details.area} onChange={(e) => setDetail("area", e.target.value)} />
          <input className={field} placeholder="City" value={v.details.city} onChange={(e) => setDetail("city", e.target.value)} />
          <input className={field} placeholder="State" value={v.details.state} onChange={(e) => setDetail("state", e.target.value)} />
          <input className={field} placeholder="PIN Code" inputMode="numeric" maxLength={6} value={v.details.pincode} onChange={(e) => setDetail("pincode", e.target.value.replace(/\D/g, ""))} />
          <div />
          <input className={field} placeholder="Contact person *" value={v.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          <input className={field} placeholder="Contact mobile *" inputMode="numeric" maxLength={10} value={v.contactMobile} onChange={(e) => set({ contactMobile: e.target.value.replace(/\D/g, "") })} />
        </div>
      )}

      {hasPin && v.source !== "" && !String(v.source).startsWith("saved:") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-muted-foreground">Save as:</span>
          {["Home", "Office", "Other"].map((l) => (
            <button type="button" key={l} onClick={() => setSaveAs(l)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-black ${saveAs === l ? "border-amber-500 text-amber-700" : "border-border"}`}>{l}</button>
          ))}
          {saveAs && (
            <button type="button" onClick={saveAddress} disabled={saving} className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-black disabled:opacity-50">
              {saving ? "Saving…" : `Save ${saveAs}`}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}

      {hasPin && (
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onChange({ ...v, confirmed: true })}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 ${v.confirmed ? "bg-emerald-500 text-white" : "bg-slate-900 text-white dark:bg-white dark:text-slate-900"}`}
        >
          {v.confirmed ? <><Check className="h-4 w-4" /> Location confirmed</> : "Confirm this location"}
        </button>
      )}
      {!hasPin && (
        <p className="text-[11px] font-medium text-muted-foreground">Use your current location, pick a saved address, or search for a new one.</p>
      )}
    </div>
  );
};

export default InstaLocationPicker;
