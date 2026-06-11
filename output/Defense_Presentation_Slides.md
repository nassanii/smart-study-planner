# Smart Study Planner — Senior Project Defense
## Presentation Slides (clear & simple)

> **3 presenters · ≤ 5 min each.** 
> Speaker 1 = Intro + App · Speaker 2 = Backend · Speaker 3 = AI
> Each slide = **exactly 4 points.**

---
---

# SPEAKER 1 · Introduction + The App  (6 slides)

---

### SLIDE 1 — Smart Study Planner
- An AI-powered planner that builds your study day automatically.
- Replaces traditional manual planners with an intelligent scheduling system.
- Designed to adapt to the unique needs of every student.
- Created by: [Your Name 1], [Your Name 2], [Your Name 3].

---

### SLIDE 2 — The Problem
- Students juggle multiple courses, complex deadlines, and overlapping exams.
- Traditional planners are empty calendars requiring tedious manual scheduling.
- They ignore personal study habits, varying course difficulty, and fatigue.
- This leads to severe procrastination, last-minute cramming, and student burnout.

---

### SLIDE 3 — Our Solution
- An intelligent app that constructs your daily study plan automatically.
- Learns exactly how much time specific subjects take you to complete.
- Proactively monitors fatigue and eases your schedule to prevent burnout.
- Acts as a dedicated, personalized study coach rather than a basic to-do list.

---

### SLIDE 4 — System Architecture
- The platform consists of three core components working together seamlessly.
- **Mobile App:** The intuitive interface where students manage their academic life.
- **Backend API:** The secure engine room that stores data and handles core logic.
- **AI Engine:** The smart service that processes data to generate personalized plans.

---

### SLIDE 5 — The Mobile App (Frontend)
- Developed using React Native to support both iOS and Android natively.
- Features a clean, modern interface complete with Dark and Light modes.
- Ensures a reliable experience by gracefully handling errors without crashing.
- Keeps users securely logged in while maintaining high performance.
- **Real-Time Global State Syncing:** Uses React Context to instantly update the Dashboard and sync with the database when a timer finishes, without reloading.
- **Gamified In-App Notifications:** Dynamically celebrates finished tasks with randomized gamified messages to maintain student motivation.

---

### SLIDE 6 — Key Features
- **Setup & Dashboard:** Easily add courses and view today's plan with a wellness check.
- **One-Tap Planning:** Instantly build your whole day by tapping "Generate AI Plan".
- **Focus Timer:** Study using the Pomodoro technique and rate your focus afterwards.
- **Analytics:** Track upcoming exams, task completion streaks, and overall progress.
- **Advanced Focus Timer:** Tracks "Overtime" and allows "Snoozing" with specific reasons to feed behavioral data back to the AI.
- **Seamless "Up Next" Transitions:** Smoothly previews the next scheduled AI block and transitions the user automatically to maintain the "flow state."
- **Interactive Event Calendar:** Features a dynamic hour-by-hour timeline with an auto-scrolling "now" indicator to manage fixed commitments visually.

---
---

# SPEAKER 2 · The Backend  (5 slides)

---

### SLIDE 7 — The Backend's Role
- Serves as the central "engine room" and single source of truth for all data.
- Actively manages user accounts, courses, tasks, and generated schedules.
- Built with .NET 8 using clean architecture to ensure easy maintenance.
- Designed to easily scale as the number of students and requests grows.

---

### SLIDE 8 — Security & Privacy
- Protects accounts with secure, automatically expiring authentication tokens.
- Ensures passwords are encrypted and never stored or transmitted as plain text.
- Guarantees strict data isolation so every user sees only their personal information.
- Safely processes concurrent requests without mixing data between different students.

---

### SLIDE 9 — Database & Data Management
- Utilizes a structured relational database to map complex student data reliably.
- Efficiently connects users to their specific tasks, schedules, and learning profiles.
- Ensures high data integrity so no records are lost or corrupted during updates.
- Designed to easily transition from SQLite to PostgreSQL for larger scale deployments.

---

### SLIDE 10 — Reliability & Error Handling
- Validates every incoming request strictly so malformed data cannot enter the system.
- Returns clear, developer-friendly error messages to the frontend if something fails.
- Automatically retries requests to the AI service if there are temporary network delays.
- Features fallback mechanisms to ensure the system stays online during critical periods.

