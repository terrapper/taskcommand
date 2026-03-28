# Hourly Task Worker — Cron Prompt

Paste this into a Claude Code session to re-establish the hourly worker cron:

```
Set up an hourly cron job (at :17 past each hour) that reads tasks from Agency/deliverables/task-dashboard/tasks.json, works through pending tasks by priority (critical > high > medium > low). For each task: (1) IMMEDIATELY set status to "in_progress" in tasks.json and log "[TIMESTAMP] CRON STARTED task TITLE [PRIORITY] (ID)" to tasks.log BEFORE doing any work, (2) execute the real work, (3) set status to "completed" with completedAt timestamp, add a log entry to the task's log array, and log completion to tasks.log. If no tasks are pending, log a check and stop. Follow Agency procedures from CLAUDE.md for complex tasks.
```

The cron is session-only — it runs while Claude Code is open and auto-expires after 7 days.
