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
    subjects: List[Dict[str, Any]],
    available_slots: List[Dict[str, Any]],
    deadline: str,
    mode: str,
    fixed_blocks: List[Dict[str, Any]] = None,
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
    for subject in subjects:
        sid = subject.get("id")
        name = subject.get("name", "Unknown")
        factor = difficulty_factors.get(sid, 1.0)
        pct = round((factor - 1.0) * 100)
        if pct >= 0:
            note = f"{pct}% longer than estimated"
        else:
            note = f"{abs(pct)}% faster than estimated"
        diff_lines.append(f"    - Subject {sid} ({name}): {factor} ({note})")
    difficulty_block = "\n".join(diff_lines) if diff_lines else "    - No subject data yet"

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
    - Available Study Blocks: {json.dumps(available_slots, indent=2)}
    - FIXED MANUAL BLOCKS (USER ALREADY COMMITTED — DO NOT MODIFY OR OVERLAP): {json.dumps(fixed_blocks or [], indent=2)}
    - Global Deadline: {deadline}
    - DAYS REMAINING UNTIL DEADLINE: {days_remaining}

    [HARD RULE — Fixed Manual Blocks]
    If "FIXED MANUAL BLOCKS" is non-empty, those entries are SACRED:
    - You MUST include each one VERBATIM in the output (same start_time, duration, subject).
    - You MUST NOT schedule any other slot that overlaps a fixed block's time range.
    - You may schedule new AI study sessions BEFORE or AFTER each fixed block within the available study blocks.
    - Treat the fixed block as already-blocked time (like a break) when distributing remaining sessions.
    
    [STRICT SCHEDULING RULES - DO NOT DEVIATE]
    1. **Real Data Integrity**:
       - You MUST use the REAL names of the subjects from the "All Available Subjects" list.
       - DO NOT use generic names like "Subject 1" or "Study Block".
       - Allocate multiple 50-minute sessions for each subject, rotating fairly.

    2. **Autonomous Session Estimation**:
       - Decide how much time each subject needs today.
       - Adjust your time estimate using the per-subject `difficulty_factor` from the ML CONTEXT.
       - SPLIT your total estimation into discrete sessions of MAXIMUM 50 minutes each.

    2b. **FILL THE AVAILABLE WINDOW (CRITICAL)**:
       - Treat each entry in "Available Study Blocks" as a continuous window the user has committed to studying.
       - You MUST cover that window with 50/10 sessions until it runs out, only stopping early if `is_exhausted` is true (then leave the last 30+ minutes as rest).
       - Distribute the sessions across the subjects, rotating fairly (round-robin), prioritising:
            1. Subjects with the soonest `exam_date`
            2. Subjects with the highest `priority`
            3. Subjects with the highest `difficulty`
       - DO NOT leave large empty stretches inside an available window unless the user is exhausted.
    
    3. **The Balancing Rules (CRITICAL)**:
       - **ROTATION RULE**: If a subject has a high priority and a close exam date, it is a TOP priority today.
    
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
          "task_id": null,
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

    # Fastest current Flash models, in priority order. The "-latest" aliases auto-update
    # so they never point at a retired model. Each call is capped with a short timeout, and
    # on any failure (e.g. a transient 503 "high demand") we try the next model, then fall
    # back to a deterministic heuristic schedule. This guarantees the request never hangs.
    model_candidates = ["gemini-flash-latest", "gemini-flash-lite-latest"]
    request_timeout_seconds = 20
    generation_config = genai.GenerationConfig(response_mime_type="application/json")

    last_error = None
    for model_name in model_candidates:
        try:
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(
                prompt,
                generation_config=generation_config,
                request_options={"timeout": request_timeout_seconds},
            )
            data = json.loads(response.text)

            # Post-process: Remove trailing break if present
            if data.get("scheduled_slots") and data["scheduled_slots"][-1].get("activity_type") == "break":
                data["scheduled_slots"].pop()

            # Tag the source so the backend/app can tell a real AI plan from the fallback.
            data["source"] = f"ai:{model_name}"
            print(f"[SCHEDULE SOURCE] source=ai model={model_name}")
            return data
        except Exception as e:
            last_error = e
            print(f"Gemini API Error on {model_name}: {e}")
            continue

    print(f"[SCHEDULE SOURCE] source=heuristic (all Gemini models failed; last error: {last_error})")
    return generate_heuristic_fallback(subjects, available_slots, fixed_blocks)


