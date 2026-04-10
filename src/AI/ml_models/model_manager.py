import os
import joblib
import numpy as np
from sklearn.linear_model import LinearRegression, LogisticRegression
from typing import List, Dict, Any, Tuple
from utils.math_helpers import calculate_burnout_score, calculate_difficulty_factor
from Core.models.behavioral_logs import BehavioralLogs

MODELS_DIR = os.path.join(os.path.dirname(__file__), "saved_models")

def manage_models(user_id: str, recent_tasks: List[Dict[str, Any]], logs: BehavioralLogs) -> Tuple[float, float, str]:
    """
    Manages the logic for Cold Start vs. Machine Learning modes.
    """
    # Create the directory if it doesn't exist
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    count = len(recent_tasks)
    
    if count < 10:
        mode = "Cold Start (Heuristics)"
        difficulty_factor = calculate_difficulty_factor(recent_tasks)
        burnout_score = calculate_burnout_score(logs.snooze_count_today, logs.study_hours_today)
        return burnout_score, difficulty_factor, mode
        
    mode = "Machine Learning (Personalized Models)"
    diff_model_path = os.path.join(MODELS_DIR, f"{user_id}_diff_model.joblib")
    burnout_model_path = os.path.join(MODELS_DIR, f"{user_id}_burnout_model.joblib")
    
    # Load models if they exist, otherwise train them
    if os.path.exists(diff_model_path) and os.path.exists(burnout_model_path):
        diff_model = joblib.load(diff_model_path)
        burnout_model = joblib.load(burnout_model_path)
    else:
        # 1. Train Linear Regression for Difficulty Factor
        X_diff = []
        y_diff = []
        for t in recent_tasks:
            if t.get("status") == "completed" and t.get("estimated", 0) > 0:
                X_diff.append([t["estimated"]])
                y_diff.append(t["actual"])
                
        diff_model = LinearRegression()
        if len(X_diff) > 1:
            diff_model.fit(X_diff, y_diff)
        else:
            # Fallback if there are no valid completed tasks despite length >= 10
            diff_model.fit([[60], [120]], [60, 120])
            
        # 2. Train Logistic Regression for Burnout Score
        # Since we only get current logs, we'll train the initial ML model using synthetically generated 
        # historical data from heuristics to mimic past behavioral labels (0=fresh, 1=exhausted).
        np.random.seed(42)
        X_burn = []
        y_burn = []
        for _ in range(50):
            sz = np.random.randint(0, 10)
            sh = np.random.uniform(0, 12)
            score = calculate_burnout_score(sz, sh)
            label = 1 if score >= 0.75 else 0
            X_burn.append([sz, sh])
            y_burn.append(label)
            
        burnout_model = LogisticRegression()
        burnout_model.fit(X_burn, y_burn)
        
        # Save models
        joblib.dump(diff_model, diff_model_path)
        joblib.dump(burnout_model, burnout_model_path)
        
    # Calculate Difficulty Factor using the ML model
    # By predicting for 60 minutes and seeing the ratio
    predicted_actual = diff_model.predict([[60]])[0]
    difficulty_factor = float(max(0.1, round(float(predicted_actual) / 60.0, 2)))

    # Calculate Burnout Score using the ML model
    # Probability of being in class 1 (exhausted)
    prob = burnout_model.predict_proba([[logs.snooze_count_today, logs.study_hours_today]])
    burnout_score = float(round(float(prob[0][1]), 2))
    
    return burnout_score, difficulty_factor, mode
