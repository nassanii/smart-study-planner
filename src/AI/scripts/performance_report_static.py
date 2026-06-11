import argparse
import html
import json
import math
import os
import re
import sqlite3
from datetime import datetime
from statistics import mean


REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")
DB_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "Backend",
        "SmartStudyPlanner.Api",
        "smart_study_planner.db",
    )
)


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def regression(xs, ys):
    x_mean = mean(xs)
    y_mean = mean(ys)
    denom = sum((x - x_mean) ** 2 for x in xs)
    slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys)) / denom if denom else 1.0
    intercept = y_mean - slope * x_mean
    preds = [slope * x + intercept for x in xs]
    residuals = [y - p for y, p in zip(ys, preds)]
    mae = mean(abs(r) for r in residuals)
    rmse = math.sqrt(mean(r * r for r in residuals))
    bias = mean(residuals)
    sst = sum((y - y_mean) ** 2 for y in ys)
    sse = sum(r * r for r in residuals)
    r2 = 1 - (sse / sst) if sst else 1.0
    return slope, intercept, preds, residuals, {
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
        "bias": bias,
    }


def svg_scatter(subject, xs, ys, slope, intercept, outliers):
    width, height = 920, 540
    left, right, top, bottom = 72, 32, 56, 70
    plot_w = width - left - right
    plot_h = height - top - bottom
    max_x = max(xs) * 1.12
    max_y = max(ys) * 1.12
    max_axis = max(max_x, max_y, 100)

    def sx(x):
        return left + (x / max_axis) * plot_w

    def sy(y):
        return top + plot_h - (y / max_axis) * plot_h

    ticks = [0, max_axis * 0.25, max_axis * 0.5, max_axis * 0.75, max_axis]
    grid = []
    for t in ticks:
        grid.append(f'<line x1="{sx(t):.1f}" y1="{top}" x2="{sx(t):.1f}" y2="{top + plot_h}" stroke="#E5E7EB"/>')
        grid.append(f'<line x1="{left}" y1="{sy(t):.1f}" x2="{left + plot_w}" y2="{sy(t):.1f}" stroke="#E5E7EB"/>')
        grid.append(f'<text x="{sx(t):.1f}" y="{height - 42}" text-anchor="middle" class="tick">{t:.0f}</text>')
        grid.append(f'<text x="{left - 12}" y="{sy(t) + 4:.1f}" text-anchor="end" class="tick">{t:.0f}</text>')

    points = []
    outlier_indices = {item["index"] for item in outliers}
    for i, (x, y) in enumerate(zip(xs, ys)):
        if i in outlier_indices:
            points.append(f'<circle cx="{sx(x):.1f}" cy="{sy(y):.1f}" r="7" fill="#DC2626" stroke="#111827" stroke-width="1.5"/>')
        else:
            points.append(f'<circle cx="{sx(x):.1f}" cy="{sy(y):.1f}" r="5" fill="#2563EB" opacity="0.62"/>')

    x1, x2 = 0, max_axis
    y1, y2 = intercept, slope * max_axis + intercept

    return f"""<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" role="img">
<style>
  .title {{ font: 700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#111827; }}
  .label {{ font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#374151; }}
  .tick {{ font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#6B7280; }}
  .legend {{ font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#374151; }}
</style>
<rect width="100%" height="100%" fill="#FFFFFF"/>
<text x="{left}" y="32" class="title">Model Accuracy: {html.escape(subject)}</text>
{''.join(grid)}
<line x1="{left}" y1="{top + plot_h}" x2="{left + plot_w}" y2="{top + plot_h}" stroke="#111827"/>
<line x1="{left}" y1="{top}" x2="{left}" y2="{top + plot_h}" stroke="#111827"/>
<line x1="{sx(0):.1f}" y1="{sy(0):.1f}" x2="{sx(max_axis):.1f}" y2="{sy(max_axis):.1f}" stroke="#9CA3AF" stroke-dasharray="8 8" stroke-width="2"/>
<line x1="{sx(x1):.1f}" y1="{sy(y1):.1f}" x2="{sx(x2):.1f}" y2="{sy(y2):.1f}" stroke="#EF4444" stroke-width="3"/>
{''.join(points)}
<text x="{left + plot_w / 2}" y="{height - 14}" text-anchor="middle" class="label">Estimated Minutes</text>
<text x="18" y="{top + plot_h / 2}" transform="rotate(-90 18 {top + plot_h / 2})" text-anchor="middle" class="label">Actual Minutes</text>
<circle cx="{width - 210}" cy="32" r="5" fill="#2563EB" opacity="0.62"/><text x="{width - 196}" y="37" class="legend">Samples</text>
<circle cx="{width - 122}" cy="32" r="6" fill="#DC2626" stroke="#111827"/><text x="{width - 108}" y="37" class="legend">Top errors</text>
</svg>"""


