import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, LogOut, Building2, ClipboardCheck, CalendarDays } from "lucide-react";
import TrainingPanelBoard from "@/modules/trainer/components/TrainingPanelBoard";
import { STORAGE_KEY } from "@/modules/trainer/components/TrainerProtectedRoute";

const TrainerTrainingPanel = () => {
  const navigate = useNavigate();
  const [trainer, setTrainer] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setTrainer(JSON.parse(raw)?.trainer);
  }, []);

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    navigate("/trainer/login", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 pb-10">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2">
              <GraduationCap className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white">{trainer?.name || "Trainer"}</h1>
              <p className="flex items-center gap-1 text-[11px] text-slate-500">
                <Building2 className="h-3 w-3" /> {trainer?.trainingCenter?.name || "—"}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-500 hover:border-red-200"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5 space-y-5">
        <div className="flex gap-2">
          <Link
            to="/trainer/sessions"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            <CalendarDays className="h-4 w-4" /> My Sessions
          </Link>
          <span className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white">
            <ClipboardCheck className="h-4 w-4" /> Training Panel
          </span>
        </div>

        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Training Panel</h2>
          <p className="text-xs text-slate-500">
            Enter a Sewak Code to verify their starter kit and complete basic training.
          </p>
        </div>

        <TrainingPanelBoard />
      </div>
    </div>
  );
};

export default TrainerTrainingPanel;
