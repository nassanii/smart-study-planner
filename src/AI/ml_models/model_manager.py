"""
ML Model Manager — Personalized ML Strategy Orchestrator
======================================================
Handles the Cold Start ↔ ML transition for:
  • Burnout Model (Logistic Regression) — 1 per User (global across subjects)
  • Difficulty Model (Linear Regression) — 1 per Subject per User

Orchestrates the public API `manage_models` and uses specific model components.
"""

import os
import numpy as np
from collections import defaultdict
from typing import Dict, List, Tuple

from Core.models.behavioral_logs import BehavioralLogs
from Core.models.recent_task import RecentTask
from utils.math_helpers import calculate_burnout_score, calculate_difficulty_factor

from ml_models.metrics_store import MODELS_DIR
from ml_models.burnout_model import load_or_train_burnout
from ml_models.difficulty_model import load_or_train_difficulty

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MIN_ENTRIES_FOR_ML = 40

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def manage_models(
    user_id: int,
    recent_tasks: List[RecentTask],
    logs: BehavioralLogs,
) -> Tuple[float, Dict[int, float], str]:
    """
    Orchestrates the Cold Start ↔ ML decision per the 40-Entry Rule.

    Returns
    -------
    burnout_score : float          0.0–1.0 risk score
    difficulty_factors : dict      {subject_id: factor} for every subject in recent_tasks
    mode : str                     Human-readable label for the analysis mode
    """
    os.makedirs(MODELS_DIR, exist_ok=True)

    # --- Group tasks by subject ---
    tasks_by_subject: Dict[int, List[RecentTask]] = defaultdict(list)
    for t in recent_tasks:
        tasks_by_subject[t.subject_id].append(t)

    completed_total = sum(1 for t in recent_tasks if t.status == "completed")

    # ------------------------------------------------------------------
    # Burnout Score
    # ------------------------------------------------------------------
    avg_focus = np.mean(logs.last_focus_ratings) if logs.last_focus_ratings else 4.0
    
    if completed_total < MIN_ENTRIES_FOR_ML:
        burnout_score = calculate_burnout_score(
            logs.snooze_count_today, logs.study_hours_today, avg_focus
        )
        burnout_mode = "Cold Start (Heuristics)"
    else:
        burnout_score = load_or_train_burnout(user_id, logs)
        burnout_mode = "Machine Learning (Personalized)"

    # ------------------------------------------------------------------
    # Per-Subject Difficulty Factors
    # ------------------------------------------------------------------
    difficulty_factors: Dict[int, float] = {}
    any_ml_used = False

    for subject_id, subject_tasks in tasks_by_subject.items():
        completed_for_subject = sum(
            1 for t in subject_tasks if t.status == "completed"
        )

        if completed_for_subject < MIN_ENTRIES_FOR_ML:
            # Cold start — use heuristic with dicts for backward compat
            task_dicts = [
                {"estimated": t.estimated, "actual": t.actual, "status": t.status}
                for t in subject_tasks
            ]
            difficulty_factors[subject_id] = calculate_difficulty_factor(task_dicts)
        else:
            difficulty_factors[subject_id] = load_or_train_difficulty(
                user_id, subject_id, subject_tasks
            )
            any_ml_used = True

    # Compose mode string
    if burnout_mode.startswith("Machine Learning") or any_ml_used:
        mode = "Machine Learning (Personalized Models)"
    else:
        mode = "Cold Start (Heuristics)"

    return burnout_score, difficulty_factors, mode