def svg_residuals(subject, residuals):
    width, height = 920, 420
    left, right, top, bottom = 72, 32, 56, 60
    plot_w = width - left - right
    plot_h = height - top - bottom
    bins = 10
    min_r, max_r = min(residuals), max(residuals)
    if min_r == max_r:
        min_r -= 1
        max_r += 1
    step = (max_r - min_r) / bins
    counts = [0] * bins
    for value in residuals:
        idx = min(bins - 1, int((value - min_r) / step))
        counts[idx] += 1
    max_count = max(counts) or 1

    bars = []
    for i, count in enumerate(counts):
        x = left + (i / bins) * plot_w
        bar_w = plot_w / bins - 5
        bar_h = (count / max_count) * plot_h
        y = top + plot_h - bar_h
        bars.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{bar_h:.1f}" rx="4" fill="#2563EB" opacity="0.82"/>')

    zero_x = left + ((0 - min_r) / (max_r - min_r)) * plot_w
    return f"""<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" role="img">
<style>
  .title {{ font: 700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#111827; }}
  .label {{ font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#374151; }}
  .tick {{ font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#6B7280; }}
</style>
<rect width="100%" height="100%" fill="#FFFFFF"/>
<text x="{left}" y="32" class="title">Error Distribution: {html.escape(subject)}</text>
<line x1="{left}" y1="{top + plot_h}" x2="{left + plot_w}" y2="{top + plot_h}" stroke="#111827"/>
<line x1="{left}" y1="{top}" x2="{left}" y2="{top + plot_h}" stroke="#111827"/>
{''.join(bars)}
<line x1="{zero_x:.1f}" y1="{top}" x2="{zero_x:.1f}" y2="{top + plot_h}" stroke="#EF4444" stroke-dasharray="8 8" stroke-width="3"/>
<text x="{left}" y="{height - 22}" class="tick">{min_r:.1f} min</text>
<text x="{left + plot_w}" y="{height - 22}" text-anchor="end" class="tick">{max_r:.1f} min</text>
<text x="{left + plot_w / 2}" y="{height - 22}" text-anchor="middle" class="label">Prediction Error (Actual - Predicted)</text>
</svg>"""


