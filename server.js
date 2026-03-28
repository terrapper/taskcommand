const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3847;

const DATA_DIR = __dirname;
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const ARCHIVE_FILE = path.join(DATA_DIR, 'tasks-archive.json');
const LOG_FILE = path.join(DATA_DIR, 'tasks.log');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure directories/files exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(TASKS_FILE)) fs.writeFileSync(TASKS_FILE, '[]');
if (!fs.existsSync(ARCHIVE_FILE)) fs.writeFileSync(ARCHIVE_FILE, '[]');
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer config for attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Helpers
function readTasks() {
  const raw = fs.readFileSync(TASKS_FILE, 'utf-8');
  return JSON.parse(raw || '[]');
}

function writeTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function readArchive() {
  const raw = fs.readFileSync(ARCHIVE_FILE, 'utf-8');
  return JSON.parse(raw || '[]');
}

function writeArchive(tasks) {
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(tasks, null, 2));
}

function log(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, entry);
}

// Priority values for sorting (lower = higher priority)
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// ── API Routes ──

// GET all tasks
app.get('/api/tasks', (req, res) => {
  const tasks = readTasks();
  res.json(tasks);
});

// POST create task
app.post('/api/tasks', upload.array('attachments', 10), (req, res) => {
  const tasks = readTasks();
  const { title, description, context, priority, dueDate, assignee } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const attachments = (req.files || []).map(f => ({
    id: uuidv4(),
    originalName: f.originalname,
    filename: f.filename,
    size: f.size,
    mimetype: f.mimetype,
    url: `/uploads/${f.filename}`
  }));

  const task = {
    id: uuidv4(),
    title: title.trim(),
    description: (description || '').trim(),
    context: (context || '').trim(),
    priority: priority || 'medium',
    status: 'pending',
    dueDate: dueDate || null,
    assignee: (assignee || '').trim() || null,
    attachments,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    log: []
  };

  tasks.push(task);
  writeTasks(tasks);
  log(`CREATED task "${task.title}" [${task.priority}] (${task.id})`);
  res.status(201).json(task);
});

// POST bulk archive — move completed tasks to archive
app.post('/api/tasks/bulk/archive', (req, res) => {
  const tasks = readTasks();
  const archive = readArchive();
  const { ids } = req.body || {};

  let toArchive;
  if (ids && Array.isArray(ids) && ids.length > 0) {
    // Archive only specified tasks (must be completed)
    toArchive = tasks.filter(t => ids.includes(t.id) && t.status === 'completed');
  } else {
    // Archive ALL completed tasks
    toArchive = tasks.filter(t => t.status === 'completed');
  }

  if (toArchive.length === 0) {
    return res.json({ archived: 0 });
  }

  const archivedIds = new Set(toArchive.map(t => t.id));

  // Add archived timestamp and move to archive
  toArchive.forEach(t => {
    t.archivedAt = new Date().toISOString();
    archive.push(t);
  });

  // Remove archived tasks from active list
  const remaining = tasks.filter(t => !archivedIds.has(t.id));

  writeArchive(archive);
  writeTasks(remaining);
  log(`ARCHIVED ${toArchive.length} completed task(s)`);
  res.json({ archived: toArchive.length });
});

