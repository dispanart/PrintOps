/**
 * PrintOps Local Agent
 * 
 * This script runs inside the LAN.
 * It scrapes data from printers and sends it to the Cloud Backend.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const BACKEND_URL = process.env.APP_URL || 'http://localhost:3000';
const POLLING_INTERVAL = 5000; // 5 seconds

interface PrinterConfig {
  id: string;
  name: string;
  ip: string;
  isSC170: boolean;
}

// Real Machines Configuration (Now fetched dynamically from backend)
// const PRINTERS: PrinterConfig[] = [ ... ];

/**
 * Fetch printers from backend
 */
async function getPrinters(): Promise<PrinterConfig[]> {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/machines`, { timeout: 5000 });
    return res.data;
  } catch (e) {
    console.error(`[Agent] Failed to fetch printer list from backend: ${e.message}`);
    return [];
  }
}

/**
 * Scrape data from a single printer
 */
async function scrapePrinter(printer: PrinterConfig) {
  const baseUrl = `http://${printer.ip}`;
  
  try {
    // 1. Fetch Status
    const statusRes = await axios.get(`${baseUrl}/stgen.htm`, { timeout: 3000 });
    const $status = cheerio.load(statusRes.data);
    const statusText = $status('body').text().toLowerCase();
    let status = 'idle';
    if (statusText.includes('printing') || statusText.includes('busy')) status = 'running';
    if (statusText.includes('error') || statusText.includes('jam')) status = 'error';

    // 2. Fetch Counter
    const counterRes = await axios.get(`${baseUrl}/prcnt.htm`, { timeout: 3000 });
    const $counter = cheerio.load(counterRes.data);
    // Logic: Find the total counter in the table (simplified for demo)
    const counter = parseInt($counter('td:contains("Total")').next().text().replace(/,/g, '')) || 0;

    // 3. Fetch Consumables
    const supplyRes = await axios.get(`${baseUrl}/stsply.htm`, { timeout: 3000 });
    const $supply = cheerio.load(supplyRes.data);
    const consumables: any[] = [];
    $supply('table tr').each((i, el) => {
      const name = $supply(el).find('td').first().text().trim();
      const levelStr = $supply(el).find('td').last().text().trim();
      const level = parseInt(levelStr.replace('%', ''));
      if (name && !isNaN(level)) {
        consumables.push({ name, level });
      }
    });

    // 4. Fetch Jobs (SC170 only)
    let jobs: any[] = [];
    if (printer.isSC170) {
      try {
        const jobRes = await axios.get(`${baseUrl}/job`, { timeout: 3000 });
        const $job = cheerio.load(jobRes.data);
        $job('.job-row').each((i, el) => {
          jobs.push({
            name: $job(el).find('.name').text(),
            status: $job(el).find('.status').text().toLowerCase()
          });
        });
      } catch (e) {
        console.warn(`[${printer.name}] Failed to fetch jobs`);
      }
    }

    // Send to Backend
    await axios.post(`${BACKEND_URL}/api/machine-log`, {
      machineId: printer.id,
      counter,
      status,
      consumables,
      jobs
    });

    console.log(`[${new Date().toLocaleTimeString()}] [${printer.name}] Data synced successfully.`);
  } catch (error) {
    console.error(`[${printer.name}] Error: ${error.message}`);
    // Report error status if connection fails
    try {
      await axios.post(`${BACKEND_URL}/api/machine-log`, {
        machineId: printer.id,
        status: 'error',
        counter: 0 // Will be ignored by backend logic if 0
      });
    } catch (e) {}
  }
}

/**
 * Main Loop
 */
async function runAgent() {
  console.log('--- PrintOps Agent Started ---');
  console.log(`Target Backend: ${BACKEND_URL}`);
  
  setInterval(async () => {
    const printers = await getPrinters();
    if (printers.length === 0) {
      console.log(`[${new Date().toLocaleTimeString()}] No printers configured or backend unreachable.`);
      return;
    }

    for (const printer of printers) {
      await scrapePrinter(printer);
    }
  }, POLLING_INTERVAL);
}

// Start the agent
runAgent();
