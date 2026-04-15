import axios from 'axios';

const BACKEND_URL = process.env.APP_URL || 'http://localhost:3000';
const POLLING_INTERVAL = 5000;

console.log('--- PrintOps Simulator Started ---');
console.log(`Target Backend: ${BACKEND_URL}`);

// Keep track of simulated counters
const counters: Record<string, number> = {};

async function simulateData() {
  try {
    // 1. Fetch machines from backend
    const res = await axios.get(`${BACKEND_URL}/api/machines`);
    const machines = res.data;

    if (machines.length === 0) {
      console.log(`[${new Date().toLocaleTimeString()}] No machines configured. Please add one in the Dashboard.`);
      return;
    }

    // 2. Simulate data for each machine
    for (const machine of machines) {
      // Initialize counter if not exists
      if (!counters[machine.id]) {
        counters[machine.id] = machine.lastCounter || Math.floor(Math.random() * 10000);
      }

      // Simulate printing (randomly increment counter)
      const isPrinting = Math.random() > 0.3; // 70% chance to be printing
      if (isPrinting) {
        counters[machine.id] += Math.floor(Math.random() * 10) + 1;
      }

      // Simulate error (5% chance)
      const isError = Math.random() < 0.05;
      const status = isError ? 'error' : (isPrinting ? 'running' : 'idle');

      // Simulate consumables
      const consumables = [
        { name: 'Cyan Toner', level: Math.max(0, Math.floor(100 - (counters[machine.id] % 1000) / 10)) },
        { name: 'Magenta Toner', level: Math.max(0, Math.floor(100 - ((counters[machine.id] + 200) % 1000) / 10)) },
        { name: 'Yellow Toner', level: Math.max(0, Math.floor(100 - ((counters[machine.id] + 500) % 1000) / 10)) },
        { name: 'Black Toner', level: Math.max(0, Math.floor(100 - ((counters[machine.id] + 800) % 1000) / 10)) },
        { name: 'Waste Cartridge', level: Math.min(100, Math.floor((counters[machine.id] % 5000) / 50)) }
      ];

      // Simulate jobs (only for SC170)
      const jobs = [];
      if (machine.isSC170 && isPrinting) {
        jobs.push({
          name: `Print_Job_${Math.floor(Math.random() * 1000)}.pdf`,
          status: 'printing'
        });
        if (Math.random() > 0.5) {
          jobs.push({
            name: `Brochure_${Math.floor(Math.random() * 100)}.pdf`,
            status: 'waiting'
          });
        }
      }

      // Send to backend
      await axios.post(`${BACKEND_URL}/api/machine-log`, {
        machineId: machine.id,
        counter: counters[machine.id],
        status,
        consumables,
        jobs
      });

      console.log(`[${new Date().toLocaleTimeString()}] Sent simulated data for ${machine.name} (Status: ${status}, Counter: ${counters[machine.id]})`);
    }
  } catch (error: any) {
    console.error(`[Simulator Error] Failed to send data: ${error.message}`);
  }
}

// Run immediately, then poll
simulateData();
setInterval(simulateData, POLLING_INTERVAL);
