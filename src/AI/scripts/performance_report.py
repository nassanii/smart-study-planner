import os
import sys
import json
import sqlite3
import argparse
import numpy as np
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from typing import List, Dict
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Add parent directory to path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.visualizer import plot_difficulty_performance, plot_residual_distribution

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Backend", "SmartStudyPlanner.Api", "smart_study_planner.db"))

def save_metrics_matrix(rows: List[dict], save_path: str):
    """
    Saves a screenshot-friendly metrics matrix as an image.
    """
    if not rows:
        return

    columns = ["Subject", "Samples", "MAE", "RMSE", "R2", "Bias"]
    table_rows = [
        [
            row["subject"],
            row["samples"],
            f"{row['mae']:.2f}",
            f"{row['rmse']:.2f}",
            f"{row['r2']:.3f}",
            f"{row['bias']:+.2f}",
        ]
        for row in rows
    ]

    fig_height = max(3.2, 0.55 * len(table_rows) + 1.4)
    fig, ax = plt.subplots(figsize=(13, fig_height))
    ax.axis("off")
    ax.set_title("Dynamic Model Performance Matrix", fontsize=16, fontweight="bold", pad=18)

    table = ax.table(
        cellText=table_rows,
        colLabels=columns,
        loc="center",
        cellLoc="center",
        colLoc="center",
        colWidths=[0.44, 0.10, 0.11, 0.11, 0.11, 0.11],
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9.5)
    table.scale(1, 1.45)

    for (row, col), cell in table.get_celld().items():
        if row == 0:
            cell.set_facecolor("#1F2937")
            cell.set_text_props(color="white", weight="bold")
        elif row % 2 == 0:
            cell.set_facecolor("#F3F4F6")
        else:
            cell.set_facecolor("#FFFFFF")
        cell.set_edgecolor("#D1D5DB")

    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()

def generate_user_report(user_id: str, recent_tasks: List[dict]):
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
    matrix_rows = []
    
    for sid, data in tasks_by_subject.items():
        if len(data["est"]) < 3:
            print(f" Skipping Subject {sid} ({data['name']}): Not enough data for error distribution (minimum 3 required).")
            continue
            
        # --- Regression & Outlier Data ---
        # Calculate a simple slope for the 'Predicted' line to identify mock outliers
        x = np.array(data["est"])
        y = np.array(data["act"])
        slope, intercept = np.polyfit(x, y, 1)
        y_pred = slope * x + intercept
        residuals = y - y_pred
        abs_errors = np.abs(residuals)
        mae = mean_absolute_error(y, y_pred)
        rmse = np.sqrt(mean_squared_error(y, y_pred))
        r2 = r2_score(y, y_pred)
        bias = float(np.mean(residuals))
        
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
            "outliers": top_outliers,
            "metrics": {
                "samples": len(data["est"]),
                "mae": round(float(mae), 3),
                "rmse": round(float(rmse), 3),
                "r2": round(float(r2), 3),
                "bias": round(float(bias), 3)
            }
        })
        matrix_rows.append({
            "subject": data["name"],
            "samples": len(data["est"]),
            "mae": float(mae),
            "rmse": float(rmse),
            "r2": float(r2),
            "bias": float(bias)
        })
        print(f" Generated analysis for {data['name']} -> {user_report_dir}")

    if matrix_rows:
        matrix_png = os.path.join(user_report_dir, "dynamic_model_performance_matrix.png")
        matrix_csv = os.path.join(user_report_dir, "dynamic_model_performance_matrix.csv")
        save_metrics_matrix(matrix_rows, matrix_png)
        with open(matrix_csv, "w") as f:
            f.write("subject,samples,mae,rmse,r2,bias\n")
            for row in matrix_rows:
                f.write(
                    f"{row['subject']},{row['samples']},{row['mae']:.4f},"
                    f"{row['rmse']:.4f},{row['r2']:.4f},{row['bias']:.4f}\n"
                )
        report_metadata["dynamic_matrix_plot"] = matrix_png
        report_metadata["dynamic_matrix_csv"] = matrix_csv
        print(f" Generated dynamic performance matrix -> {matrix_png}")

    # 3. Save report summary
    with open(os.path.join(user_report_dir, "report_summary.json"), "w") as f:
        json.dump(report_metadata, f, indent=4)
        
    print(f"\n DONE: Report generated in {user_report_dir}")

def main():
    parser = argparse.ArgumentParser(description="Generate a visual performance report for a real user.")
    parser.add_argument("--user_id", type=str, required=True, help="ID of the user in the database")
    args = parser.parse_args()

    print(f"\n========================================================")
    print(f"📊 GENERATING VISUAL REPORT FOR REAL USER ID: {args.user_id}")
    print(f"========================================================")

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
    except Exception as e:
        print(f"❌ Error connecting to database at {DB_PATH}: {e}")
        sys.exit(1)

    # Fetch completed tasks for this user
    cursor.execute("""
        SELECT t.id, t.subject_id, s.name, t.estimated_minutes, t.actual_minutes, t.status
        FROM study_tasks t
        JOIN subjects s ON t.subject_id = s.id
        WHERE t.user_id = ? AND t.status = 2 AND t.estimated_minutes > 0 AND t.actual_minutes IS NOT NULL
    """, (args.user_id,))
    
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print(f"❌ No completed tasks found in database for User ID {args.user_id}.")
        print("Please make sure the User ID is correct and they have completed study tasks.")
        sys.exit(0)

    # Convert to the format expected by generate_user_report
    tasks = []
    for row in rows:
        task_id, subj_id, subj_name, est, act, status = row
        tasks.append({
            "id": task_id,
            "subject_id": subj_id,
            "subject": subj_name,
            "estimated": est,
            "actual": act,
            "status": "completed" if status == 2 else "pending"
        })

    generate_user_report(args.user_id, tasks)

if __name__ == "__main__":
    main()
