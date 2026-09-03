import re
import json

md_file = "TNN_Marketing_Schedule_Balanced.md"

schedule = []
users = set()

days = ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
current_day = None

with open(md_file, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith("## ") and line[3:] in days:
            current_day = line[3:]
            continue
        
        if line.startswith("---") or line.startswith("## Volunteer load summary"):
            if current_day == "Saturday":
                break

        if current_day and line.startswith("|") and not line.startswith("| Time Slot") and not line.startswith("|---") and not line.startswith("| Member"):
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 3:
                time_slot = parts[0]
                # Remove star and get lead
                lead = parts[1].replace("★", "").strip()
                # Get support, might have multiple, separated by comma, ignore warnings
                support_raw = parts[2].replace("⚠ *— none (solo slot, no backup)*", "").strip()
                supports = [s.strip() for s in support_raw.split(",") if s.strip()]
                
                users.add(lead)
                for s in supports:
                    users.add(s)
                
                schedule.append({
                    "day": current_day,
                    "time": time_slot,
                    "lead": lead,
                    "support": supports
                })

users_dict = {user: "" for user in sorted(users)}

with open("schedule.json", "w", encoding='utf-8') as f:
    json.dump(schedule, f, indent=2)

with open("users.json", "w", encoding='utf-8') as f:
    json.dump(users_dict, f, indent=2)

print("Parsed successfully!")
