/**
 * PrintOps Agent Simulator
 * Run this script to simulate printer data being sent to the backend.
 * Usage: tsx simulate-agent.ts <machineId>
 */

const machineId = process.argv[2];
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

if (!machineId) {
  console.error('Please provide a machineId. Example: tsx simulate-agent.ts <machineId>');
  process.exit(1);
}

console.log(`Starting simulator for machine: ${machineId}`);
console.log(`Target URL: ${APP_URL}/api/machine-log`);

let counter = 1000;
let cyan = 95;
let magenta = 88;
let yellow = 92;
let black = 75;

async function sendLog() {
  // Simulate some printing
  const printAmount = Math.floor(Math.random() * 10);
  counter += printAmount;
  
  // Simulate ink usage
  cyan -= Math.random() * 0.1;
  magenta -= Math.random() * 0.1;
  yellow -= Math.random() * 0.1;
  black -= Math.random() * 0.1;

  const payload = {
    machineId,
    counter,
    status: 'RUNNING',
    consumables: [
      { name: 'Cyan', level: Math.max(0, Math.round(cyan)) },
      { name: 'Magenta', level: Math.max(0, Math.round(magenta)) },
      { name: 'Yellow', level: Math.max(0, Math.round(yellow)) },
      { name: 'Black', level: Math.max(0, Math.round(black)) }
    ]
  };

  try {
    const response = await fetch(`${APP_URL}/api/machine-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    console.log(`[${new Date().toLocaleTimeString()}] Log sent. Counter: ${counter}. Server Status: ${result.finalStatus}`);
  } catch (error) {
    console.error('Error sending log:', error.message);
  }
}

// Send log every 10 seconds
setInterval(sendLog, 10000);
sendLog();
