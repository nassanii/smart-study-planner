import os
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

from Core.models.behavioral_logs import BehavioralLogs
from utils.math_helpers import calculate_burnout_score
from ml_models.metrics_store import (
    get_burnout_path,
    get_lock,
    get_meta_metrics,
    save_meta_metrics,
)

# ---------------------------------------------------------------------------
# Burnout Model — Logistic Regression (1 per user)
# ---------------------------------------------------------------------------
def load_or_train_burnout(
    user_id: int,
    logs: BehavioralLogs,
) -> float:
    """
    Returns a burnout risk score between 0.0 and 1.0.
    Trains using synthetically-bootstrapped labels from the heuristic function
    when the .joblib file doesn't yet exist.
    """
    path = get_burnout_path(user_id)
    lock = get_lock(path)

    with lock:
        # Check if we should retrain
        meta = get_meta_metrics(user_id).get("burnout_model", {})
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

            # Train the Logistic Regression Model
            model = LogisticRegression()
            model.fit(X_train, y_train)
            
            # Evaluate Accuracy on bootstrap data
            y_pred = model.predict(X_train)
            acc = float(accuracy_score(y_train, y_pred))
            
            joblib.dump(model, path)
            save_meta_metrics(user_id, {
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
