import { Plus, Trash2 } from "lucide-react";

const DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

/**
 * Weekly availability windows, shared by the training-center and trainer forms.
 * Value shape: [{ day: 'mon', startTime: '10:00', endTime: '18:00' }]
 */
const AvailabilityEditor = ({ value = [], onChange, label = "Available Time" }) => {
  const rows = Array.isArray(value) ? value : [];

  const setRow = (idx, patch) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const addRow = () =>
    onChange([...rows, { day: "mon", startTime: "10:00", endTime: "18:00" }]);

  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));

  const applyToAllDays = () => {
    const base = rows[0] || { startTime: "10:00", endTime: "18:00" };
    onChange(
      DAYS.map((d) => ({
        day: d.id,
        startTime: base.startTime,
        endTime: base.endTime,
      }))
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <button
              type="button"
              onClick={applyToAllDays}
              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
            >
              Apply to all days
            </button>
          )}
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">
          No windows set — this center/trainer will never be allocated a session.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={row.day}
                onChange={(e) => setRow(idx, { day: e.target.value })}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
              >
                {DAYS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={row.startTime}
                onChange={(e) => setRow(idx, { startTime: e.target.value })}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="time"
                value={row.endTime}
                onChange={(e) => setRow(idx, { endTime: e.target.value })}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                aria-label="Remove window"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvailabilityEditor;
export { DAYS };
