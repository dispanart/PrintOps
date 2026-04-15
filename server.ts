import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite Database
const db = new Database('printops.db');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ip TEXT NOT NULL,
    isSC170 INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle',
    lastCounter INTEGER DEFAULT 0,
    lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machineId TEXT NOT NULL,
    counter INTEGER NOT NULL,
    status TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machineId) REFERENCES machines(id)
  );

  CREATE TABLE IF NOT EXISTS consumables (
    machineId TEXT NOT NULL,
    consumableId TEXT NOT NULL,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (machineId, consumableId),
    FOREIGN KEY (machineId) REFERENCES machines(id)
  );

  CREATE TABLE IF NOT EXISTS consumable_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machineId TEXT NOT NULL,
    consumableId TEXT NOT NULL,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machineId) REFERENCES machines(id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machineId TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machineId) REFERENCES machines(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Endpoints ---

  /**
   * POST /api/machine-log
   * Receives data from the Local Agent
   */
  app.post('/api/machine-log', (req, res) => {
    const { machineId, counter, status: reportedStatus, consumables, jobs } = req.body;

    if (!machineId) return res.status(400).json({ error: 'machineId is required' });

    try {
      // 1. Get current machine
      const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(machineId) as any;
      if (!machine) return res.status(404).json({ error: 'Machine not found' });

      let finalStatus = reportedStatus || 'idle';
      
      // Determine status based on counter
      if (counter > machine.lastCounter) {
        finalStatus = 'running';
      } else if (finalStatus !== 'error') {
        finalStatus = 'idle';
      }

      // 2. Update Machine
      db.prepare(`
        UPDATE machines 
        SET status = ?, lastCounter = ?, lastSeen = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(finalStatus, counter, machineId);

      // Log status change if needed
      if (machine.status !== finalStatus || counter !== machine.lastCounter) {
        db.prepare(`
          INSERT INTO logs (machineId, counter, status) 
          VALUES (?, ?, ?)
        `).run(machineId, counter, finalStatus);
      }

      // 3. Update Consumables
      if (consumables && Array.isArray(consumables)) {
        for (const c of consumables) {
          const cId = c.name.toLowerCase().replace(/\s+/g, '-');
          
          const currentC = db.prepare('SELECT level FROM consumables WHERE machineId = ? AND consumableId = ?').get(machineId, cId) as any;
          
          let logNeeded = true;
          if (currentC && currentC.level === c.level) {
            logNeeded = false;
          }

          db.prepare(`
            INSERT INTO consumables (machineId, consumableId, name, level, lastUpdated)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(machineId, consumableId) DO UPDATE SET
              level = excluded.level,
              lastUpdated = CURRENT_TIMESTAMP
          `).run(machineId, cId, c.name, c.level);

          if (logNeeded) {
            db.prepare(`
              INSERT INTO consumable_logs (machineId, consumableId, name, level)
              VALUES (?, ?, ?, ?)
            `).run(machineId, cId, c.name, c.level);
          }
        }
      }

      // 4. Update Jobs (for SC170)
      if (jobs && Array.isArray(jobs)) {
        for (const job of jobs) {
          db.prepare(`
            INSERT INTO jobs (machineId, name, status)
            VALUES (?, ?, ?)
          `).run(machineId, job.name, job.status);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error processing machine log:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/machines
   * Returns all machines (used by Agent to know what to monitor)
   */
  app.get('/api/machines', (req, res) => {
    try {
      const machines = db.prepare('SELECT * FROM machines').all();
      res.json(machines);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch machines' });
    }
  });

  /**
   * POST /api/machines
   * Add a new machine from the dashboard
   */
  app.post('/api/machines', (req, res) => {
    const { name, ip, isSC170 } = req.body;
    if (!name || !ip) return res.status(400).json({ error: 'Name and IP are required' });

    try {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
      db.prepare(`
        INSERT INTO machines (id, name, ip, isSC170, status, lastCounter)
        VALUES (?, ?, ?, ?, 'idle', 0)
      `).run(id, name, ip, isSC170 ? 1 : 0);
      
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add machine' });
    }
  });

  /**
   * DELETE /api/machines/:id
   * Delete a machine
   */
  app.delete('/api/machines/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM jobs WHERE machineId = ?').run(id);
      db.prepare('DELETE FROM consumable_logs WHERE machineId = ?').run(id);
      db.prepare('DELETE FROM consumables WHERE machineId = ?').run(id);
      db.prepare('DELETE FROM logs WHERE machineId = ?').run(id);
      db.prepare('DELETE FROM machines WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete machine' });
    }
  });

  /**
   * GET /api/dashboard
   * Returns all machines with current status and alerts
   */
  app.get('/api/dashboard', (req, res) => {
    try {
      const machines = db.prepare('SELECT * FROM machines').all() as any[];
      const dashboardData = [];

      const allAlerts: any[] = [];
      const machinesWithAlerts = machines.map(m => {
        const alerts = [];
        
        // Check stale (SQLite CURRENT_TIMESTAMP is UTC)
        const lastSeenDate = new Date(m.lastSeen + 'Z'); 
        const isStale = (Date.now() - lastSeenDate.getTime()) > 5 * 60 * 1000;
        
        if (m.status === 'error') {
          const alert = { type: 'machine_error', message: `${m.name} reported an error state.` };
          alerts.push(alert);
          allAlerts.push(alert);
        }
        if (isStale) {
          const alert = { type: 'warning', message: `${m.name} has not reported data in over 5 minutes.` };
          alerts.push(alert);
          allAlerts.push(alert);
        }

        // Consumables
        const consumables = db.prepare('SELECT * FROM consumables WHERE machineId = ?').all(m.id) as any[];
        let hasLowConsumable = false;
        let consumableSummary = '';

        const lowConsumables = consumables.filter(c => c.level < 20);
        if (lowConsumables.length > 0) {
          hasLowConsumable = true;
          consumableSummary = lowConsumables.map(c => `${c.name} (${c.level}%)`).join(', ');
          const alert = { type: 'warning', message: `${m.name} has low consumables: ${consumableSummary}` };
          alerts.push(alert);
          allAlerts.push(alert);
        }

        // Format dates for frontend (Frontend expects { seconds: ... })
        const lastSeenSeconds = Math.floor(lastSeenDate.getTime() / 1000);

        return {
          ...m,
          lastSeen: { seconds: lastSeenSeconds },
          isSC170: m.isSC170 === 1,
          hasLowConsumable,
          consumableSummary,
          alerts
        };
      });

      res.json({
        machines: machinesWithAlerts,
        alerts: allAlerts
      });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/production
   * Returns production stats (mocked for now)
   */
  app.get('/api/production', (req, res) => {
    res.json([]);
  });

  /**
   * GET /api/machine/:id
   * Returns detailed data for a specific machine
   */
  app.get('/api/machine/:id', (req, res) => {
    const { id } = req.params;

    try {
      const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(id) as any;
      if (!machine) return res.status(404).json({ error: 'Not found' });

      machine.lastSeen = { seconds: Math.floor(new Date(machine.lastSeen + 'Z').getTime() / 1000) };
      machine.isSC170 = machine.isSC170 === 1;

      const consumables = db.prepare('SELECT * FROM consumables WHERE machineId = ?').all(id).map((c: any) => ({
        ...c, lastUpdated: { seconds: Math.floor(new Date(c.lastUpdated + 'Z').getTime() / 1000) }
      }));
      
      const consumableLogs = db.prepare('SELECT * FROM consumable_logs WHERE machineId = ? ORDER BY createdAt DESC LIMIT 50').all(id).map((l: any) => ({
        ...l, createdAt: { seconds: Math.floor(new Date(l.createdAt + 'Z').getTime() / 1000) }
      }));
      
      const logs = db.prepare('SELECT * FROM logs WHERE machineId = ? ORDER BY createdAt DESC LIMIT 50').all(id).map((l: any) => ({
        ...l, createdAt: { seconds: Math.floor(new Date(l.createdAt + 'Z').getTime() / 1000) }
      }));
      
      const jobs = db.prepare('SELECT * FROM jobs WHERE machineId = ? ORDER BY createdAt DESC LIMIT 50').all(id).map((j: any) => ({
        ...j, createdAt: { seconds: Math.floor(new Date(j.createdAt + 'Z').getTime() / 1000) }
      }));

      res.json({
        machine,
        consumables,
        consumableLogs,
        logs,
        jobs
      });
    } catch (error) {
      console.error('Error fetching machine details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
