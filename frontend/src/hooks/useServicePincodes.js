import { useEffect, useState } from "react";
import API from "@/lib/api";

/**
 * The PIN codes RozSewa serves, as listed by the admin on each service city.
 * `restricted` is false until at least one is listed, so nothing is blocked
 * before the list is set up. One request is shared by every screen.
 */
let pending = null;
const load = () => {
  if (!pending) {
    pending = API.get("/public/service-pincodes")
      .then(({ data }) => ({ restricted: !!data.restricted, pincodes: data.pincodes || [], cities: data.cities || [] }))
      .catch(() => { pending = null; return { restricted: false, pincodes: [], cities: [] }; });
  }
  return pending;
};

/** The message to show for a PIN code, or "" when it is fine (or still unknown). */
export const pincodeMessage = (info, pin, { required = false } = {}) => {
  if (!info?.restricted) return "";
  const p = String(pin || "").replace(/\D/g, "");
  if (!p) return required ? "Enter your PIN code." : "";
  if (p.length < 6) return required ? "Enter the 6-digit PIN code." : "";
  if (info.pincodes.includes(p)) return "";
  return `We do not serve PIN code ${p} yet.${info.cities.length ? ` Available in ${info.cities.join(", ")}.` : ""}`;
};

const useServicePincodes = () => {
  const [info, setInfo] = useState({ restricted: false, pincodes: [], cities: [] });
  useEffect(() => {
    let live = true;
    load().then((d) => { if (live) setInfo(d); });
    return () => { live = false; };
  }, []);
  return info;
};

export default useServicePincodes;
