import argparse
import os
import sqlite3
from datetime import datetime, timedelta, timezone


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


def iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


def date_str(dt: datetime) -> str:
    return dt.date().isoformat()


def seed_completed_tasks(conn: sqlite3.Connection, user_id: int, sample_count: int) -> int:
    subjects = conn.execute(
        """
        SELECT id, name, difficulty, priority
        FROM subjects
        WHERE user_id = ?
        ORDER BY priority ASC, difficulty DESC, id ASC
        """,
        (user_id,),
    ).fetchall()

    if not subjects:
        raise RuntimeError(f"No subjects found for user_id={user_id}. Run the app seed first.")

    conn.execute(
        "DELETE FROM study_tasks WHERE user_id = ? AND tag = 'Committee ML Test'",
        (user_id,),
    )

    now = datetime.now(timezone.utc)
    rows = []

    for index in range(sample_count):
        subject_id, subject_name, difficulty, priority = subjects[index % len(subjects)]
        subject_factor = 0.86 + (difficulty * 0.035) + (priority * 0.025)
        cycle = index // len(subjects)
        estimated = 35 + ((index * 11) % 70)
        residual_pattern = [-9, -4, 3, 7, 12][index % 5]
        actual = int(round(estimated * subject_factor + residual_pattern + (cycle % 3) * 2))
        actual = max(20, min(actual, int(estimated * 2.2)))
        completed_at = now - timedelta(days=sample_count - index, hours=index % 6)
        created_at = completed_at - timedelta(days=2 + (index % 5), hours=2)

        rows.append(
            (
                user_id,
                subject_id,
                f"Committee ML Test {index + 1:02d}: {subject_name}",
                priority,
                difficulty,
                estimated,
                actual,
                index % 6,
                2 + (index % 5),
                2,
                date_str(completed_at + timedelta(days=10 + (index % 18))),
                None,
                0,
                "Committee ML Test",
                iso(completed_at),
                iso(created_at),
                iso(completed_at),
            )
        )

    conn.executemany(
        """
        INSERT INTO study_tasks (
            user_id,
            subject_id,
            title,
            priority,
            difficulty_rating,
            estimated_minutes,
            actual_minutes,
            days_since_last_study,
            consecutive_days_studied,
            status,
            deadline,
            start_time,
            task_type,
            tag,
            completed_at,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    return len(rows)


def seed_behavioral_logs(conn: sqlite3.Connection, user_id: int, days: int = 35) -> int:
    now = datetime.now(timezone.utc)
    start_date = date_str(now - timedelta(days=days + 2))
    end_date = date_str(now)

    conn.execute(
        """
        DELETE FROM behavioral_logs
        WHERE user_id = ? AND date >= ? AND date <= ?
        """,
        (user_id, start_date, end_date),
    )

    rows = []
    for offset in range(days):
        day = now - timedelta(days=days - offset - 1)
        high_risk_day = offset % 9 in (6, 7)
        if high_risk_day:
            snoozes = 4 + (offset % 3)
            hours = round(4.4 + ((offset % 4) * 0.35), 2)
            focus = round(2.2 + ((offset % 3) * 0.25), 2)
            ratings = "[2,3,2]"
        else:
            snoozes = offset % 2
            hours = round(1.6 + ((offset % 6) * 0.38), 2)
            focus = round(4.0 + ((offset % 4) * 0.22), 2)
            ratings = "[4,5,4]"

        rows.append((user_id, date_str(day), snoozes, hours, focus, ratings))

    conn.executemany(
        """
        INSERT INTO behavioral_logs (
            user_id,
            date,
            snooze_count,
            study_hours,
            avg_focus_rating,
            last_focus_ratings_json
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed committee demo ML evaluation data.")
    parser.add_argument("--user_id", type=int, default=5)
    parser.add_argument("--samples", type=int, default=50)
    args = parser.parse_args()

    if not 40 <= args.samples <= 50:
        raise SystemExit("--samples must be between 40 and 50 for the committee demo.")

    conn = sqlite3.connect(DB_PATH)
    try:
        user = conn.execute(
            "SELECT id, email, name FROM AspNetUsers WHERE id = ?",
            (args.user_id,),
        ).fetchone()
        if not user:
            raise RuntimeError(f"User {args.user_id} was not found in the database.")

        tasks = seed_completed_tasks(conn, args.user_id, args.samples)
        logs = seed_behavioral_logs(conn, args.user_id)
        conn.commit()
    finally:
        conn.close()

    print(f"Seeded user_id={args.user_id}")
    print(f"Completed ML test samples: {tasks}")
    print(f"Behavioral log samples: {logs}")


if __name__ == "__main__":
    main()
