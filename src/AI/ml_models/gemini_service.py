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
    difficulty_factors: Dict[int, float],
    is_exhausted: bool,
    tasks_to_plan: List[Dict[str, Any]],
    available_slots: List[Dict[str, Any]],
    deadline: str,
    mode: str,
) -> Dict[str, Any]:
    """
    Build a rich prompt with ML context and send to Gemini 1.5 Flash.

    Parameters
    ----------
    difficulty_factors : dict
        {subject_id: float} — per-subject difficulty multipliers.
    mode : str
        "Cold Start (Heuristics)" or "Machine Learning (Personalized Models)".
    """

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
    except Exception:
        days_remaining = "Unknown (Check format YYYY-MM-DD)"

    # --- Build per-subject difficulty context lines ---
    diff_lines = []
    for task in tasks_to_plan:
        tid = task.get("id")
        subject = task.get("subject", "Unknown")
        factor = difficulty_factors.get(tid, 1.0)
        pct = round((factor - 1.0) * 100)
        if pct >= 0:
            note = f"{pct}% longer than estimated"
        else:
            note = f"{abs(pct)}% faster than estimated"
        diff_lines.append(f"    - Task {tid} ({subject}): {factor} ({note})")
    difficulty_block = "\n".join(diff_lines) if diff_lines else "    - No subject data yet"

    # We use the latest available Flash model for speed, cost, and JSON generation abilities
    model = genai.GenerativeModel("gemini-flash-latest")

    prompt = f"""
    You are a professional Academic Scheduler AI.
    Your task is to generate a HIGHLY STRUCTURED study plan using the 50/10 Interval Method.

    [ML CONTEXT — Personalized Analysis]
    - Analysis Mode: {mode}
    - Burnout Risk Score: {burnout_score} ({'HIGH — reduce session count and add rest blocks' if is_exhausted else 'within safe range'})
    - Per-Subject Difficulty Factors:
{difficulty_block}

    [CONTEXT]
    - Master List of Subjects: {json.dumps(tasks_to_plan, indent=2)}
    - Available Study Blocks: {json.dumps(available_slots, indent=2)}
    - Global Deadline: {deadline}
    - DAYS REMAINING UNTIL DEADLINE: {days_remaining}
    
    [STRICT SCHEDULING RULES - DO NOT DEVIATE]
    1. **Autonomous Session Estimation**:
       - You are now responsible for deciding how much time each task/subject needs today.
       - CRITICAL PROGRESS TRACKING: Look at the `estimated_minutes` and `actual_minutes` for each task in the Master List. The REMAINING time needed is roughly (estimated_minutes - actual_minutes).
       - Schedule sessions to cover the remaining time needed for top priority tasks. Do not schedule time for tasks where actual_minutes >= estimated_minutes.
       - Adjust your time estimate using the per-subject `difficulty_factor` from the ML CONTEXT above (Multiply the remaining time estimate by this factor).
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
    
    7. **Sequential Subject Blocking (Batching)**:
       - DO NOT interleave sessions of different subjects.
       - Once you start a subject, you MUST complete all its estimated sessions for the day (e.g., Part 1, Part 2, Part 3) sequentially before moving to the next subject (respecting the 50/10 pattern).
    
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
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return {
            "error": "Failed to generate schedule from AI.",
            "details": str(e),
        }
