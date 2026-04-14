import requests
import json
import numpy as np
from datetime import datetime, timedelta

URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"
USER_ID = 777
SUBJECT_ID = 1

# --- 1. Generate Realistic Data (45 tasks) ---
# Student usually takes 15% longer than estimated, with some random noise.
np.random.seed(42)
recent_tasks = []
for i in range(45):
    est = float(np.random.choice([30, 45, 60, 90]))
    noise = float(np.random.normal(0, 5))
    actual = est * 1.15 + noise
    
    # Inject 3 specific outliers for Error Tracking
    if i == 10: actual = est * 2.0  # Double time
    if i == 25: actual = est * 0.5  # Half time
    if i == 40: actual = est + 40   # 40 mins late
    
    recent_tasks.append({
        "id": 1000 + i,
        "subject_id": SUBJECT_ID,
        "subject": "Computer Science",
        "estimated": est,
        "actual": round(actual, 1),
        "status": "completed"
    })

# --- 2. Build Payload ---
payload = {
    "user_id": USER_ID,
    "deadline": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
    "raw_history": {
        "recent_tasks": recent_tasks,
        "behavioral_logs": {
            "snooze_count_today": 1,
            "last_focus_ratings": [4, 5, 4],
            "study_hours_today": 2.0,
        },
    },
    "current_tasks_to_plan": [
        {
            "id": 1, "subject": "Computer Science", "priority": 1,
            "difficulty_rating": 8, "days_since_last_study": 1,
            "consecutive_days_studied": 0,
        }
    ],
    "available_slots": [
        {"start_time": "09:00", "end_time": "12:00"},
    ],
}

# --- 3. Trigger Training via API ---
print(f"--- Sending 45 real-life tasks for User {USER_ID} ---")
response = requests.post(URL, json=payload)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    results = response.json()
    print(f"Mode: {results['analysis_results']['mode']}")
    print(f"Difficulty Factor for CS: {results['analysis_results']['difficulty_factors'].get(str(SUBJECT_ID))}")

    # --- 4. Call Analytics Endpoint ---
    print("\n--- Fetching Metrics ---")
    r_metrics = requests.get(f"http://127.0.0.1:8000/api/v1/analytics/performance/{USER_ID}")
    print(json.dumps(r_metrics.json(), indent=2))
else:
    print(response.text)
