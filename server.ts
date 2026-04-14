import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  collection, 
  serverTimestamp, 
  setDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp,
  startAt,
  endAt
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

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
  app.post('/api/machine-log', async (req, res) => {
    const { machineId, counter, status: reportedStatus, consumables, jobs } = req.body;

    if (!machineId) return res.status(400).json({ error: 'machineId is required' });

    try {
      const machineRef = doc(db, 'machines', machineId);
      const machineSnap = await getDoc(machineRef);

      if (!machineSnap.exists()) return res.status(404).json({ error: 'Machine not found' });

      const machineData = machineSnap.data();
      const lastCounter = machineData.lastCounter || 0;
      const lastSeen = machineData.lastSeen?.toDate() || new Date(0);
      const now = new Date();

      // Logic: Determine status
      let finalStatus = reportedStatus || 'idle';
      if (counter > lastCounter) {
        finalStatus = 'running';
      } else {
        const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
        if (diffSeconds > 60) finalStatus = 'idle';
        else finalStatus = machineData.status || 'running';
      }

      // 1. Update Machine Master
      await updateDoc(machineRef, {
        status: finalStatus,
        lastCounter: counter,
        lastSeen: serverTimestamp()
      });

      // 2. Store Machine Log
      await addDoc(collection(db, 'machines', machineId, 'logs'), {
        machineId,
        counter,
        status: finalStatus,
        createdAt: serverTimestamp()
      });

      // 3. Update Consumables
      if (consumables && Array.isArray(consumables)) {
        for (const c of consumables) {
          const cId = c.name.toLowerCase().replace(/\s+/g, '-');
          const mcRef = doc(db, 'machines', machineId, 'consumables', cId);
          await setDoc(mcRef, {
            machineId,
            consumableId: cId,
            name: c.name,
            level: c.level,
            lastUpdated: serverTimestamp()
          }, { merge: true });
        }
      }

      // 4. Store Jobs (SC170 only logic usually handled by agent filtering)
      if (jobs && Array.isArray(jobs)) {
        for (const job of jobs) {
          await addDoc(collection(db, 'machines', machineId, 'jobs'), {
            name: job.name,
            status: job.status,
            createdAt: serverTimestamp()
          });
        }
      }

      res.json({ success: true, status: finalStatus });
    } catch (error) {
      console.error('Backend Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/dashboard
   * Returns all machines with current status and alerts
   */
  app.get('/api/dashboard', async (req, res) => {
    try {
      const q = query(collection(db, 'machines'));
      const snapshot = await getDocs(q);
      const machines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Basic alert detection
      const alerts = [];
      const machinesWithConsumables = [];

      for (const m of machines as any[]) {
        if (m.status === 'error') {
          alerts.push({ machineId: m.id, type: 'machine_error', message: `${m.name} is reporting an error.` });
        }
        
        // Check consumables for this machine
        const consSnap = await getDocs(collection(db, 'machines', m.id, 'consumables'));
        const machineConsumables = consSnap.docs.map(d => d.data());
        const hasLowConsumable = machineConsumables.some(c => c.level < 20);

        if (hasLowConsumable) {
          machineConsumables.filter(c => c.level < 20).forEach(c => {
            alerts.push({ machineId: m.id, type: 'low_toner', message: `${m.name}: ${c.name} is low (${c.level}%)` });
          });
        }

        machinesWithConsumables.push({
          ...m,
          hasLowConsumable,
          consumableSummary: machineConsumables.map(c => ({ name: c.name, level: c.level }))
        });
      }

      res.json({ machines: machinesWithConsumables, alerts });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
  });

  /**
   * GET /api/machine/:id
   * Detailed machine data
   */
  app.get('/api/machine/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const mRef = doc(db, 'machines', id);
      const mSnap = await getDoc(mRef);
      if (!mSnap.exists()) return res.status(404).json({ error: 'Not found' });

      const consumables = await getDocs(collection(db, 'machines', id, 'consumables'));
      const logs = await getDocs(query(collection(db, 'machines', id, 'logs'), orderBy('createdAt', 'desc'), limit(50)));
      const jobs = await getDocs(query(collection(db, 'machines', id, 'jobs'), orderBy('createdAt', 'desc'), limit(20)));

      res.json({
        machine: { id: mSnap.id, ...mSnap.data() },
        consumables: consumables.docs.map(d => d.data()),
        logs: logs.docs.map(d => d.data()),
        jobs: jobs.docs.map(d => d.data())
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch machine detail' });
    }
  });

  /**
   * GET /api/production
   * Production per day = max(counter) - min(counter)
   */
  app.get('/api/production', async (req, res) => {
    try {
      const machinesSnap = await getDocs(collection(db, 'machines'));
      const productionData: any[] = [];

      for (const m of machinesSnap.docs) {
        const logsQ = query(
          collection(db, 'machines', m.id, 'logs'),
          orderBy('createdAt', 'asc')
        );
        const logsSnap = await getDocs(logsQ);
        const logs = logsSnap.docs.map(d => d.data());

        if (logs.length > 1) {
          const first = logs[0].counter;
          const last = logs[logs.length - 1].counter;
          productionData.push({
            machineId: m.id,
            machineName: m.get('name'),
            totalProduction: last - first
          });
        }
      }
      res.json(productionData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to calculate production' });
    }
  });

  // Vite setup
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
    console.log(`PrintOps Backend running on port ${PORT}`);
  });
}

startServer();