// POST bulk delete — delete multiple tasks at once
app.post('/api/tasks/bulk/delete', (req, res) => {
  const { ids } = req.body || {};

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }

  let tasks = readTasks();
  const idsSet = new Set(ids);
  const toDelete = tasks.filter(t => idsSet.has(t.id));

  // Clean up attachment files for each deleted task
  toDelete.forEach(task => {
    (task.attachments || []).forEach(att => {
      const filePath = path.join(UPLOADS_DIR, att.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
  });

  const remaining = tasks.filter(t => !idsSet.has(t.id));
  writeTasks(remaining);
  log(`BULK DELETED ${toDelete.length} task(s)`);
  res.json({ deleted: toDelete.length });
});

// POST bulk priority — change priority for multiple tasks
app.post('/api/tasks/bulk/priority', (req, res) => {
  const { ids, priority } = req.body || {};

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }

  const validPriorities = ['critical', 'high', 'medium', 'low'];
  if (!priority || !validPriorities.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${validPriorities.join(', ')}` });
  }

  const tasks = readTasks();
  const idsSet = new Set(ids);
  let updated = 0;

  tasks.forEach(task => {
    if (idsSet.has(task.id)) {
      task.priority = priority;
      task.updatedAt = new Date().toISOString();
      updated++;
    }
  });

  writeTasks(tasks);
  log(`BULK PRIORITY changed ${updated} task(s) to "${priority}"`);
  res.json({ updated });
});

// GET archived tasks
app.get('/api/archive', (req, res) => {
  const archive = readArchive();
  res.json(archive);
});

// GET single task
app.get('/api/tasks/:id', (req, res) => {
  const tasks = readTasks();
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// PUT update task
app.put('/api/tasks/:id', upload.array('attachments', 10), (req, res) => {
  const tasks = readTasks();
  const idx = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const { title, description, context, priority, status, dueDate, assignee } = req.body;
  const task = tasks[idx];

  if (title !== undefined) task.title = title.trim();
  if (description !== undefined) task.description = description.trim();
  if (context !== undefined) task.context = context.trim();
  if (priority !== undefined) task.priority = priority;
  if (status !== undefined) {
    const oldStatus = task.status;
    task.status = status;
    if (status === 'completed' && oldStatus !== 'completed') {
      task.completedAt = new Date().toISOString();
    }
    if (status !== 'completed') {
      task.completedAt = null;
    }
  }
  if (dueDate !== undefined) task.dueDate = dueDate || null;
  if (assignee !== undefined) task.assignee = assignee.trim() || null;

  // Append new attachments
  if (req.files && req.files.length > 0) {
    const newAttachments = req.files.map(f => ({
      id: uuidv4(),
      originalName: f.originalname,
      filename: f.filename,
      size: f.size,
      mimetype: f.mimetype,
      url: `/uploads/${f.filename}`
    }));
    task.attachments = [...(task.attachments || []), ...newAttachments];
  }

  task.updatedAt = new Date().toISOString();
  tasks[idx] = task;
  writeTasks(tasks);
  log(`UPDATED task "${task.title}" [${task.priority}/${task.status}] (${task.id})`);
  res.json(task);
});

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
  let tasks = readTasks();
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Clean up attachment files
  (task.attachments || []).forEach(att => {
    const filePath = path.join(UPLOADS_DIR, att.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  tasks = tasks.filter(t => t.id !== req.params.id);
  writeTasks(tasks);
  log(`DELETED task "${task.title}" (${task.id})`);
  res.json({ success: true });
});

// DELETE single attachment
app.delete('/api/tasks/:id/attachments/:attId', (req, res) => {
  const tasks = readTasks();
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const att = (task.attachments || []).find(a => a.id === req.params.attId);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  const filePath = path.join(UPLOADS_DIR, att.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  task.attachments = task.attachments.filter(a => a.id !== req.params.attId);
  task.updatedAt = new Date().toISOString();
  writeTasks(tasks);
  log(`REMOVED attachment "${att.originalName}" from task "${task.title}"`);
  res.json(task);
});

// POST execute now — flag a task for immediate processing
app.post('/api/tasks/:id/execute', (req, res) => {
  const tasks = readTasks();
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status === 'completed') return res.status(400).json({ error: 'Task already completed' });

  task.executeNow = true;
  task.status = 'in_progress';
  task.updatedAt = new Date().toISOString();
  task.log = task.log || [];
  task.log.push({
    timestamp: new Date().toISOString(),
    action: 'execute_now',
    summary: 'Flagged for immediate execution by user'
  });

  writeTasks(tasks);
  log(`EXECUTE NOW requested for task "${task.title}" [${task.priority}] (${task.id})`);
  res.json(task);
});

// GET activity log
app.get('/api/log', (req, res) => {
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean).reverse();
  res.json({ lines });
});

// GET stats
app.get('/api/stats', (req, res) => {
  const tasks = readTasks();
  const total = tasks.length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const byPriority = {
    critical: tasks.filter(t => t.priority === 'critical' && t.status !== 'completed').length,
    high: tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
    medium: tasks.filter(t => t.priority === 'medium' && t.status !== 'completed').length,
    low: tasks.filter(t => t.priority === 'low' && t.status !== 'completed').length,
  };
  res.json({ total, pending, inProgress, completed, byPriority });
});

app.listen(PORT, () => {
  console.log(`\n  Task Dashboard running at http://localhost:${PORT}\n`);
  log('SERVER started');
});
