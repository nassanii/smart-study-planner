import requests
import json
from datetime import datetime, timedelta

URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"
USER_ID = 444
SUBJECT_ID = 1

# --- 40 Normal Tasks (1.0x) ---
tasks = [
    {"id": i, "subject_id": SUBJECT_ID, "subject": "History", "estimated": 60, "actual": 60, "status": "completed"}
    for i in range(40)
]

# --- 5 "Timer Accidents" (Outliers: 500 mins for 30 min estimate) ---
# These should be IGNORED because 500 > 30 * 3.0
outliers = [
    {"id": 100 + i, "subject_id": SUBJECT_ID, "subject": "History", "estimated": 30, "actual": 500, "status": "completed"}
    for i in range(5)
]

payload = {
    "user_id": USER_ID,
    "deadline": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
    "raw_history": {
        "recent_tasks": tasks + outliers,
        "behavioral_logs": {"snooze_count_today": 0, "last_focus_ratings": [5], "study_hours_today": 0.0}
    },
    "current_tasks_to_plan": [{"id": 1, "subject": "History", "priority": 1, "difficulty_rating": 5, "days_since_last_study": 1, "consecutive_days_studied": 0}],
    "available_slots": [{"start_time": "08:00", "end_time": "10:00"}],
}

print(f"--- Testing Outlier Robustness for User {USER_ID} (40 Normal + 5 Extreme Outliers) ---")
r = requests.post(URL, json=payload)
if r.status_code == 200:
    data = r.json()
    df = data['analysis_results']['difficulty_factors'].get(str(SUBJECT_ID))
    print(f" Difficulty Factor (History): {df}")
    
    # Check metrics for ignore count
    metrics_url = f"http://127.0.0.1:8000/api/v1/analytics/performance/{USER_ID}"
    rm = requests.get(metrics_url)
    if rm.status_code == 200:
        m = rm.json()['metrics'].get(f"subj_{SUBJECT_ID}")
        print(f" Total Completed Tasks: {m['sample_count']}")
        print(f" Ignored Outliers Count: {m['ignored_outliers']}")
        
        if df < 1.1 and m['ignored_outliers'] == 5:
            print("\nSUCCESS! The 5 extreme outliers were ignored, and the difficulty factor remains healthy (~1.0).")
        else:
            print("\nFAILURE: Outliers were likely included in training.")
else:
    print(f"Error: {r.text}")
