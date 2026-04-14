import os
import sys
import json
import numpy as np
from typing import List, Dict

# Add parent directory to path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.visualizer import plot_difficulty_performance, plot_residual_distribution

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")

def generate_user_report(user_id: int, recent_tasks: List[dict]):
    """
    Generates performance graphs and error analysis for a user.
    """
    user_report_dir = os.path.join(REPORTS_DIR, f"user_{user_id}")
    os.makedirs(user_report_dir, exist_ok=True)
    
    # 1. Group tasks by subject
    tasks_by_subject = {}
    for t in recent_tasks:
        sid = t.get("subject_id")
        if sid not in tasks_by_subject:
            tasks_by_subject[sid] = {"name": t.get("subject", f"Subject {sid}"), "ids": [], "est": [], "act": []}
        
        if t.get("status") == "completed":
            tasks_by_subject[sid]["ids"].append(t.get("id"))
            tasks_by_subject[sid]["est"].append(t.get("estimated", 0))
            tasks_by_subject[sid]["act"].append(t.get("actual", 0))
            
    # 2. Generate graphs for each subject
    report_metadata = {"generated_at": str(os.popen("date").read().strip()), "subjects": []}
    
    for sid, data in tasks_by_subject.items():
        if len(data["est"]) < 3:
            print(f" Skipping Subject {sid}: Not enough data for error distribution.")
            continue
            
        # --- Regression & Outlier Data ---
        # Calculate a simple slope for the 'Predicted' line to identify mock outliers
        x = np.array(data["est"])
        y = np.array(data["act"])
        slope, intercept = np.polyfit(x, y, 1)
        y_pred = slope * x + intercept
        residuals = y - y_pred
        abs_errors = np.abs(residuals)
        
        # Sort and pick top 3 outliers for visualization
        error_indices = np.argsort(abs_errors)[::-1]
        top_outliers = []
        for i in error_indices[:3]:
            top_outliers.append({
                "task_id": data["ids"][i],
                "estimated": float(x[i]),
                "actual": float(y[i]),
                "error": float(residuals[i])
            })

        # --- Plot 1: Performance with Outliers ---
        perf_file = f"subject_{sid}_performance.png"
        perf_path = os.path.join(user_report_dir, perf_file)
        plot_difficulty_performance(
            subject_name=data["name"],
            estimated=data["est"],
            actual=data["act"],
            save_path=perf_path,
            top_outliers=top_outliers
        )
        
        # --- Plot 2: Error (Residual) Distribution ---
        dist_file = f"subject_{sid}_error_dist.png"
        dist_path = os.path.join(user_report_dir, dist_file)
        plot_residual_distribution(
            residuals=residuals.tolist(),
            subject_name=data["name"],
            save_path=dist_path
        )
        
        report_metadata["subjects"].append({
            "subject_id": sid,
            "name": data["name"],
            "performance_plot": perf_path,
            "error_dist_plot": dist_path,
            "outliers": top_outliers
        })
        print(f" Generated analysis for {data['name']} -> {user_report_dir}")

    # 3. Save report summary
    with open(os.path.join(user_report_dir, "report_summary.json"), "w") as f:
        json.dump(report_metadata, f, indent=4)
        
    print(f"\n DONE: Report generated in {user_report_dir}")

if __name__ == "__main__":
    # Test Data with high variance for interesting graphs
    test_user_id = 999
    # Subject 1: Mathematics (Consistent pace)
    test_tasks = [
        {"id": 100+i, "subject_id": 1, "subject": "Mathematics", "estimated": 60, "actual": 70 + (i*2), "status": "completed"} 
        for i in range(10)
    ]
    # Subject 2: Programming (High variability / Large Errors)
    test_tasks += [
        {"id": 201, "subject_id": 2, "subject": "Programming", "estimated": 60, "actual": 120, "status": "completed"}, # HUGE OUTLIER
        {"id": 202, "subject_id": 2, "subject": "Programming", "estimated": 60, "actual": 65, "status": "completed"},
        {"id": 203, "subject_id": 2, "subject": "Programming", "estimated": 60, "actual": 50, "status": "completed"},
        {"id": 204, "subject_id": 2, "subject": "Programming", "estimated": 90, "actual": 95, "status": "completed"},
        {"id": 205, "subject_id": 2, "subject": "Programming", "estimated": 90, "actual": 150, "status": "completed"}, # OUTLIER
        {"id": 206, "subject_id": 2, "subject": "Programming", "estimated": 30, "actual": 45, "status": "completed"},
    ]
    
    generate_user_report(test_user_id, test_tasks)
