import os
import sys
import argparse
import sqlite3
import numpy as np
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, accuracy_score

# ---------------------------------------------------------------------------
# Constants & Paths
# ---------------------------------------------------------------------------
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Backend", "SmartStudyPlanner.Api", "smart_study_planner.db"))

def calculate_burnout_score(snooze_count: int, study_hours: float, avg_focus: float = 4.0) -> float:
    """Calculates heuristic burnout score (0.0 to 1.0)"""
    base_score = (snooze_count * 0.10) + (study_hours * 0.05)
    focus_penalty = 0
    if avg_focus < 3:
        focus_penalty = (3 - avg_focus) * 0.15
    elif avg_focus >= 4.5:
        base_score *= 0.9
    score = base_score + focus_penalty
    return min(max(0.0, round(score, 2)), 1.0)

def main():
    parser = argparse.ArgumentParser(description="Calculate real user AI model accuracy, MAE, MSE, and R2 scores directly from SQLite.")
    parser.add_argument("--user_id", type=str, required=True, help="ID of the user in the database")
    args = parser.parse_args()
    
    print(f"\n========================================================")
    print(f"📊 ANALYZING MODEL METRICS FOR REAL USER ID: {args.user_id}")
    print(f"========================================================")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
    except Exception as e:
        print(f"❌ Error connecting to database at {DB_PATH}: {e}")
        sys.exit(1)
        
    # 1. Fetch completed tasks for difficulty model
    cursor.execute("""
        SELECT t.subject_id, s.name, t.estimated_minutes, t.actual_minutes
        FROM study_tasks t
        JOIN subjects s ON t.subject_id = s.id
        WHERE t.user_id = ? AND t.status = 2 AND t.estimated_minutes > 0 AND t.actual_minutes IS NOT NULL
    """, (args.user_id,))
    tasks = cursor.fetchall()
    
    if not tasks:
        print(f"❌ No completed tasks found in database for User ID {args.user_id}.")
        print("Please make sure the User ID is correct and they have completed study tasks.")
    else:
        tasks_by_subject = {}
        for subj_id, name, est, act in tasks:
            if subj_id not in tasks_by_subject:
                tasks_by_subject[subj_id] = {"name": name, "est": [], "act": []}
            tasks_by_subject[subj_id]["est"].append(est)
            tasks_by_subject[subj_id]["act"].append(act)
            
        print("\n📈 1. DIFFICULTY REGRESSION MODEL METRICS:")
        print("--------------------------------------------------------")
        for subj_id, data in tasks_by_subject.items():
            X_train, y_train = [], []
            # Filter outliers
            for est, act in zip(data["est"], data["act"]):
                if act <= (est * 3.0):
                    X_train.append([est])
                    y_train.append(act)
                    
            if len(X_train) > 1:
                # Fit Model
                model = LinearRegression()
                weights = np.linspace(0.5, 1.0, len(X_train))  # Recency weighting
                model.fit(X_train, y_train, sample_weight=weights)
                y_pred = model.predict(X_train)
                
                # Calculate metrics
                mae = mean_absolute_error(y_train, y_pred)
                mse = mean_squared_error(y_train, y_pred)
                r2 = r2_score(y_train, y_pred)
                
                print(f"Subject: {data['name']} (ID: {subj_id})")
                print(f" - Sample Count: {len(X_train)} completed tasks (excluding outliers)")
                print(f" - MAE (Mean Absolute Error): {mae:.2f} minutes")
                print(f" - MSE (Mean Squared Error):  {mse:.2f} (minutes squared)")
                print(f" - R2 Score (Accuracy fit):   {r2:.3f}")
                print()
            else:
                print(f"Subject: {data['name']} (ID: {subj_id})")
                print(" - [Skipped]: Not enough completed tasks to train model (minimum 2 tasks required).\n")
            
    # 2. Burnout Model Metrics
    print("\n🧠 2. BURNOUT CLASSIFICATION MODEL METRICS:")
    print("--------------------------------------------------------")
    
    # Use real behavioral logs to train the burnout model if available
    cursor.execute("""
        SELECT snooze_count, study_hours, avg_focus_rating
        FROM behavioral_logs
    """)
    logs = cursor.fetchall()
    
    model_burnout = None
    if len(logs) > 5:  # Require at least some real logs
        X_burnout, y_burnout = [], []
        for snooze, hours, focus in logs:
            focus = focus if focus is not None else 4.0
            score = calculate_burnout_score(snooze, hours, focus)
            label = 1 if score >= 0.70 else 0
            X_burnout.append([snooze, hours, focus])
            y_burnout.append(label)
            
        # Check if we have both classes (0 and 1) in the data
        if len(set(y_burnout)) > 1:
            model_burnout = LogisticRegression()
            model_burnout.fit(X_burnout, y_burnout)
            y_pred_burnout = model_burnout.predict(X_burnout)
            
            # Calculate metrics
            accuracy = accuracy_score(y_burnout, y_pred_burnout)
            mse_burnout = mean_squared_error(y_burnout, y_pred_burnout)
            
            print("Model: Burnout Risk Classifier (Logistic Regression)")
            print(f" - Training Data Source: {len(X_burnout)} Real User Behavioral Logs")
            print(f" - Classification Accuracy:  {accuracy * 100:.1f}%")
            print(f" - Mean Squared Error (MSE): {mse_burnout:.4f}")
        else:
            print(" - [Skipped]: Real behavioral logs only contain one class (all burnout or all non-burnout). Model needs both to train accurately.")
    else:
        print(f" - [Skipped]: Not enough real behavioral logs to train burnout model (found {len(logs)}, minimum 5 required).")
        
    # 3. User Current Status
    cursor.execute("""
        SELECT snooze_count, study_hours, avg_focus_rating, date
        FROM behavioral_logs
        WHERE user_id = ?
        ORDER BY date DESC LIMIT 1
    """, (args.user_id,))
    latest_log = cursor.fetchone()
    
    if latest_log:
        snooze, hours, focus, date = latest_log
        focus = focus if focus is not None else 4.0
        print(f"\n📡 3. LATEST REAL USER STATUS (Date: {date}):")
        print("--------------------------------------------------------")
        print(f" - Today's Snooze Count:  {snooze}")
        print(f" - Today's Study Hours:   {hours:.2f} hours")
        print(f" - Today's Focus Rating:  {focus:.2f}/5.0")
        if model_burnout is not None:
            prob = model_burnout.predict_proba([[snooze, hours, focus]])[0][1]
            print(f" - Predicted Burnout Risk: {prob * 100:.1f}%")
        else:
            print(" - Predicted Burnout Risk: N/A (Model not trained due to lack of diverse real data)")
    else:
        print(f"\n📡 3. LATEST REAL USER STATUS:")
        print("--------------------------------------------------------")
        print(f"❌ No behavioral logs found for User ID {args.user_id}.")
        
    conn.close()
    print("\n========================================================\n")

if __name__ == "__main__":
    main()
