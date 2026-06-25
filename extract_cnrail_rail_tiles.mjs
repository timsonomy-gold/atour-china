import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire("/tmp/atour-rail-tools/package.json");
const { VectorTile } = require("@mapbox/vector-tile");
const { PbfReader } = require("pbf");

const TILESET = "wtrans2-20260325";
const TILE_URL = `http://railmap.geogv.org/data/${TILESET}/{z}/{x}/{y}.pbf`;
const ZOOM = 8;
const BOUNDS = { lonMin: 72.5, lonMax: 136.5, latMin: 17.2, latMax: 54.5 };
const KEEP_TYPES = new Set(["HSR", "HSR2", "RR", "RR2"]);
const CONCURRENCY = 16;
const TILE_TIMEOUT_MS = 8000;

function lonToTileX(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function latToTileY(lat, z) {
  const rad = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * 2 ** z);
}

function ringContains(ring, point) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonContains(polygon, point) {
  if (!polygon.length || !ringContains(polygon[0], point)) return false;
  return !polygon.slice(1).some(ring => ringContains(ring, point));
}

function featureContains(feature, point) {
  const geom = feature.geometry;
  if (!geom) return false;
  if (geom.type === "Polygon") return polygonContains(geom.coordinates, point);
  if (geom.type === "MultiPolygon") return geom.coordinates.some(poly => polygonContains(poly, point));
  return false;
}

function flattenCoords(coords, acc = []) {
  if (!Array.isArray(coords)) return acc;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    acc.push(coords);
    return acc;
  }
  for (const child of coords) flattenCoords(child, acc);
  return acc;
}

function featureBounds(feature) {
  const points = flattenCoords(feature.geometry?.coordinates || []);
  let lonMin = Infinity, latMin = Infinity, lonMax = -Infinity, latMax = -Infinity;
  for (const [lon, lat] of points) {
    lonMin = Math.min(lonMin, lon);
    lonMax = Math.max(lonMax, lon);
    latMin = Math.min(latMin, lat);
    latMax = Math.max(latMax, lat);
  }
  return { lonMin, lonMax, latMin, latMax };
}

function loadChinaFeatures() {
  return fs.readdirSync(".")
    .filter(name => /^province_\d{6}_full\.json$/.test(name))
    .flatMap(file => JSON.parse(fs.readFileSync(file, "utf8")).features || []);
}

const chinaFeatures = loadChinaFeatures().map(feature => ({
  feature,
  bounds: featureBounds(feature),
}));
const inFeatureBounds = ({ bounds }, [lon, lat]) =>
  lon >= bounds.lonMin && lon <= bounds.lonMax && lat >= bounds.latMin && lat <= bounds.latMax;
const inChina = (point) => chinaFeatures
  .filter(item => inFeatureBounds(item, point))
  .some(({ feature }) => featureContains(feature, point));

function routeType(rawType) {
  if (rawType === "HSR" || rawType === "HSR2") return "g";
  if (rawType === "RR" || rawType === "RR2") return "d";
  return null;
}

function simplifyLine(points) {
  const simplified = [];
  let last = null;
  for (const point of points) {
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.015) {
      simplified.push(point);
      last = point;
    }
  }
  if (points.length && simplified[simplified.length - 1] !== points[points.length - 1]) {
    simplified.push(points[points.length - 1]);
  }
  return simplified;
}

function normalizeLineGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

const xMin = lonToTileX(BOUNDS.lonMin, ZOOM);
const xMax = lonToTileX(BOUNDS.lonMax, ZOOM);
const yMin = latToTileY(BOUNDS.latMax, ZOOM);
const yMax = latToTileY(BOUNDS.latMin, ZOOM);
const routes = [];
const seen = new Set();
const stats = { tiles: 0, failedTiles: 0, decodedFeatures: 0, keptSegments: 0 };
const tileJobs = [];

for (let x = xMin; x <= xMax; x++) {
  for (let y = yMin; y <= yMax; y++) {
    tileJobs.push({ x, y });
  }
}

async function processTile({ x, y }) {
  const url = TILE_URL.replace("{z}", ZOOM).replace("{x}", x).replace("{y}", y);
  let buffer;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TILE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return { failed: true, routes: [], decodedFeatures: 0 };
    buffer = Buffer.from(await response.arrayBuffer());
  } catch {
    return { failed: true, routes: [], decodedFeatures: 0 };
  } finally {
    clearTimeout(timeout);
  }

  const tile = new VectorTile(new PbfReader(buffer));
  const layer = tile.layers.rail;
  if (!layer) return { failed: false, routes: [], decodedFeatures: 0 };

  const tileRoutes = [];
  let decodedFeatures = 0;
  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    const rawType = feature.properties.type;
    if (!KEEP_TYPES.has(rawType)) continue;
    decodedFeatures++;

    const geojson = feature.toGeoJSON(x, y, ZOOM);
    const name = feature.properties["name:zh"] || feature.properties["name:en"] || rawType;
    const mappedType = routeType(rawType);
    for (const line of normalizeLineGeometry(geojson.geometry)) {
      const inBounds = line.filter(([lon, lat]) =>
        lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax &&
        lat >= BOUNDS.latMin && lat <= BOUNDS.latMax
      );
      if (inBounds.length < 2) continue;
      const hasChinaPoint = inBounds.some((point, index) => index % 3 === 0 && inChina(point)) ||
        inChina(inBounds[0]) ||
        inChina(inBounds[inBounds.length - 1]);
      if (!hasChinaPoint) continue;
      const simplified = simplifyLine(inBounds);
      if (simplified.length < 2) continue;
      tileRoutes.push({
        type: mappedType,
        sourceType: rawType,
        name,
        coordinates: simplified.map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]),
      });
    }
  }
  return { failed: false, routes: tileRoutes, decodedFeatures };
}

for (let i = 0; i < tileJobs.length; i += CONCURRENCY) {
  const batch = tileJobs.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(processTile));
  for (const result of results) {
    stats.tiles++;
    if (result.failed) stats.failedTiles++;
    stats.decodedFeatures += result.decodedFeatures;
    for (const route of result.routes) {
      const key = `${route.type}|${route.sourceType}|${route.name}|${route.coordinates.map(p => p.map(v => v.toFixed(4)).join(",")).join(";")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      routes.push(route);
      stats.keptSegments++;
    }
  }
  if ((i / CONCURRENCY) % 10 === 0) {
    console.error(`processed ${Math.min(i + CONCURRENCY, tileJobs.length)}/${tileJobs.length}`);
  }
}

routes.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, "zh-Hans-CN"));

const output = {
  source: {
    name: "cnrail.geogv.org / railmap.geogv.org",
    tileset: TILESET,
    url: "http://railmap.geogv.org/data/wtrans2-20260325.json",
    extractedAt: new Date().toISOString(),
    zoom: ZOOM,
    typeMapping: {
      g: ["HSR", "HSR2"],
      d: ["RR", "RR2"],
    },
  },
  stats,
  routes,
};

fs.writeFileSync("rail_routes_wtrans2_20260325.json", JSON.stringify(output));
console.log(JSON.stringify({ ...stats, routes: routes.length }, null, 2));
