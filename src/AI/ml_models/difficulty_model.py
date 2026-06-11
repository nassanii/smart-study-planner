import os
import joblib
import numpy as np
from typing import List
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score

from Core.models.recent_task import RecentTask
from ml_models.metrics_store import (
    get_difficulty_path,
    get_lock,
    get_meta_metrics,
    save_meta_metrics,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
OUTLIER_THRESHOLD = 3.0 # Ignore tasks where actual > 3.0 * estimated (Timer accidents)
RETRAIN_INTERVAL = 10   # Retrain every 10 new tasks

# ---------------------------------------------------------------------------
# Difficulty Model — Linear Regression (1 per subject per user)
# ---------------------------------------------------------------------------
def load_or_train_difficulty(
    user_id: int,
    subject_id: int,
    subject_tasks: List[RecentTask],
) -> float:
    """
    Returns a difficulty factor (E = predicted_actual(60) / 60).
    Trains on completed tasks for this subject where estimated > 0.
    """
    path = get_difficulty_path(user_id, subject_id)
    lock = get_lock(path)

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
        meta = get_meta_metrics(user_id).get(f"subj_{subject_id}", {})
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
            save_meta_metrics(user_id, {
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
