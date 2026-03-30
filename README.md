# TaskCommand

A local task dashboard with an autonomous AI worker system. Queue tasks via a sleek web UI, and let Claude Code (or any AI agent) process them automatically.

![TaskCommand](https://img.shields.io/badge/status-active-00d4ff) ![Node](https://img.shields.io/badge/node-%3E%3D18-34d399) ![License](https://img.shields.io/badge/license-MIT-a78bfa)

## What It Does

TaskCommand is a local Express server with a browser-based dashboard for managing tasks. It's designed to pair with an AI coding assistant (like Claude Code) that polls the task queue and executes work autonomously.

**The loop:**
1. You add tasks via the web UI at `http://localhost:3847`
2. An AI agent reads `tasks.json`, picks up pending tasks, does the work, and marks them complete
3. You come back to finished deliverables

## Features

- **Task Management** -- Create, edit, delete, and prioritize tasks with titles, descriptions, context fields, due dates, and file attachments
- **Priority System** -- Critical / High / Medium / Low with color-coded indicators and sorted views
- **Execute Now** -- Flag any task for immediate processing by the AI worker
- **Deliverable Links** -- Completed tasks display output file paths extracted from worker summaries
- **Bulk Actions** -- Multi-select tasks to archive, delete, or reprioritize in batch
- **Missing Input Detection** -- Warns you if your description mentions attachments but none are uploaded
- **Activity Log** -- Real-time log of all task operations in the right panel
- **Task Archive** -- Archive any task to keep the queue clean, with a dedicated archive view to browse and inspect past tasks
- **Mobile Responsive** -- Works on phones and tablets with adaptive layout and floating action button
- **Smart Auto-Refresh** -- Refreshes every 30s but pauses when you're typing or have a modal open

## Quick Start

```bash
# Clone
git clone https://github.com/terrapper/taskcommand.git
cd taskcommand

# Install dependencies
npm install

# Start the server
npm start
```

Open `http://localhost:3847` in your browser.

## Usage with Claude Code

TaskCommand is designed to work with Claude Code's cron system. Add this to your `CLAUDE.md` or run at session start:

```
# Start the server
cd path/to/taskcommand && node server.js &

# Set up hourly worker cron (via CronCreate)
# The worker reads tasks.json, processes pending tasks, and marks them complete
```

The included `CRON-PROMPT.md` contains the full autonomous worker prompt that:
- Reads `tasks.json` and filters to pending/in_progress tasks
- Sets status to `in_progress` before starting work
- Executes the task
- Marks completed with a summary and timestamp
- Logs all activity to `tasks.log`

### Execute Now

Click the play button on any task or use the "Execute Now" button in the detail panel. This flags the task for immediate pickup. In Claude Code, type `run tasks` to trigger the worker.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create a task (multipart/form-data for attachments) |
| `GET` | `/api/tasks/:id` | Get a single task |
| `PUT` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `POST` | `/api/tasks/:id/execute` | Flag for immediate execution |
| `DELETE` | `/api/tasks/:id/attachments/:attId` | Remove an attachment |
| `POST` | `/api/tasks/bulk/archive` | Archive selected tasks (or all completed if no IDs) |
| `POST` | `/api/tasks/bulk/delete` | Delete multiple tasks |
| `POST` | `/api/tasks/bulk/priority` | Change priority for multiple tasks |
| `GET` | `/api/archive` | List archived tasks |
| `GET` | `/api/log` | Get activity log |
| `GET` | `/api/stats` | Get task counts and stats |

## Task Schema

```json
{
  "id": "uuid",
  "title": "Task title",
  "description": "Detailed description",
  "context": "Background info for the AI worker",
  "priority": "critical | high | medium | low",
  "status": "pending | in_progress | completed",
  "dueDate": "2026-03-28",
  "assignee": "Name",
  "attachments": [{ "id": "uuid", "originalName": "file.pdf", "url": "/uploads/..." }],
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "completedAt": "ISO timestamp or null",
  "executeNow": false,
  "log": [{ "timestamp": "ISO", "action": "completed", "summary": "What was done" }]
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | New task |
| `Esc` | Close modal / exit bulk mode |

## Tech Stack

- **Server:** Express.js with Multer for file uploads
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Fonts:** Instrument Serif, Outfit, IBM Plex Mono (Google Fonts)
- **Icons:** Phosphor Icons
- **Storage:** JSON files (`tasks.json`, `tasks-archive.json`, `tasks.log`)

## File Structure

```
taskcommand/
  server.js          # Express API server
  public/
    index.html       # Dashboard UI (single file)
  package.json
  start.sh           # Quick-start script
  CRON-PROMPT.md     # Autonomous worker prompt template
  tasks.json         # Active task queue (auto-created)
  tasks-archive.json # Archived tasks (auto-created)
  tasks.log          # Activity log (auto-created)
  uploads/           # File attachments (auto-created)
```

## License

MIT
