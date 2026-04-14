"""
ML Model Manager — Personalized ML Strategy
=============================================
Handles the Cold Start → ML transition for:
  • Burnout Model (Logistic Regression) — 1 per User (global across subjects)
  • Difficulty Model (Linear Regression) — 1 per Subject per User

Thread-safe file I/O via per-path locks.
"""

import os
import threading
from collections import defaultdict
from typing import Dict, List, Tuple

import joblib
import json
import numpy as np
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score

from Core.models.behavioral_logs import BehavioralLogs
from Core.models.recent_task import RecentTask
from utils.math_helpers import calculate_burnout_score, calculate_difficulty_factor

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MODELS_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
MIN_ENTRIES_FOR_ML = 40
RETRAIN_INTERVAL = 10  # Retrain every 10 new tasks
OUTLIER_THRESHOLD = 3.0 # Ignore tasks where actual > 3.0 * estimated (Timer accidents)

# ---------------------------------------------------------------------------
# Thread-safety primitives
# ---------------------------------------------------------------------------
_meta_lock = threading.Lock()
_path_locks: Dict[str, threading.Lock] = defaultdict(threading.Lock)


def _get_lock(path: str) -> threading.Lock:
    """Return a per-file-path lock (creating it lazily under a meta-lock)."""
    with _meta_lock:
        return _path_locks[path]


# ---------------------------------------------------------------------------
# File-path helpers
# ---------------------------------------------------------------------------
def _burnout_path(user_id: int) -> str:
    user_dir = os.path.join(MODELS_DIR, f"user_{user_id}")
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, "burnout_model.joblib")


def _difficulty_path(user_id: int, subject_id: int) -> str:
    user_dir = os.path.join(MODELS_DIR, f"user_{user_id}")
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, f"subj_{subject_id}_difficulty.joblib")


def _save_meta_metrics(user_id: int, metrics: Dict[str, Any]):
    """Saves or updates metrics in the user's local directory."""
    user_dir = os.path.join(MODELS_DIR, f"user_{user_id}")
    os.makedirs(user_dir, exist_ok=True)
    path = os.path.join(user_dir, "metrics.json")
    
    current_data = {}
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                current_data = json.load(f)
        except: pass
        
    current_data.update(metrics)
    with open(path, "w") as f:
        json.dump(current_data, f, indent=4)


def _get_meta_metrics(user_id: int) -> Dict[str, Any]:
    """Retrieves metrics for a specific user."""
    path = os.path.join(MODELS_DIR, f"user_{user_id}", "metrics.json")
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except: pass
    return {}


# ---------------------------------------------------------------------------
# Burnout Model — Logistic Regression (1 per user)
# ---------------------------------------------------------------------------
def _load_or_train_burnout(
    user_id: int,
    logs: BehavioralLogs,
) -> float:
    """
    Returns a burnout risk score between 0.0 and 1.0.
    Trains using synthetically-bootstrapped labels from the heuristic function
    when the .joblib file doesn't yet exist.
    """
    path = _burnout_path(user_id)
    lock = _get_lock(path)

    with lock:
        # Check if we should retrain
        meta = _get_meta_metrics(user_id).get("burnout_model", {})
        last_count = meta.get("sample_count", 0)
        # For burnout, we use a global count check (simplified for now)
        should_retrain = not os.path.exists(path)

        if os.path.exists(path) and not should_retrain:
            model: LogisticRegression = joblib.load(path)
        else:
            # Bootstrap training data from heuristic to kick-start the model
            rng = np.random.RandomState(42)
            X_train, y_train = [], []
            for _ in range(100): # Increased samples for 3 features
                snooze = int(rng.randint(0, 10))
                hours = float(rng.uniform(0, 12))
                focus = float(rng.uniform(1, 5))
                
                heuristic_score = calculate_burnout_score(snooze, hours, focus)
                label = 1 if heuristic_score >= 0.70 else 0
                X_train.append([snooze, hours, focus])
                y_train.append(label)

            model = LogisticRegression()
            model.fit(X_train, y_train)
            
            # Evaluate Accuracy on bootstrap data
            y_pred = model.predict(X_train)
            acc = float(accuracy_score(y_train, y_pred))
            
            joblib.dump(model, path)
            _save_meta_metrics(user_id, {
                "burnout_model": {
                    "accuracy": round(acc, 3),
                    "sample_count": 100, # Bootstrap count
                    "last_trained": str(np.datetime64('now'))
                }
            })

    # Predict probability of exhaustion (class=1)
    avg_focus = np.mean(logs.last_focus_ratings) if logs.last_focus_ratings else 4.0
    prob = model.predict_proba([[logs.snooze_count_today, logs.study_hours_today, avg_focus]])
    return float(round(float(prob[0][1]), 2))