def write_report(user_id, report_dir, subjects):
    matrix_rows = []
    cards = []
    for subject in subjects:
        xs = subject["estimated"]
        ys = subject["actual"]
        slope, intercept, _, residuals, metrics = regression(xs, ys)
        errors = sorted(
            [
                {"index": i, "estimated": xs[i], "actual": ys[i], "error": residuals[i]}
                for i in range(len(xs))
            ],
            key=lambda item: abs(item["error"]),
            reverse=True,
        )[:3]

        base = f"subject_{subject['subject_id']}_{slug(subject['name'])}"
        perf_file = f"{base}_performance.svg"
        dist_file = f"{base}_error_dist.svg"
        with open(os.path.join(report_dir, perf_file), "w", encoding="utf-8") as f:
            f.write(svg_scatter(subject["name"], xs, ys, slope, intercept, errors))
        with open(os.path.join(report_dir, dist_file), "w", encoding="utf-8") as f:
            f.write(svg_residuals(subject["name"], residuals))

        row = {
            "subject": subject["name"],
            "samples": len(xs),
            "mae": metrics["mae"],
            "rmse": metrics["rmse"],
            "r2": metrics["r2"],
            "bias": metrics["bias"],
            "performance_plot": perf_file,
            "error_distribution": dist_file,
        }
        matrix_rows.append(row)
        cards.append(row)

    csv_path = os.path.join(report_dir, "dynamic_model_performance_matrix.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("subject,samples,mae,rmse,r2,bias\n")
        for row in matrix_rows:
            f.write(
                f"\"{row['subject']}\",{row['samples']},{row['mae']:.4f},"
                f"{row['rmse']:.4f},{row['r2']:.4f},{row['bias']:.4f}\n"
            )

    matrix_table = "\n".join(
        f"<tr><td>{html.escape(row['subject'])}</td><td>{row['samples']}</td>"
        f"<td>{row['mae']:.2f}</td><td>{row['rmse']:.2f}</td>"
        f"<td>{row['r2']:.3f}</td><td>{row['bias']:+.2f}</td></tr>"
        for row in matrix_rows
    )
    chart_cards = "\n".join(
        f"""
        <section class="chart-card">
          <h2>{html.escape(row['subject'])}</h2>
          <div class="metrics">
            <span>{row['samples']} samples</span>
            <span>MAE {row['mae']:.2f} min</span>
            <span>R2 {row['r2']:.3f}</span>
          </div>
          <img src="{row['performance_plot']}" alt="Performance chart">
          <img src="{row['error_distribution']}" alt="Error distribution">
        </section>
        """
        for row in cards
    )

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    html_path = os.path.join(report_dir, "performance_report.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Smart Study Planner - ML Performance Report</title>
  <style>
    body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:#F8FAFC; color:#111827; }}
    header {{ padding:34px 42px 24px; background:#111827; color:white; }}
    header h1 {{ margin:0 0 8px; font-size:32px; }}
    header p {{ margin:0; color:#CBD5E1; }}
    main {{ padding:28px 42px 60px; }}
    .panel {{ background:white; border:1px solid #E5E7EB; border-radius:8px; padding:22px; margin-bottom:24px; box-shadow:0 1px 2px rgba(15,23,42,.05); }}
    h2 {{ margin:0 0 14px; font-size:22px; }}
    table {{ width:100%; border-collapse:collapse; font-size:14px; }}
    th {{ background:#1F2937; color:white; text-align:left; padding:11px; }}
    td {{ padding:10px 11px; border-bottom:1px solid #E5E7EB; }}
    tr:nth-child(even) td {{ background:#F9FAFB; }}
    .chart-card h2 {{ margin-top:0; }}
    .metrics {{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; }}
    .metrics span {{ background:#EEF2FF; color:#3730A3; padding:6px 10px; border-radius:999px; font-weight:600; font-size:13px; }}
    img {{ width:100%; display:block; border:1px solid #E5E7EB; border-radius:8px; margin:12px 0; background:white; }}
  </style>
</head>
<body>
  <header>
    <h1>Smart Study Planner ML Performance Report</h1>
    <p>User ID {user_id} - Generated {generated_at} - 50 committee ML test samples seeded</p>
  </header>
  <main>
    <section class="panel">
      <h2>Dynamic Model Performance Matrix</h2>
      <table>
        <thead><tr><th>Subject</th><th>Samples</th><th>MAE</th><th>RMSE</th><th>R2</th><th>Bias</th></tr></thead>
        <tbody>{matrix_table}</tbody>
      </table>
    </section>
    {chart_cards}
  </main>
</body>
</html>""")

    with open(os.path.join(report_dir, "report_summary.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": generated_at,
                "user_id": user_id,
                "html_report": html_path,
                "dynamic_matrix_csv": csv_path,
                "subjects": matrix_rows,
            },
            f,
            indent=2,
        )

    return html_path, csv_path, len(matrix_rows)


def main():
    parser = argparse.ArgumentParser(description="Generate a static HTML/SVG performance report.")
    parser.add_argument("--user_id", type=int, required=True)
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        """
        SELECT t.subject_id, s.name, t.estimated_minutes, t.actual_minutes
        FROM study_tasks t
        JOIN subjects s ON t.subject_id = s.id
        WHERE t.user_id = ?
          AND t.status = 2
          AND t.estimated_minutes > 0
          AND t.actual_minutes IS NOT NULL
        ORDER BY s.priority ASC, s.difficulty DESC, s.id ASC, t.completed_at ASC
        """,
        (args.user_id,),
    ).fetchall()
    conn.close()

    grouped = {}
    for subject_id, name, estimated, actual in rows:
        data = grouped.setdefault(
            subject_id,
            {"subject_id": subject_id, "name": name, "estimated": [], "actual": []},
        )
        if actual <= estimated * 3:
            data["estimated"].append(float(estimated))
            data["actual"].append(float(actual))

    subjects = [data for data in grouped.values() if len(data["estimated"]) >= 3]
    report_dir = os.path.join(REPORTS_DIR, f"user_{args.user_id}")
    os.makedirs(report_dir, exist_ok=True)
    html_path, csv_path, subject_count = write_report(args.user_id, report_dir, subjects)

    print(f"Static performance report generated for user_id={args.user_id}")
    print(f"Subjects included: {subject_count}")
    print(f"HTML report: {html_path}")
    print(f"Dynamic matrix CSV: {csv_path}")


if __name__ == "__main__":
    main()
