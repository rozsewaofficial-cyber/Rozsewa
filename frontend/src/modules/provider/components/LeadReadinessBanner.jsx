import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import API from "@/lib/api";
import { useSocket } from "@/context/SocketContext";

/**
 * Says why new leads are not reaching this partner, with a tap to fix it.
 *
 * The server drops a partner from lead targeting without a word when they are
 * offline, have no saved location, or are short of wallet balance, so a
 * partner who simply "never gets requests" had nothing to go on. Shows nothing
 * when all is well, and nothing for a partner whose category is not lead-based.
 */
const NOT_A_PROBLEM = new Set(["sewak", "not_lead_category"]);

const LeadReadinessBanner = () => {
  const [problems, setProblems] = useState([]);
  const socketCtx = useSocket();
  const socket = socketCtx?.socket;

  useEffect(() => {
    let live = true;
    const load = () =>
      API.get("/leads/readiness")
        .then(({ data }) => {
          if (!live) return;
          const list = data?.problems || [];
          // A category that does not use leads has nothing to fix here.
          setProblems(list.some((p) => NOT_A_PROBLEM.has(p.code)) ? [] : list);
        })
        .catch(() => {});
    load();
    // Back from the wallet or profile, or the partner went online.
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    socket?.on("WALLET_UPDATED", load);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
      socket?.off("WALLET_UPDATED", load);
    };
  }, [socket]);

  if (problems.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20" data-lead-readiness>
      <p className="flex items-center gap-2 text-sm font-black text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" /> You may not be getting new leads
      </p>
      <ul className="mt-2 space-y-1.5">
        {problems.map((p) => (
          <li key={p.code} className="text-xs font-medium leading-snug text-amber-900 dark:text-amber-200" data-readiness={p.code}>
            {p.link ? (
              <Link to={p.link} className="flex items-start justify-between gap-2">
                <span>{p.message}</span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
              </Link>
            ) : p.message}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default LeadReadinessBanner;
