import os
import re

file_path = r"d:\Rojsewa-main\frontend\src\modules\user\pages\LeadRequirementForm.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update time field
time_field_old = """    case 'time':
      return <input type="time" className={base} value={value || ''} onChange={e => onChange(e.target.value)} />;"""

time_field_new = """    case 'time':
      const handleTimeChange = (e) => {
        const val = e.target.value;
        if (preferredDate) {
          const today = new Date();
          const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
          if (preferredDate === todayStr && val) {
            const currentHour = today.getHours();
            const currentMin = today.getMinutes();
            const [h, m] = val.split(':').map(Number);
            if (h < currentHour || (h === currentHour && m < currentMin)) {
              toast({ title: "Invalid Time", description: "Cannot select a past time for today.", variant: "destructive" });
              onChange('');
              return;
            }
          }
        }
        onChange(val);
      };
      return <input type="time" className={base} value={value || ''} onChange={handleTimeChange} />;"""

content = content.replace(time_field_old, time_field_new)

# 2. Update datetime field
datetime_old = """    case 'datetime':
      return <input type="datetime-local" className={base} value={value || ''} onChange={e => onChange(e.target.value)} />;"""

datetime_new = """    case 'datetime':
      return <input type="datetime-local" className={base} value={value || ''} onChange={e => onChange(e.target.value)} min={new Date().toISOString().slice(0, 16)} />;"""

content = content.replace(datetime_old, datetime_new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated LeadRequirementForm.jsx time fields")
