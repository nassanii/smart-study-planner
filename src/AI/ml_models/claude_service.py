import asyncio
import json
import os
import time
from datetime import datetime
from typing import List, Dict, Any

import anthropic
from anthropic import AsyncAnthropic
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _model_candidates() -> List[str]:
    raw = os.getenv(
        "ANTHROPIC_MODEL_CANDIDATES",
        "claude-haiku-4-5",
    )
    models = [model.strip() for model in raw.split(",") if model.strip()]
    return models or ["claude-haiku-4-5"]


def _json_compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _elapsed_ms(started_at: float) -> int:
    return int((time.monotonic() - started_at) * 1000)


# Fast Claude models, in priority order. Haiku is tried first because schedule
# generation is mostly structured JSON formatting, so lower latency matters more
# than extra reasoning depth here.
MODEL_CANDIDATES = _model_candidates()
REQUEST_TIMEOUT_SECONDS = _env_float("ANTHROPIC_REQUEST_TIMEOUT_SECONDS", 12.0)
TOTAL_TIMEOUT_SECONDS = _env_float("ANTHROPIC_TOTAL_TIMEOUT_SECONDS", 18.0)
MAX_TOKENS = _env_int("ANTHROPIC_MAX_TOKENS", 4096)

_client_cache = {"key": None, "client": None}


def _get_client(api_key: str) -> AsyncAnthropic:
    # Reuse one client per key so connections pool, but pick up .env key swaps.
    if _client_cache["client"] is None or _client_cache["key"] != api_key:
        _client_cache["client"] = AsyncAnthropic(
            api_key=api_key,
            timeout=REQUEST_TIMEOUT_SECONDS,
            max_retries=0,
        )
        _client_cache["key"] = api_key
    return _client_cache["client"]


def _extract_response_text(message: Any) -> str:
    parts = []
    for block in getattr(message, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


def _strip_json_fence(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned


def _load_json_object(text: str) -> Dict[str, Any]:
    cleaned = _strip_json_fence(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


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
    Build a rich prompt with ML context and send it to the fastest available
    Claude model, falling back to a heuristic plan when the provider is unavailable.
    """

    # Reload to catch .env updates without restarting server automatically
    load_dotenv(override=True)
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")

    if not api_key or api_key == "YOUR_API_KEY_HERE" or api_key == "":
        return {
            "error": "Anthropic API key is missing. Please add ANTHROPIC_API_KEY to the environment."
        }
    started_at = time.monotonic()

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

    subjects_json = _json_compact(subjects)
    available_slots_json = _json_compact(available_slots)
    fixed_blocks_json = _json_compact(fixed_blocks or [])

    prompt = f"""
    You are a professional Academic Scheduler AI.
    Your task is to generate a HIGHLY STRUCTURED study plan using the 50/10 Interval Method.

    [ML CONTEXT — Personalized Analysis]
    - Analysis Mode: {mode}
    - Burnout Risk Score: {burnout_score} ({'HIGH — reduce session count and add rest blocks' if is_exhausted else 'within safe range'})
    - Per-Subject Difficulty Factors:
{difficulty_block}

    [CONTEXT]
    - All Available Subjects: {subjects_json}
    - Available Study Blocks: {available_slots_json}
    - FIXED MANUAL BLOCKS (USER ALREADY COMMITTED — DO NOT MODIFY OR OVERLAP): {fixed_blocks_json}
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
    Return ONLY a valid JSON object. Do not wrap it in markdown fences:
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

    client = _get_client(api_key)

    last_error = None
    for model_name in MODEL_CANDIDATES:
        remaining_budget = TOTAL_TIMEOUT_SECONDS - (time.monotonic() - started_at)
        if remaining_budget <= 0:
            print(
                "[SCHEDULE SOURCE] source=heuristic "
                f"(Claude budget exceeded before {model_name}) "
                f"elapsed_ms={_elapsed_ms(started_at)}"
            )
            return generate_heuristic_fallback(subjects, available_slots, fixed_blocks)

        try:
            response = await asyncio.wait_for(
                client.messages.create(
                    model=model_name,
                    max_tokens=MAX_TOKENS,
                    temperature=0,
                    system=(
                        "You are a scheduling engine. Return only valid JSON matching "
                        "the requested schema. Never include prose outside JSON."
                    ),
                    messages=[{"role": "user", "content": prompt}],
                ),
                timeout=max(1.0, remaining_budget),
            )
            response_text = _extract_response_text(response)
            data = _load_json_object(response_text)

            # Post-process: Remove trailing break if present
            if data.get("scheduled_slots") and data["scheduled_slots"][-1].get("activity_type") == "break":
                data["scheduled_slots"].pop()

            # Tag the source so the backend/app can tell a real AI plan from the fallback.
            data["source"] = f"ai:{model_name}"
            print(
                f"[SCHEDULE SOURCE] source=ai provider=anthropic model={model_name} "
                f"elapsed_ms={_elapsed_ms(started_at)}"
            )
            return data
        except Exception as e:
            last_error = e
            error_name = type(e).__name__
            if isinstance(e, anthropic.AuthenticationError):
                print(
                    "[SCHEDULE SOURCE] source=heuristic "
                    f"(Anthropic authentication failed) elapsed_ms={_elapsed_ms(started_at)}"
                )
                break
            print(
                f"Anthropic API Error on {model_name} "
                f"({error_name}, elapsed_ms={_elapsed_ms(started_at)}): {e}"
            )
            continue

    print(
        "[SCHEDULE SOURCE] source=heuristic "
        f"(all Claude models failed; last error: {last_error}) "
        f"elapsed_ms={_elapsed_ms(started_at)}"
    )
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
        "ai_message": "Heuristic Mode: I've prepared a 50/10 schedule that fills your day. Claude AI couldn't be reached this time."
    }
