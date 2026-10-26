import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import API from "@/lib/api";
import { getLanguage, LANGUAGE_EVENT } from "@/lib/language";

/**
 * Shows the app (customer, partner and Sewak) in the language picked.
 *
 * The screens are written in English. Rather than touch every page, this
 * translates the text that is on screen (through the server, which asks
 * Google once per phrase and remembers the answer) and keeps doing so as the
 * page changes. Nothing is changed for English.
 *
 * Text React later rewrites is noticed (it no longer matches what was put
 * there) and treated as new English. Changing language reloads the page,
 * which is the one way to be sure nothing is left in the old one.
 */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE", "SVG", "CANVAS", "IFRAME"]);
const SKIP_SELECTOR = "[data-no-translate],.notranslate,[translate='no'],.razorpay-container";
const CHUNK = 80;
const CACHE_PREFIX = "rozsewa_tx4_";
const CACHE_LIMIT = 3000;
// Already written in an Indian script: leave it alone.
const INDIAN_SCRIPT = /[ऀ-෿]/;

// Worth translating: has real words, is not a link or an email.
const translatable = (raw) => {
  const t = raw.trim();
  if (t.length < 2 || t.length > 300) return false;
  if (!/[A-Za-z]{2,}/.test(t)) return false;
  if (/^(https?:\/\/|www\.)/i.test(t) || /^\S+@\S+\.\S+$/.test(t)) return false;
  if (INDIAN_SCRIPT.test(t)) return false;
  return true;
};

// Older builds kept their phrases under other names; they are never read again.
const dropOldCaches = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => /^rozsewa_tx\d?_/.test(k) && !k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
};

const loadCache = (lang) => {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(CACHE_PREFIX + lang) || "{}")));
  } catch {
    return new Map();
  }
};
const saveCache = (lang, map) => {
  try {
    const entries = [...map.entries()].slice(-CACHE_LIMIT);
    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* full or blocked: it just means asking the server again */
  }
};

const AppTranslator = () => {
  const { pathname } = useLocation();
  // Everything except the admin and trainer panels, which stay in English.
  const translated = !/^\/(admin|trainer)/.test(pathname);

  useEffect(() => {
    if (!translated) return undefined;
    const lang = getLanguage();
    if (lang === "en") {
      // Nothing to translate; only listen for a language being chosen.
      const onPick = () => window.location.reload();
      window.addEventListener(LANGUAGE_EVENT, onPick);
      return () => window.removeEventListener(LANGUAGE_EVENT, onPick);
    }

    dropOldCaches();
    const cache = loadCache(lang);
    const seen = new WeakMap(); // text node -> { orig, shown }
    const attrSeen = new WeakMap(); // element -> { orig, shown } for placeholder
    let timer = null;
    let running = false;
    let again = false;
    let cancelled = false;

    const skipped = (el) => !el || SKIP_TAGS.has(el.tagName) || !!el.closest(SKIP_SELECTOR);

    // Everything on screen that still needs a translation.
    const collect = () => {
      const jobs = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (skipped(node.parentElement)) continue;
        let rec = seen.get(node);
        if (rec && node.data === rec.shown) continue; // ours, already done
        // New text, or React rewrote it: this is English again.
        if (!translatable(node.data)) { seen.delete(node); continue; }
        rec = { orig: node.data, shown: null };
        seen.set(node, rec);
        const n = node;
        const r = rec;
        jobs.push({
          orig: r.orig.trim(),
          lead: r.orig.match(/^\s*/)[0],
          trail: r.orig.match(/\s*$/)[0],
          apply: (t) => { r.shown = t; n.data = t; },
        });
      }
      document.querySelectorAll("[placeholder]").forEach((el) => {
        // The placeholder of an input is wanted even though its value is not.
        if (el.closest(SKIP_SELECTOR)) return;
        const cur = el.getAttribute("placeholder") || "";
        const prev = attrSeen.get(el);
        if (prev && cur === prev.shown) return;
        if (!translatable(cur)) return;
        const r = { orig: cur, shown: null };
        attrSeen.set(el, r);
        jobs.push({ orig: cur.trim(), lead: "", trail: "", apply: (t) => { r.shown = t; el.setAttribute("placeholder", t); } });
      });
      return jobs;
    };

    const run = async () => {
      if (running) { again = true; return; }
      running = true;
      try {
        do {
          again = false;
          const jobs = collect();
          if (!jobs.length) break;

          const need = [...new Set(jobs.filter((j) => !cache.has(j.orig)).map((j) => j.orig))];
          for (let i = 0; i < need.length && !cancelled; i += CHUNK) {
            const part = need.slice(i, i + CHUNK);
            try {
              // Plain axios, not API: the endpoint is public, and API signs the
              // user out on any 401 it sees.
              const { data } = await axios.post(`${API.defaults.baseURL}/translate`, { texts: part, target: lang });
              part.forEach((t, k) => cache.set(t, data.translations?.[k] || t));
            } catch {
              // Offline, signed out or the service is down: leave it in English.
              part.forEach((t) => cache.set(t, t));
            }
          }
          if (cancelled) break;
          saveCache(lang, cache);
          jobs.forEach((j) => { const t = cache.get(j.orig); if (t) j.apply(`${j.lead}${t}${j.trail}`); });
        } while (again && !cancelled);
      } finally {
        running = false;
      }
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 200);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder"] });
    // A different language chosen: reload so no old text is left behind.
    const onPick = () => window.location.reload();
    window.addEventListener(LANGUAGE_EVENT, onPick);
    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener(LANGUAGE_EVENT, onPick);
    };
  }, [translated]);

  return null;
};

export default AppTranslator;