# ---------------------------------------------------------------------------
# Difficulty Model — Linear Regression (1 per subject per user)
# ---------------------------------------------------------------------------
def _load_or_train_difficulty(
    user_id: int,
    subject_id: int,
    subject_tasks: List[RecentTask],
) -> float:
    """
    Returns a difficulty factor (E = predicted_actual(60) / 60).
    Trains on completed tasks for this subject where estimated > 0.
    """
    path = _difficulty_path(user_id, subject_id)
    lock = _get_lock(path)

    with lock:
        # Group data for training with Outlier Filtering
        all_completed = [t for t in subject_tasks if t.status == "completed" and t.estimated > 0]
        
        X_train, y_train = [], []
        ignored_outliers = 0
        for t in all_completed:
            if t.actual <= (t.estimated * OUTLIER_THRESHOLD):
                X_train.append([t.estimated])
                y_train.append(t.actual)
            else:
                ignored_outliers += 1
        
        # Check Retraining Policy
        meta = _get_meta_metrics(user_id).get(f"subj_{subject_id}", {})
        last_count = meta.get("sample_count", 1) 
        should_retrain = not os.path.exists(path) or (len(all_completed) - last_count >= RETRAIN_INTERVAL)

        if os.path.exists(path) and not should_retrain:
            model: LinearRegression = joblib.load(path)
        else:
            # Training / Retraining block
            model = LinearRegression()
            top_errors = []
            
            if len(X_train) > 1:
                # RECENCY WEIGHTING: Linear ramp from 0.5 (oldest) to 1.0 (newest)
                weights = np.linspace(0.5, 1.0, len(X_train))
                
                model.fit(X_train, y_train, sample_weight=weights)
                
                # Evaluate on training data
                y_pred = model.predict(X_train)
                residuals = np.abs(np.array(y_train) - y_pred)
                
                mae = float(mean_absolute_error(y_train, y_pred))
                r2 = float(r2_score(y_train, y_pred))

                # Identify top 5 outliers (from the CLEANED set)
                task_errors = []
                for idx, t_actual_val in enumerate(y_train):
                    # Find corresponding task if possible (not ideal with indices but works for metrics)
                    task_errors.append({
                        "estimated": float(X_train[idx][0]),
                        "actual": float(y_train[idx]),
                        "predicted": round(float(y_pred[idx]), 1),
                        "abs_error": round(float(residuals[idx]), 1)
                    })
                
                task_errors.sort(key=lambda x: x["abs_error"], reverse=True)
                top_errors = task_errors[:5]
            else:
                # Safety fallback: identity slope
                model.fit([[60], [120]], [60, 120])
                mae, r2 = 0.0, 1.0

            joblib.dump(model, path)
            
            # Save metrics under a key for this specific subject
            _save_meta_metrics(user_id, {
                f"subj_{subject_id}": {
                    "mae_minutes": round(mae, 2),
                    "r2_score": round(r2, 3),
                    "sample_count": len(all_completed),
                    "ignored_outliers": ignored_outliers,
                    "top_errors": top_errors,
                    "last_trained": str(np.datetime64('now'))
                }
            })

    predicted_actual = model.predict([[60]])[0]
    factor = float(max(0.1, round(float(predicted_actual) / 60.0, 2)))
    return factor


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def manage_models(
    user_id: int,
    recent_tasks: List[RecentTask],
    logs: BehavioralLogs,
) -> Tuple[float, Dict[int, float], str]:
    """
    Orchestrates the Cold Start ↔ ML decision per the 10-Entry Rule.

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
        burnout_score = _load_or_train_burnout(user_id, logs)
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
            difficulty_factors[subject_id] = _load_or_train_difficulty(
                user_id, subject_id, subject_tasks
            )
            any_ml_used = True

    # Compose mode string
    if burnout_mode.startswith("Machine Learning") or any_ml_used:
        mode = "Machine Learning (Personalized Models)"
    else:
        mode = "Cold Start (Heuristics)"

    return burnout_score, difficulty_factors, mode
