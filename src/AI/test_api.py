import requests
import json
from datetime import datetime, timedelta

URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"

# Test Scenario: AI-Autonomous Estimation
# No 'estimated_min' provided. AI must decide durations based on rating & deadline.
deadline_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d") # Close deadline!

dummy_data_autonomous = {
  "user_id": "student_101",
  "deadline": deadline_date,
  "raw_history": {
    "recent_tasks": [
      {"subject": "Mathematics", "estimated": 50, "actual": 75, "status": "completed"} # Proving we take longer
    ],
    "behavioral_logs": {
      "snooze_count_today": 0,
      "last_focus_ratings": [5, 5, 5],
      "study_hours_today": 0.0
    }
  },
  "current_tasks_to_plan": [
    {
        "id": 1, "subject": "Mathematics", "priority": 1, "difficulty_rating": 9,
        "days_since_last_study": 0, "consecutive_days_studied": 0 
    },
    {
        "id": 2, "subject": "Physics", "priority": 2, "difficulty_rating": 8,
        "days_since_last_study": 1, "consecutive_days_studied": 0
    },
    {
        "id": 3, "subject": "History", "priority": 3, "difficulty_rating": 4,
        "days_since_last_study": 0, "consecutive_days_studied": 0
    }
  ],
  "available_slots": [
    {"start_time": "08:00", "end_time": "12:00"} 
  ]
}

print(f" Sending Data to test AI-Autonomous Estimation (Deadline: {deadline_date})...")
response = requests.post(URL, json=dummy_data_autonomous)

print(f"Status Code: {response.status_code}")
print("Response from AI (Autonomous Strategy):")
if response.status_code == 200:
    print(json.dumps(response.json(), indent=2))
else:
    print(response.text)