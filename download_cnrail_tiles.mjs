import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const lonMin = 73;
const lonMax = 135;
const latMin = 18;
const latMax = 54;
const minZoom = 1;
const maxZoom = 8;
const outDir = "cnrail_tiles";
const baseUrl = "http://railmap.geogv.org/data/wtrans2-20260325";

function lon2x(lon, z) {
  return Math.floor((lon + 180) / 360 * 2 ** z);
}

function lat2y(lat, z) {
  const rad = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * 2 ** z);
}

function get(url, dest) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`${res.statusCode} ${url}`));
        return;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    });
    req.setTimeout(20000, () => {
      req.destroy(new Error(`timeout ${url}`));
    });
    req.on("error", reject);
  });
}

const jobs = [];
for (let z = minZoom; z <= maxZoom; z++) {
  const x0 = lon2x(lonMin, z);
  const x1 = lon2x(lonMax, z);
  const y0 = lat2y(latMax, z);
  const y1 = lat2y(latMin, z);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      jobs.push({ z, x, y });
    }
  }
}

let done = 0;
let failed = 0;
let skipped = 0;
let cursor = 0;

async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    const dest = path.join(outDir, String(job.z), String(job.x), `${job.y}.pbf`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      skipped++;
      continue;
    }
    const url = `${baseUrl}/${job.z}/${job.x}/${job.y}.pbf`;
    try {
      await get(url, dest);
      done++;
    } catch (error) {
      failed++;
      console.error(error.message);
    }
    if ((done + skipped + failed) % 100 === 0) {
      console.log(`${done + skipped + failed}/${jobs.length} tiles processed`);
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()));
console.log(JSON.stringify({ total: jobs.length, done, skipped, failed }, null, 2));
