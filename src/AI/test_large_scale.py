import requests
import json
import numpy as np
from datetime import datetime, timedelta

URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"
USER_ID = 888

def generate_subject_data(subject_id, subject_name, count, bias, noise_level):
    """
    bias: multiplier (e.g. 1.15 = 15% slower)
    noise_level: std dev of random noise
    """
    tasks = []
    for i in range(count):
        est = float(np.random.choice([30, 45, 60, 90, 120]))
        noise = float(np.random.normal(0, noise_level))
        actual = est * bias + noise
        
        # Add some random outliers to make it realistic
        if i % 15 == 0: actual += 30 # Occasional delay
        
        tasks.append({
            "id": subject_id * 1000 + i,
            "subject_id": subject_id,
            "subject": subject_name,
            "estimated": est,
            "actual": round(max(5, actual), 1),
            "status": "completed"
        })
    return tasks

# --- 1. Generate Data for 3 subjects ---
np.random.seed(888)
all_recent_tasks = []
all_recent_tasks += generate_subject_data(1, "Mathematics", 40, 1.15, 5)   # 40 tasks, 15% slow, low noise
all_recent_tasks += generate_subject_data(2, "Programming", 60, 0.80, 15)  # 60 tasks, 20% fast, high noise
all_recent_tasks += generate_subject_data(3, "History", 100, 1.05, 2)      # 100 tasks, 5% slow, very low noise

# --- 2. Build Payload ---
payload = {
    "user_id": USER_ID,
    "deadline": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
    "raw_history": {
        "recent_tasks": all_recent_tasks,
        "behavioral_logs": {
            "snooze_count_today": 0,
            "last_focus_ratings": [5, 5],
            "study_hours_today": 0.0,
        },
    },
    "current_tasks_to_plan": [
        {"id": 1, "subject": "Math", "priority": 1, "difficulty_rating": 8, "days_since_last_study": 1, "consecutive_days_studied": 0},
        {"id": 2, "subject": "Prog", "priority": 2, "difficulty_rating": 9, "days_since_last_study": 1, "consecutive_days_studied": 0},
        {"id": 3, "subject": "Hist", "priority": 3, "difficulty_rating": 4, "days_since_last_study": 1, "consecutive_days_studied": 0}
    ],
    "available_slots": [{"start_time": "08:00", "end_time": "14:00"}],
}

# --- 3. Trigger Training ---
print(f"--- Sending Large-Scale Data (200 total tasks) for User {USER_ID} ---")
response = requests.post(URL, json=payload)

if response.status_code == 200:
    results = response.json()
    print(f"Training SUCCESS. Mode: {results['analysis_results']['mode']}")
    print("Difficulty Factors Applied for Next Schedule:")
    print(json.dumps(results['analysis_results']['difficulty_factors'], indent=2))
    
    # --- 4. Fetch Deep Metrics ---
    print("\n--- Final Performance Metrics Breakdown ---")
    r_metrics = requests.get(f"http://127.0.0.1:8000/api/v1/analytics/performance/{USER_ID}")
    metrics = r_metrics.json().get("metrics", {})
    
    for key, val in metrics.items():
        if key.startswith("subj_"):
            print(f"\nSubject {key}:")
            print(f" - Sample Count: {val['sample_count']}")
            print(f" - MAE (Error): {val['mae_minutes']} min")
            print(f" - R2 Score: {val['r2_score']}")
            print(f" - Top Error: {val['top_errors'][0]['abs_error']} min (Task {val['top_errors'][0]['task_id']})")
else:
    print(response.text)
