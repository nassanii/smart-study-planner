import os
import json
from datetime import datetime
import google.generativeai as genai
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

async def generate_intelligent_schedule(
    burnout_score: float, 
    difficulty_factor: float, 
    is_exhausted: bool, 
    tasks_to_plan: List[Dict[str, Any]], 
    available_slots: List[Dict[str, Any]],
    deadline: str
) -> Dict[str, Any]:
    
    # Reload to catch .env updates without restarting server automatically
    load_dotenv(override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key or api_key == "YOUR_API_KEY_HERE" or api_key == "":
        return {
            "error": "Gemini API key is missing. Please add it to the .env file."
        }
        
    genai.configure(api_key=api_key)

    # Calculate days remaining
    try:
        deadline_date = datetime.strptime(deadline, "%Y-%m-%d")
        days_remaining = (deadline_date - datetime.now()).days
    except:
        days_remaining = "Unknown (Check format YYYY-MM-DD)"

    # We use the latest available Flash model for speed, cost, and JSON generation abilities
    model = genai.GenerativeModel("gemini-flash-latest")
    
    prompt = f"""
    You are a professional Academic Scheduler AI.
    Your task is to generate a HIGHLY STRUCTURED study plan using the 50/10 Interval Method.
    
    [CONTEXT]
    - Master List of Subjects: {json.dumps(tasks_to_plan, indent=2)}
    - Available Study Blocks: {json.dumps(available_slots, indent=2)}
    - Global Deadline: {deadline}
    - DAYS REMAINING UNTIL DEADLINE: {days_remaining}
    - Global Difficulty Factor: {difficulty_factor} (Multiply task 'estimated_min' by this to find total work needed).
    - Student Burnout: {burnout_score}
    
    [STRICT SCHEDULING RULES - DO NOT DEVIATE]
    1. **Autonomous Session Estimation**:
       - You are now responsible for deciding how much time each subject needs today.
       - FOR EVERY SELECTED SUBJECT: Estimate the total study load needed today based on its `difficulty_rating` (1-10) and the `days_remaining` until the deadline.
       - Adjust your estimate using the `difficulty_factor` (Calculated from user history).
       - SPLIT your total estimation into discrete sessions of MAXIMUM 50 minutes each.
    
    2. **The Balancing Rules (CRITICAL)**:
       - **ROTATION RULE**: If a task has `days_since_last_study` > 3, it is a TOP priority today. You MUST schedule at least one 50-minute session for it.
       - **BURNOUT PROTECTION**: If a task has `consecutive_days_studied` >= 3, the student is suffering from "Subject Burnout". You MUST POSTPONE this subject today for rest, regardless of its importance.
    
    3. **Urgency Handling**: 
       - If 'days_remaining' is less than 7, be more aggressive with your time estimates to cover more material.
       - If 'days_remaining' is less than 3, this is an EMERGENCY. Max out the available blocks with high-difficulty subjects.
    
    4. **50/10 Pattern**:
       - Every study session MUST be followed by a 10-minute break.
       - STUDY (50m max) -> BREAK (10m).
    
    5. **Start Times (The 30-Minute Rule)**:
       - Every study session MUST start at exactly :00 or :30 minutes. 
    
    6. **Prioritization**:
       - Prioritize subjects with the highest 'difficulty_rating' (while respecting Balancing Rules).
    
    [OUTPUT FORMAT]
    Return ONLY a JSON object:
    {{
      "scheduled_slots": [
        {{
          "time_slot": "08:00", 
          "subject": "Math (Part 1)",
          "adjusted_duration_minutes": 50,
          "activity_type": "study",
          "task_id": 1
        }},
        {{
          "time_slot": "08:50",
          "subject": "Break",
          "adjusted_duration_minutes": 10,
          "activity_type": "break",
          "task_id": null
        }}
      ],
      "postponed_tasks": [list of IDs],
      "ai_message": "Strategic summary in Arabic/English. Mention the countdown to the deadline!"
    }}
    """
    
    try:
        # Use async generation and enforce JSON return type
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return {
            "error": "Failed to generate schedule from AI.",
            "details": str(e)
        }
