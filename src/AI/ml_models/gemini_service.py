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
    subjects: List[Dict[str, Any]],
    available_slots: List[Dict[str, Any]],
    deadline: str,
    mode: str,
) -> Dict[str, Any]:
    """
    Build a rich prompt with ML context and send to Gemini 1.5 Flash.
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
    - All Available Subjects: {json.dumps(subjects, indent=2)}
    - Pending Tasks (Master List): {json.dumps(tasks_to_plan, indent=2)}
    - Available Study Blocks: {json.dumps(available_slots, indent=2)}
    - Global Deadline: {deadline}
    - DAYS REMAINING UNTIL DEADLINE: {days_remaining}
    
    [STRICT SCHEDULING RULES - DO NOT DEVIATE]
    1. **Real Data Integrity**:
       - You MUST use the REAL names of the subjects from the "All Available Subjects" list. 
       - DO NOT use generic names like "Subject 1" or "Study Block".
       - If a subject has pending tasks in the "Pending Tasks" list, prioritize those tasks and use their IDs.
       - If a subject has NO pending tasks, ONLY schedule ONE session (max 50m) for 'General Review' if it needs study time. DO NOT schedule multiple sessions for task-less subjects unless their exam is in < 7 days.
    
    2. **Autonomous Session Estimation**:
       - Decided how much time each task/subject needs today.
       - For pending tasks: The REMAINING time needed is roughly (estimated_minutes - actual_minutes).
       - Adjust your time estimate using the per-subject `difficulty_factor` from the ML CONTEXT.
       - SPLIT your total estimation into discrete sessions of MAXIMUM 50 minutes each.
    
    3. **The Balancing Rules (CRITICAL)**:
       - **ROTATION RULE**: If a task has `days_since_last_study` > 3, it is a TOP priority today.
       - **BURNOUT PROTECTION**: If a task has `consecutive_days_studied` >= 3, POSTPONE this subject today.
    
    4. **Urgency Handling**: 
       - If 'days_remaining' is low, be more aggressive with time estimates.
    
    5. **50/10 Pattern**:
       - Every study session MUST be followed by a 10-minute break.
       - STUDY (50m max) -> BREAK (10m).
    
    6. **Start Times**:
       - Every study session MUST start at exactly :00 or :30 minutes. 
    
    7. **Sequential Subject Blocking**:
       - Once you start a subject, complete all its daily sessions sequentially before moving to the next subject.

    8. **No Trailing Breaks**:
       - The LAST item in the 'scheduled_slots' list MUST be a study session, NOT a break.
    
    [OUTPUT FORMAT]
    Return ONLY a JSON object:
    {{
      "scheduled_slots": [
        {{
          "time_slot": "08:00", 
          "subject": "Real Subject Name (Part 1)",
          "adjusted_duration_minutes": 50,
          "activity_type": "study",
          "task_id": 123,
          "subject_id": 45
        }},
        {{
          "time_slot": "08:50",
          "subject": "Break",
          "adjusted_duration_minutes": 10,
          "activity_type": "break",
          "task_id": null,
          "subject_id": null
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
        data = json.loads(response.text)
        
        # Post-process: Remove trailing break if present
        if data.get("scheduled_slots") and data["scheduled_slots"][-1].get("activity_type") == "break":
            data["scheduled_slots"].pop()
            
        return data
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return generate_heuristic_fallback(tasks_to_plan, subjects, available_slots)


def generate_heuristic_fallback(tasks, subjects, slots) -> Dict[str, Any]:
    """
    Generates a simple 50/10 schedule based on heuristics when the AI fails.
    """
    scheduled = []
    
    # 1. Simple task prioritization
    pending_tasks = sorted(tasks, key=lambda x: x.get("priority", 2), reverse=True)
    
    # 2. Fill slots
    for slot in slots:
        start_time_str = slot.get("startTime", "08:00")
        try:
            h, m = map(int, start_time_str.split(':'))
            current_time = h * 60 + m
        except:
            current_time = 480 # 08:00
            
        for task in pending_tasks:
            if task.get("_done"): continue
            
            # Study Session (50m)
            h_str = f"{current_time // 60:02d}:{current_time % 60:02d}"
            scheduled.append({
                "time_slot": h_str,
                "subject": task.get("subject", "Study"),
                "adjusted_duration_minutes": 50,
                "activity_type": "study",
                "task_id": task.get("id"),
                "subject_id": task.get("subject_id")
            })
            
            # Break (10m)
            current_time += 50
            h_str = f"{current_time // 60:02d}:{current_time % 60:02d}"
            scheduled.append({
                "time_slot": h_str,
                "subject": "Break",
                "adjusted_duration_minutes": 10,
                "activity_type": "break",
                "task_id": None,
                "subject_id": None
            })
            
            current_time += 10
            task["_done"] = True
            
            # Simple limit: 4 tasks per slot to avoid overflow
            if len(scheduled) > 8: break
            
    # Post-process: Remove trailing break
    if scheduled and scheduled[-1].get("activity_type") == "break":
        scheduled.pop()

    return {
        "scheduled_slots": scheduled,
        "postponed_tasks": [],
        "ai_message": "Heuristic Mode: I've prepared a basic 50/10 schedule for you while the AI is warming up!"
    }