---

### SLIDE 11 — Building Your Schedule
- Gathers all required context: tasks, courses, available free time, and deadlines.
- Packages this data and securely transmits it to the AI Engine for processing.
- Receives the newly generated schedule, saves it to the database, and alerts the user.
- Strictly respects fixed commitments like classes or work, never scheduling over them.

---
---

# SPEAKER 3 · The AI Engine  (8 slides)

---

### SLIDE 12 — The Brain of the App
- Operates as a dedicated, standalone AI service to create individualized study plans.
- Eliminates the need for manual time-blocking by calculating optimal study periods.
- Continuously assesses if a student is approaching academic burnout.
- Determines the true, realistic time required for a student to complete specific tasks.

---

### SLIDE 13 — How It Learns From You
- **Burnout Model:** Uses Logistic Regression to predict fatigue based on study hours and focus.
- **Difficulty Model:** Uses Linear Regression (per subject) to predict how long tasks really take.
- Creates a highly personalized learning model rather than applying generic rules.
- Adapts and changes its recommendations as your study habits evolve over the semester.

---

### SLIDE 14 — Continuous Learning
- **Recency Weighting:** Applies a linear ramp vector (0.5 to 1.0) to sample weights in the Linear Regression, prioritizing recent behavioral data.
- **Continuous Retraining:** Implements an automated retraining loop triggered every `RETRAIN_INTERVAL = 10` completed tasks per subject.
- **Performance Tracking:** Calculates and logs real-time evaluation metrics (Mean Absolute Error, R² Score, and Logistic Accuracy) to a persistent metrics store.

---

### SLIDE 15 — Validating ML Accuracy
- **Automated Visual Analytics:** Features a built-in visualization pipeline using Matplotlib and Seaborn to validate model performance scientifically.
- **Regression Analysis:** Programmatically generates plots comparing AI estimated times against actual completion times.
- **Error Distribution:** Generates residual error KDE (Kernel Density Estimation) histograms to identify and correct model bias.
- **Accuracy Gauges:** Provides real-time visual gauges tracking the Logistic Regression confidence for burnout prediction.

---

### SLIDE 16 — Smart From Day One
- Solves the "cold start" problem for new users who haven't generated any data yet.
- Initially applies smart, science-backed default rules for safe study scheduling.
- Smoothly transitions to real machine learning as you log more tasks and sessions.
- The real Machine Learning models activate only after a student has completed 40 tasks.
- Guarantees the schedule becomes more accurate and personalized every single day.
- **Outlier Filtering:** Pre-processes datasets by applying an exclusion threshold (`actual > 3.0 * estimated`) to filter anomalous timer inputs before fitting the regression line.
- **Synthetic Data Bootstrapping:** Resolves the "cold start" problem by generating 100 mathematically derived synthetic bootstrap samples to pre-train the Logistic Regression weights before gathering empirical data.

---

### SLIDE 17 — Creating the Plan
- Integrates with Google's Gemini AI to dynamically construct the actual timetable.
- Strictly follows proven study science, enforcing 50-minute study and 10-minute break cycles.
- Prevents cognitive overload by strategically rotating difficult subjects throughout the day.
- Always plans around your fixed commitments, treating classes and work as unmovable.
- **Urgency Handling:** Dynamically scales estimation parameters based on the calculated `days_remaining` to prompt Gemini into adopting aggressive scheduling profiles.
- **Advanced Rotation Heuristics:** Enforces algorithmic rules during prompt generation to postpone subjects with `consecutive_days_studied >= 3` and prioritize those with `days_since_last_study > 3`.

---

### SLIDE 18 — The Backup System
- Acknowledges that external AI services can occasionally be unpredictable or slow.
- Includes a robust, built-in deterministic planner that takes over if the AI fails.
- Automatically triggers this fallback mechanism instantly without user intervention.
- Guarantees the student will always receive a valid study plan, no matter what happens.

---

### SLIDE 19 — Conclusion & Future Work
- **Summary:** We built a personalized study coach that learns, plans, and protects students.
- **Integration:** Successfully combined a Mobile App, Backend, and AI into one cohesive system.
- **Future Steps:** Adding weekly recurring tasks, full offline mode, and advanced analytics.
- **Q&A:** Thank you for your time, we are now open to taking your questions.
