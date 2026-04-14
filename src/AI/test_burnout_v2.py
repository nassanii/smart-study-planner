import requests
import json
from datetime import datetime, timedelta

URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"

def test_burnout(name, hours, snooze, focus_ratings, user_id):
    payload = {
        "user_id": user_id,
        "deadline": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
        "raw_history": {
            "recent_tasks": [
                {"id": i, "subject_id": 1, "subject": "Math", "estimated": 60, "actual": 60, "status": "completed"}
                for i in range(45) # Trigger ML mode
            ],
            "behavioral_logs": {
                "snooze_count_today": snooze, 
                "last_focus_ratings": focus_ratings, 
                "study_hours_today": hours
            }
        },
        "current_tasks_to_plan": [{"id": 1, "subject": "Math", "priority": 1, "difficulty_rating": 5, "days_since_last_study": 1, "consecutive_days_studied": 0}],
        "available_slots": [{"start_time": "08:00", "end_time": "10:00"}],
    }
    
    r = requests.post(URL, json=payload)
    if r.status_code == 200:
        score = r.json()['analysis_results']['burnout_score']
        is_ex = r.json()['analysis_results']['is_exhausted']
        print(f"[{name}] Hours: {hours}, Snooze: {snooze}, Focus: {sum(focus_ratings)/len(focus_ratings) if focus_ratings else 4} -> Score: {score} (Exhausted: {is_ex})")
        return score
    else:
        print(f"Error: {r.text}")
    return None

if __name__ == "__main__":
    # Clean up old models for new test users
    import os
    import shutil
    for uid in [501, 502, 503]:
        path = f"ml_models/saved_models/user_{uid}"
        if os.path.exists(path):
            shutil.rmtree(path)

    print("--- Testing Burnout Model v2 (Focus Integrated) ---")
    
    # 1. High Engagement: Long hours but perfect focus
    test_burnout("HIGH ENGAGEMENT", 8.0, 0, [5, 5, 5], 501)
    
    # 2. Early Burnout: Short hours but terrible focus
    test_burnout("EARLY BURNOUT  ", 2.0, 0, [1, 1], 502)
    
    # 3. Severe Burnout: Long hours, high snooze, low focus
    test_burnout("SEVERE BURNOUT ", 10.0, 5, [2, 1], 503)
