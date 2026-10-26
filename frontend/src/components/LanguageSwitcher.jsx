import { useEffect, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { LANGUAGES, getLanguage, setLanguage } from "@/lib/language";

/** Language button for the partner / Sewak top bar. */
const LanguageSwitcher = ({ className = "" }) => {
  const [open, setOpen] = useState(false);
  const [current] = useState(getLanguage);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const choose = (code) => {
    setOpen(false);
    if (code !== current) setLanguage(code);
  };

  return (
    <div className="relative" ref={ref} data-no-translate>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Language"
        aria-label="Change language"
        aria-expanded={open}
        className={className}
      >
        <Languages className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl" role="menu">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitem"
              onClick={() => choose(l.code)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted ${current === l.code ? "text-primary" : "text-foreground"}`}
            >
              <span>{l.native}{l.code !== "en" && <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">{l.label}</span>}</span>
              {current === l.code && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