def _parse_hhmm(s):
    try:
        h, m = map(int, str(s).split(':')[:2])
        return h * 60 + m
    except Exception:
        return None


def generate_heuristic_fallback(subjects, slots, fixed_blocks=None) -> Dict[str, Any]:
    """
    Generates a 50/10 schedule that fills each available study block from start to end.
    Honors fixed_blocks (manually-committed user time) as inviolable anchors.
    """
    fixed_blocks = fixed_blocks or []
    scheduled = []

    # Sort subjects by priority (1=High)
    review_pool = sorted(subjects or [], key=lambda x: x.get("priority", 2))
    review_idx = 0

    def next_study_item():
        nonlocal review_idx
        if review_pool:
            item = review_pool[review_idx % len(review_pool)]
            review_idx += 1
            return {
                "subject": item.get("name", "Study"),
                "task_id": None,
                "subject_id": item.get("id"),
            }
        return None

    fixed_by_start = {}
    for fb in fixed_blocks:
        start = _parse_hhmm(fb.get("start_time"))
        if start is None:
            continue
        fixed_by_start[start] = fb

    for slot in slots or []:
        start_min = _parse_hhmm(slot.get("start_time") or slot.get("startTime"))
        end_min = _parse_hhmm(slot.get("end_time") or slot.get("endTime"))
        if start_min is None or end_min is None or end_min <= start_min:
            continue

        cursor = start_min
        if cursor % 30 != 0:
            cursor += (30 - cursor % 30)

        while cursor < end_min:
            fb = fixed_by_start.get(cursor)
            if fb:
                duration = int(fb.get("duration_minutes") or 50)
                if cursor + duration > end_min:
                    break
                scheduled.append({
                    "time_slot": f"{cursor // 60:02d}:{cursor % 60:02d}",
                    "subject": fb.get("subject", "Study"),
                    "adjusted_duration_minutes": duration,
                    "activity_type": "study",
                    "task_id": fb.get("task_id"),
                    "subject_id": None,
                })
                cursor += duration
                if cursor + 10 < end_min:
                    scheduled.append({
                        "time_slot": f"{cursor // 60:02d}:{cursor % 60:02d}",
                        "subject": "Break",
                        "adjusted_duration_minutes": 10,
                        "activity_type": "break",
                        "task_id": None,
                        "subject_id": None,
                    })
                    cursor += 10
                continue

            next_fixed = min(
                (t for t in fixed_by_start if t > cursor and t < cursor + 50),
                default=None,
            )
            if next_fixed is not None:
                gap = next_fixed - cursor
                if gap < 20:
                    cursor = next_fixed
                    continue
                item = next_study_item()
                if not item:
                    break
                scheduled.append({
                    "time_slot": f"{cursor // 60:02d}:{cursor % 60:02d}",
                    "subject": item["subject"],
                    "adjusted_duration_minutes": gap,
                    "activity_type": "study",
                    "task_id": item["task_id"],
                    "subject_id": item["subject_id"],
                })
                cursor = next_fixed
                continue

            if cursor + 50 > end_min:
                remaining = end_min - cursor
                if remaining >= 20:
                    item = next_study_item()
                    if item:
                        scheduled.append({
                            "time_slot": f"{cursor // 60:02d}:{cursor % 60:02d}",
                            "subject": item["subject"],
                            "adjusted_duration_minutes": remaining,
                            "activity_type": "study",
                            "task_id": item["task_id"],
                            "subject_id": item["subject_id"],
                        })
                break

            item = next_study_item()
            if not item:
                break
            scheduled.append({
                "time_slot": f"{cursor // 60:02d}:{cursor % 60:02d}",
                "subject": item["subject"],
                "adjusted_duration_minutes": 50,
                "activity_type": "study",
                "task_id": item["task_id"],
                "subject_id": item["subject_id"],
            })
            cursor += 50
            if cursor + 10 <= end_min and cursor < end_min:
                scheduled.append({
                    "time_slot": f"{cursor // 60:02d}:{cursor % 60:02d}",
                    "subject": "Break",
                    "adjusted_duration_minutes": 10,
                    "activity_type": "break",
                    "task_id": None,
                    "subject_id": None,
                })
                cursor += 10

    if scheduled and scheduled[-1].get("activity_type") == "break":
        scheduled.pop()

    return {
        "source": "heuristic",
        "scheduled_slots": scheduled,
        "postponed_tasks": [],
        "ai_message": "Heuristic Mode: I've prepared a 50/10 schedule that fills your day. The smart AI couldn't be reached this time."
    }
