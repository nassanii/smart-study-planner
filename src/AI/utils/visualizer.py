import os
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
from typing import List, Dict, Optional

# Set plot style for premium Look
sns.set_theme(style="darkgrid")
plt.rcParams['figure.dpi'] = 150
plt.rcParams['font.family'] = 'sans-serif'

def plot_difficulty_performance(
    subject_name: str, 
    estimated: List[float], 
    actual: List[float], 
    save_path: str,
    top_outliers: Optional[List[Dict]] = None
):
    """
    Generates a regression plot showing how well the 
    Difficulty Model predicts study time for a specific subject.
    Highlights top outliers if provided.
    """
    df = pd.DataFrame({
        "Estimated Minutes": estimated,
        "Actual Minutes spent": actual
    })
    
    plt.figure(figsize=(8, 6))
    
    # Draw the points and the regression line
    sns.regplot(
        data=df, 
        x="Estimated Minutes", 
        y="Actual Minutes spent",
        scatter_kws={'alpha':0.4, 's':60, 'color':'#4C6EF5'},
        line_kws={'color':'#FF6B6B', 'lw':2},
        label="Regression Model"
    )
    
    # Identity line (Ideal path where Estimated == Actual)
    max_val = max(max(estimated), max(actual)) if estimated and actual else 100
    plt.plot([0, max_val], [0, max_val], linestyle='--', color='#ADB5BD', alpha=0.6, label='Ideal Path (E=A)')
    
    # Highlight outliers
    if top_outliers:
        outlier_est = [o["estimated"] for o in top_outliers]
        outlier_act = [o["actual"] for o in top_outliers]
        plt.scatter(outlier_est, outlier_act, color='#E03131', s=100, edgecolors='black', label='Top Errors/Outliers', zorder=5)
        
        # Annotate outliers with task ID
        for o in top_outliers:
            if o.get("task_id") is not None:
                plt.annotate(f"ID:{o['task_id']}", (o["estimated"], o["actual"]), 
                             xytext=(5, 5), textcoords='offset points', fontsize=9, fontweight='bold', color='#C92A2A')
    
    plt.title(f"Model Accuracy: {subject_name}", fontsize=14, fontweight='bold', pad=20)
    plt.xlabel("Estimated Minutes (AI Predicts)", fontsize=12)
    plt.ylabel("Actual Minutes (Student Takes)", fontsize=12)
    plt.legend(loc='upper left')
    
    # Save with tight layout
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()

def plot_residual_distribution(
    residuals: List[float],
    subject_name: str,
    save_path: str
):
    """
    Generates a histogram/KDE plot of the errors (Actual - Predicted).
    Helps visualize if the model has a consistent bias.
    """
    plt.figure(figsize=(8, 5))
    
    sns.histplot(residuals, kde=True, color="#4C6EF5", bins=15)
    plt.axvline(0, color='#E03131', linestyle='--', lw=2, label="Zero Error")
    
    plt.title(f"Error Distribution: {subject_name}", fontsize=14, fontweight='bold', pad=15)
    plt.xlabel("Prediction Error (Minutes)", fontsize=12)
    plt.ylabel("Frequency", fontsize=12)
    plt.legend()
    
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()

def plot_burnout_metrics(
    accuracy: float,
    save_path: str
):
    """
    Generates a simple gauge-like visualization for model accuracy.
    """
    fig, ax = plt.subplots(figsize=(6, 4))
    
    # Simple horizontal bar showing accuracy
    color = "#40C057" if accuracy > 0.8 else "#FAB005"
    ax.barh(["Model Accuracy"], [accuracy], color=color, height=0.5)
    ax.set_xlim(0, 1.0)
    
    # Add text annotation
    plt.text(accuracy - 0.05, 0, f"{accuracy*100:.1f}%", 
             va='center', ha='right', color='white', fontweight='bold', fontsize=12)
    
    plt.title("Burnout Model Confidence (Logistic Regression)", fontsize=12, fontweight='bold')
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()
