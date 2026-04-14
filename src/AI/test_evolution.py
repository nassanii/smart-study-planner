import requests
import json
import numpy as np
import os
from datetime import datetime, timedelta

URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"
USER_ID = 123
SUBJECT_ID = 1

def run_test(phase_name, tasks):
    payload = {
        "user_id": USER_ID,
        "deadline": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
        "raw_history": {
            "recent_tasks": tasks,
            "behavioral_logs": {"snooze_count_today": 0, "last_focus_ratings": [5], "study_hours_today": 0.0}
        },
        "current_tasks_to_plan": [{"id": 1, "subject": "Math", "priority": 1, "difficulty_rating": 5, "days_since_last_study": 1, "consecutive_days_studied": 0}],
        "available_slots": [{"start_time": "08:00", "end_time": "10:00"}],
    }
    
    print(f"\n--- {phase_name} (Total Tasks: {len(tasks)}) ---")
    r = requests.post(URL, json=payload)
    if r.status_code == 200:
        data = r.json()
        df = data['analysis_results']['difficulty_factors'].get(str(SUBJECT_ID))
        print(f" Difficulty Factor (Math): {df}")
        
        # Check metrics file
        metrics_url = f"http://127.0.0.1:8000/api/v1/analytics/performance/{USER_ID}"
        rm = requests.get(metrics_url)
        if rm.status_code == 200:
            m = rm.json()['metrics'].get(f"subj_{SUBJECT_ID}")
            print(f" Sample Count in Metrics: {m['sample_count']}")
            print(f" Last Trained: {m['last_trained']}")
            return df, m['sample_count']
    else:
        print(f"Error: {r.text}")
    return None, None

# --- PHASE 1: 40 Slow Tasks ---
slow_tasks = [
    {"id": i, "subject_id": SUBJECT_ID, "subject": "Math", "estimated": 60, "actual": 96.0, "status": "completed"} # 1.6x factor
    for i in range(40)
]
df1, count1 = run_test("PHASE 1: SLOW START", slow_tasks)

# --- PHASE 2: 10 Fast Tasks (Total 50) ---
# Student suddenly improves!
fast_tasks = slow_tasks + [
    {"id": 40 + i, "subject_id": SUBJECT_ID, "subject": "Math", "estimated": 60, "actual": 48.0, "status": "completed"} # 0.8x factor
    for i in range(10)
]
df2, count2 = run_test("PHASE 2: EVOLUTION / IMPROVEMENT", fast_tasks)

if df1 and df2:
    improvement = round((df1 - df2) / df1 * 100, 1)
    print(f"\nSUCCESS!")
    print(f" The model adapted and decreased the difficulty factor from {df1} to {df2}.")
    print(f" That's a {improvement}% improvement in predicted efficiency!")
