import requests
import json
import os
import joblib
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"
MODELS_DIR = "ml_models/saved_models"

def make_request(user_id, task_count=45):
    tasks = [
        {"id": i, "subject_id": 1, "subject": "Math", "estimated": 60, "actual": 65, "status": "completed"}
        for i in range(task_count)
    ]
    payload = {
        "user_id": user_id,
        "deadline": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
        "raw_history": {
            "recent_tasks": tasks,
            "behavioral_logs": {"snooze_count_today": 0, "last_focus_ratings": [5], "study_hours_today": 0.0}
        },
        "current_tasks_to_plan": [{"id": 1, "subject": "Math", "priority": 1, "difficulty_rating": 5, "days_since_last_study": 1, "consecutive_days_studied": 0}],
        "available_slots": [{"start_time": "08:00", "end_time": "10:00"}],
    }
    try:
        r = requests.post(URL, json=payload, timeout=30)
        return user_id, r.status_code
    except Exception as e:
        return user_id, str(e)

def verify_integrity(user_id):
    path = os.path.join(MODELS_DIR, f"user_{user_id}", "subj_1_difficulty.joblib")
    metrics_path = os.path.join(MODELS_DIR, f"user_{user_id}", "metrics.json")
    
    results = {"user_id": user_id, "model_ok": False, "metrics_ok": False}
    
    if os.path.exists(path):
        try:
            joblib.load(path)
            results["model_ok"] = True
        except: pass
        
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r") as f:
                json.load(f)
            results["metrics_ok"] = True
        except: pass
        
    return results

if __name__ == "__main__":
    # --- SCENARIO A: 10 Unique Users (Load Balancing) ---
    print("--- SCENARIO A: Launching 10 simultaneous requests for unique users ---")
    unique_users = range(1001, 1011)
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(make_request, uid): uid for uid in unique_users}
        for future in as_completed(futures):
            uid, status = future.result()
            print(f" User {uid}: Status {status}")

    # --- SCENARIO B: 5 Requests for the SAME User (Race Condition Check) ---
    print("\n--- SCENARIO B: Launching 5 simultaneous requests for the SAME user (999) ---")
    same_user = [999] * 5
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(make_request, 999): i for i in range(5)}
        for future in as_completed(futures):
            uid, status = future.result()
            print(f" User 999 Request: Status {status}")

    # --- VERIFICATION ---
    print("\n--- FINAL INTEGRITY CHECK ---")
    all_test_users = list(unique_users) + [999]
    all_ok = True
    for uid in all_test_users:
        res = verify_integrity(uid)
        status_str = "OK" if res["model_ok"] and res["metrics_ok"] else "CORRUPTED/MISSING"
        if status_str != "OK": all_ok = False
        print(f" User {uid} Integrity: {status_str}")
    
    if all_ok:
        print("\nSUCCESS! Thread-locking mechanism protected all files correctly.")
    else:
        print("\nFAILURE: Some files are corrupted or missing.")
