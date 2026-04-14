import requests
import json
from datetime import datetime, timedelta

URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"
USER_ID = 888

# Subject 1 (Math) had 40 tasks. We send 50 now to trigger retrain.
tasks = [
    {"id": 1000 + i, "subject_id": 1, "subject": "Mathematics", "estimated": 60, "actual": 70, "status": "completed"}
    for i in range(50)
]

payload = {
    "user_id": USER_ID,
    "deadline": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
    "raw_history": {
        "recent_tasks": tasks,
        "behavioral_logs": {"snooze_count_today": 0, "last_focus_ratings": [5], "study_hours_today": 0.0}
    },
    "current_tasks_to_plan": [{"id": 1, "subject": "Math", "priority": 1, "difficulty_rating": 8, "days_since_last_study": 1, "consecutive_days_studied": 0}],
    "available_slots": [{"start_time": "08:00", "end_time": "10:00"}],
}

print(f"--- Triggering Retrain for User {USER_ID} (Subject 1: 50 tasks) ---")
r = requests.post(URL, json=payload)
if r.status_code == 200:
    print("SUCCESS: Model retrained.")
else:
    print(f"Error: {r.text}")
