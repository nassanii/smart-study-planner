import requests
import json
from datetime import datetime, timedelta

URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"

# ============================================================================
# TEST 1: Cold Start Path (< 10 completed tasks)
# ============================================================================
deadline_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")

cold_start_payload = {
    "user_id": 101,
    "deadline": deadline_date,
    "raw_history": {
        "recent_tasks": [
            {"subject_id": 1, "estimated": 50, "actual": 75, "status": "completed"},
            {"subject_id": 2, "estimated": 40, "actual": 35, "status": "completed"},
        ],
        "behavioral_logs": {
            "snooze_count_today": 0,
            "last_focus_ratings": [5, 5, 5],
            "study_hours_today": 0.0,
        },
    },
    "current_tasks_to_plan": [
        {
            "id": 1, "subject": "Mathematics", "priority": 1,
            "difficulty_rating": 9, "days_since_last_study": 0,
            "consecutive_days_studied": 0,
        },
        {
            "id": 2, "subject": "Physics", "priority": 2,
            "difficulty_rating": 8, "days_since_last_study": 1,
            "consecutive_days_studied": 0,
        },
        {
            "id": 3, "subject": "History", "priority": 3,
            "difficulty_rating": 4, "days_since_last_study": 0,
            "consecutive_days_studied": 0,
        },
    ],
    "available_slots": [
        {"start_time": "08:00", "end_time": "12:00"},
    ],
}

print("=" * 60)
print(f" TEST 1 — Cold Start Path (Deadline: {deadline_date})")
print("=" * 60)
response = requests.post(URL, json=cold_start_payload)
print(f"Status Code: {response.status_code}")
if response.status_code == 200:
    print(json.dumps(response.json(), indent=2))
else:
    print(response.text)

# ============================================================================
# TEST 2: ML Path (>= 40 completed tasks per subject)
# ============================================================================
# Generate 45 completed tasks for subject 1 (Mathematics)
ml_recent_tasks = [
    {"subject_id": 1, "estimated": 50, "actual": 65 + (i % 5), "status": "completed"}
    for i in range(45)
]
# Add a few for subject 2 (Physics) — below threshold, so cold start
ml_recent_tasks += [
    {"subject_id": 2, "estimated": 40, "actual": 35, "status": "completed"},
    {"subject_id": 2, "estimated": 45, "actual": 50, "status": "completed"},
]

ml_payload = {
    "user_id": 202,
    "deadline": deadline_date,
    "raw_history": {
        "recent_tasks": ml_recent_tasks,
        "behavioral_logs": {
            "snooze_count_today": 3,
            "last_focus_ratings": [3, 2, 2],
            "study_hours_today": 5.0,
        },
    },
    "current_tasks_to_plan": [
        {
            "id": 1, "subject": "Mathematics", "priority": 1,
            "difficulty_rating": 9, "days_since_last_study": 0,
            "consecutive_days_studied": 2,
        },
        {
            "id": 2, "subject": "Physics", "priority": 2,
            "difficulty_rating": 7, "days_since_last_study": 4,
            "consecutive_days_studied": 0,
        },
    ],
    "available_slots": [
        {"start_time": "14:00", "end_time": "18:00"},
    ],
}

print("\n" + "=" * 60)
print(f" TEST 2 — ML Path (>= 40 tasks for Math, < 40 for Physics)")
print("=" * 60)
response = requests.post(URL, json=ml_payload)
print(f"Status Code: {response.status_code}")
if response.status_code == 200:
    print(json.dumps(response.json(), indent=2))
else:
    print(response.text)