import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Save, ToggleLeft, ToggleRight, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { useEffect } from "react";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timeSlots = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

const getDefault = () => days.reduce((acc, d) => ({
  ...acc, [d]: { enabled: d !== "Sunday", start: "09:00", end: "18:00" }
}), {});

const ProviderAvailability = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState(() => getDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      const { data } = await API.get("/provider/profile");
      if (data.availability && data.availability.length > 0) {
        const newSchedule = { ...getDefault() };
        data.availability.forEach(item => {
          newSchedule[item.day] = { enabled: item.isActive, start: item.startTime, end: item.endTime };
        });
        setSchedule(newSchedule);
      }
    } catch (err) {
      console.error("Failed to fetch availability:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day) => {
    setSchedule(s => ({ ...s, [day]: { ...s[day], enabled: !s[day].enabled } }));
  };

  const updateTime = (day, field, value) => {
    setSchedule(s => ({ ...s, [day]: { ...s[day], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const availabilityArray = Object.keys(schedule).map(day => ({
        day,
        startTime: schedule[day].start,
        endTime: schedule[day].end,
        isActive: schedule[day].enabled
      }));

      await API.put("/provider/profile", { availability: availabilityArray });
      toast({ title: "Schedule Saved ✓", description: "Your availability has been updated." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save schedule.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Availability</h1>
            <p className="text-xs text-muted-foreground">Set your working hours</p>
          </div>
        </div>

        {/* Weekly Schedule */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Weekly Schedule</h3>
          {days.map((day, i) => (
            <motion.div key={day} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border bg-card p-4 transition-all ${schedule[day].enabled ? "border-border" : "border-border/50 opacity-60"}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-bold text-foreground">{day}</span>
                <button 
                  onClick={() => toggleDay(day)} 
                  className="p-3 -mr-3 rounded-full hover:bg-muted transition-colors select-none"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {schedule[day].enabled ? (
                    <ToggleRight className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-500 drop-shadow-sm" />
                  ) : (
                    <ToggleLeft className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40" />
                  )}
                </button>
              </div>
              {schedule[day].enabled && (
                <div className="flex items-center gap-2">
                  <select value={schedule[day].start} onChange={e => updateTime(day, "start", e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background py-2 px-3 text-xs font-medium focus:border-primary focus:outline-none">
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-xs text-muted-foreground font-bold">to</span>
                  <select value={schedule[day].end} onChange={e => updateTime(day, "end", e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background py-2 px-3 text-xs font-medium focus:border-primary focus:outline-none">
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              {!schedule[day].enabled && <p className="text-xs text-muted-foreground">Day Off</p>}
            </motion.div>
          ))}
          </div>
        )}

         {/* Holidays Hidden for now as it needs separate model or field */}


        <motion.button 
          whileTap={{ scale: 0.97 }} 
          onClick={handleSave}
          disabled={saving}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-extrabold text-primary-foreground shadow-xl shadow-primary/20 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {saving ? (
             <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <><Save className="h-4 w-4" /> Save Schedule</>
          )}
        </motion.button>
      </main>
      <BottomNav />
    </div>
  );
};

export default ProviderAvailability;
