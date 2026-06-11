import os
import threading
import json
from collections import defaultdict
from typing import Any, Dict

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MODELS_DIR = os.path.join(os.path.dirname(__file__), "saved_models")

# ---------------------------------------------------------------------------
# Thread-safety primitives
# ---------------------------------------------------------------------------
_meta_lock = threading.Lock()
_path_locks: Dict[str, threading.Lock] = defaultdict(threading.Lock)

def get_lock(path: str) -> threading.Lock:
    """Return a per-file-path lock (creating it lazily under a meta-lock)."""
    with _meta_lock:
        return _path_locks[path]

# ---------------------------------------------------------------------------
# File-path helpers
# ---------------------------------------------------------------------------
def get_burnout_path(user_id: int) -> str:
    user_dir = os.path.join(MODELS_DIR, f"user_{user_id}")
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, "burnout_model.joblib")


def get_difficulty_path(user_id: int, subject_id: int) -> str:
    user_dir = os.path.join(MODELS_DIR, f"user_{user_id}")
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, f"subj_{subject_id}_difficulty.joblib")

# ---------------------------------------------------------------------------
# Metrics Storage
# ---------------------------------------------------------------------------
def save_meta_metrics(user_id: int, metrics: Dict[str, Any]):
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


def get_meta_metrics(user_id: int) -> Dict[str, Any]:
    """Retrieves metrics for a specific user."""
    path = os.path.join(MODELS_DIR, f"user_{user_id}", "metrics.json")
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except: pass
    return {}
