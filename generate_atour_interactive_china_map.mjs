import fs from "node:fs";

const esc = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const shortNameOverrides = new Map([
  ["恩施土家族苗族自治州", "恩施"],
  ["湘西土家族苗族自治州", "湘西"],
  ["延边朝鲜族自治州", "延边"],
  ["大理白族自治州", "大理"],
  ["红河哈尼族彝族自治州", "红河"],
  ["文山壮族苗族自治州", "文山"],
  ["西双版纳傣族自治州", "西双版纳"],
  ["德宏傣族景颇族自治州", "德宏"],
  ["怒江傈僳族自治州", "怒江"],
  ["迪庆藏族自治州", "迪庆"],
  ["楚雄彝族自治州", "楚雄"],
  ["黔东南苗族侗族自治州", "黔东南"],
  ["黔南布依族苗族自治州", "黔南"],
  ["黔西南布依族苗族自治州", "黔西南"],
  ["甘孜藏族自治州", "甘孜"],
  ["阿坝藏族羌族自治州", "阿坝"],
  ["凉山彝族自治州", "凉山"],
  ["临夏回族自治州", "临夏"],
  ["甘南藏族自治州", "甘南"],
  ["海北藏族自治州", "海北州"],
  ["海南藏族自治州", "海南州"],
  ["黄南藏族自治州", "黄南州"],
  ["果洛藏族自治州", "果洛州"],
  ["玉树藏族自治州", "玉树州"],
  ["海西蒙古族藏族自治州", "海西州"],
  ["巴音郭楞蒙古自治州", "巴音郭楞"],
  ["博尔塔拉蒙古自治州", "博尔塔拉"],
  ["昌吉回族自治州", "昌吉"],
  ["克孜勒苏柯尔克孜自治州", "克孜勒苏"],
  ["伊犁哈萨克自治州", "伊犁"],
]);

function displayName(name) {
  if (shortNameOverrides.has(name)) return shortNameOverrides.get(name);
  return name.replace(/市$|地区$|盟$|自治州$/, "");
}

function parseCsv(path) {
  return fs.readFileSync(path, "utf8").trim().split(/\r?\n/).slice(1).map(line => {
    const cols = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return {
      adcode: cols[0],
      name: cols[1],
      shortName: displayName(cols[1]),
      lon: Number(cols[2]),
      lat: Number(cols[3]),
      province: cols[4],
      count: Number(cols[5]),
      density: cols[6],
      samples: cols[7] || "",
    };
  });
}

const provinceNameByCode = new Map([
  ["110000", "北京"], ["120000", "天津"], ["130000", "河北"], ["140000", "山西"], ["150000", "内蒙古"],
  ["210000", "辽宁"], ["220000", "吉林"], ["230000", "黑龙江"], ["310000", "上海"], ["320000", "江苏"],
  ["330000", "浙江"], ["340000", "安徽"], ["350000", "福建"], ["360000", "江西"], ["370000", "山东"],
  ["410000", "河南"], ["420000", "湖北"], ["430000", "湖南"], ["440000", "广东"], ["450000", "广西"],
  ["460000", "海南"], ["500000", "重庆"], ["510000", "四川"], ["520000", "贵州"], ["530000", "云南"],
  ["540000", "西藏"], ["610000", "陕西"], ["620000", "甘肃"], ["630000", "青海"], ["640000", "宁夏"],
  ["650000", "新疆"],
]);

const SVG_W = 5200;
const SVG_H = 3600;
const bounds = { lonMin: 72.5, lonMax: 136.5, latMin: 17.2, latMax: 54.5 };
const projectionPad = 95;
const rad = Math.PI / 180;
const albers = (() => {
  const phi1 = 25 * rad;
  const phi2 = 47 * rad;
  const phi0 = 0;
  const lambda0 = 105 * rad;
  const n = 0.5 * (Math.sin(phi1) + Math.sin(phi2));
  const c = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
  const rho0 = Math.sqrt(c - 2 * n * Math.sin(phi0)) / n;
  return (lon, lat) => {
    const lambda = lon * rad;
    const phi = lat * rad;
    const theta = n * (lambda - lambda0);
    const rho = Math.sqrt(Math.max(0, c - 2 * n * Math.sin(phi))) / n;
    return [
      rho * Math.sin(theta),
      -(rho0 - rho * Math.cos(theta)),
    ];
  };
})();

function projectionFit() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const lon = bounds.lonMin + (bounds.lonMax - bounds.lonMin) * i / steps;
    for (let j = 0; j <= steps; j++) {
      const lat = bounds.latMin + (bounds.latMax - bounds.latMin) * j / steps;
      const [x, y] = albers(lon, lat);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const fitScale = Math.min(
    (SVG_W - projectionPad * 2) / (maxX - minX),
    (SVG_H - projectionPad * 2) / (maxY - minY),
  );
  return {
    minX,
    minY,
    scale: fitScale,
    offsetX: (SVG_W - (maxX - minX) * fitScale) / 2,
    offsetY: (SVG_H - (maxY - minY) * fitScale) / 2,
  };
}

const projection = projectionFit();

function project(lon, lat) {
  const [x, y] = albers(lon, lat);
  return [
    projection.offsetX + (x - projection.minX) * projection.scale,
    projection.offsetY + (y - projection.minY) * projection.scale,
  ];
}

function pathForRing(ring) {
  return ring.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function featurePath(feature) {
  const geom = feature.geometry;
  if (!geom) return "";
  if (geom.type === "Polygon") return geom.coordinates.map(pathForRing).join(" ");
  if (geom.type === "MultiPolygon") return geom.coordinates.flatMap(poly => poly.map(pathForRing)).join(" ");
  return "";
}

function readProvincePaths() {
  return fs.readdirSync(".")
    .filter(name => /^province_\d{6}_full\.json$/.test(name))
    .sort()
    .flatMap(file => {
      const geo = JSON.parse(fs.readFileSync(file, "utf8"));
      return (geo.features || []).map(feature => `<path class="province" d="${featurePath(feature)}"></path>`);
    })
    .join("\n");
}

function regionFor(city) {
  const code = city.province;
  if (["110000", "120000", "130000", "140000", "150000"].includes(code)) return "华北";
  if (["210000", "220000", "230000"].includes(code)) return "东北";
  if (["310000", "320000", "330000", "340000"].includes(code)) return "长三角";
  if (["350000", "360000", "370000"].includes(code)) return "华东沿海";
  if (["410000", "420000", "430000"].includes(code)) return "华中";
  if (["440000", "450000", "460000"].includes(code)) return "华南";
  if (["500000", "510000", "520000", "530000", "540000"].includes(code)) return "西南";
  return "西北";
}

const rows = parseCsv("atour_city_coverage_baidu_suggestion.csv");
const cities = rows
  .filter(row => row.count > 0)
  .map(city => {
    const [x, y] = project(city.lon, city.lat);
    return {
      ...city,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      provinceName: provinceNameByCode.get(city.province) || city.province,
      region: regionFor(city),
      hub: city.density === "10+",
    };
  });

const total = cities.length;
const hubs = cities.filter(city => city.hub).length;
const provincePaths = readProvincePaths();
const cityJson = JSON.stringify(cities);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>亚朵酒店覆盖城市可缩放查询图</title>
  <style>
    :root {
      --bg: #f7f8f3;
      --ink: #1f2d25;
      --muted: #64746a;
      --line: #ccd8ce;
      --panel: rgba(255, 255, 255, 0.95);
      --shadow: 0 12px 32px rgba(34, 48, 38, 0.12);
      --red: #c83b36;
      --blue: #2f78b7;
    }
    * { box-sizing: border-box; }
    html { height: 100%; }
    body {
      margin: 0;
      width: 100%;
      height: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--bg);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "STHeiti", "Microsoft YaHei", sans-serif;
      overflow: hidden;
    }
    .app {
      position: fixed;
      inset: 0;
      display: grid;
      grid-template-columns: 1fr 390px;
      grid-template-rows: minmax(0, 1fr);
      height: 100vh;
      height: 100dvh;
      width: 100vw;
      min-height: 620px;
      overflow: hidden;
    }
    .map-wrap {
      position: relative;
      min-width: 0;
      min-height: 0;
      height: 100%;
      background: #eef4ef;
      overflow: hidden;
      contain: layout paint size;
    }
    svg {
      display: block;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      min-width: 100%;
      min-height: 100%;
      max-width: 100%;
      max-height: 100%;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }
    svg.dragging { cursor: grabbing; }
    .province {
      fill: #e8f0e8;
      stroke: #aebfb0;
      stroke-width: 1.8;
      vector-effect: non-scaling-stroke;
    }
    .city-hit {
      cursor: pointer;
      stroke: #fff;
      stroke-width: 4;
      filter: drop-shadow(0 1px 1px rgba(26, 42, 32, 0.22));
    }
    .city-hit.minor { fill: var(--blue); }
    .city-hit.hub { fill: var(--red); }
    .city-hit.selected {
      stroke: #1c2b24;
      stroke-width: 6;
    }
    .label {
      pointer-events: none;
      font-size: 58px;
      font-weight: 760;
      fill: #214a64;
      paint-order: stroke;
      stroke: rgba(255,255,255,0.96);
      stroke-width: 13px;
      stroke-linejoin: round;
    }
    .label.hub-label {
      fill: #2a231f;
      font-size: 66px;
      font-weight: 850;
    }
    .hud {
      position: absolute;
      left: 24px;
      top: 22px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
      max-width: calc(100% - 48px);
      pointer-events: none;
      z-index: 4;
    }
    .title {
      padding: 14px 18px 13px;
      background: var(--panel);
      border: 1px solid #d7e1d8;
      border-radius: 8px;
      box-shadow: var(--shadow);
      pointer-events: auto;
    }
    h1 {
      margin: 0;
      font-size: 25px;
      letter-spacing: 0;
      line-height: 1.15;
    }
    .subtitle {
      margin-top: 5px;
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }
    .controls {
      position: absolute;
      left: 24px;
      bottom: 18px;
      z-index: 5;
      pointer-events: auto;
    }
    .zoom-box {
      width: 320px;
      padding: 10px 11px 9px;
      background: var(--panel);
      border: 1px solid #d7e1d8;
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .zoom-row {
      display: grid;
      grid-template-columns: 38px 28px 1fr 28px 45px;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
    }
    .zoom-row:first-child { margin-top: 0; }
    .control-label {
      color: #50645a;
      font-size: 12px;
      white-space: nowrap;
    }
    .toggle-row {
      margin-top: 7px;
      display: flex;
      align-items: center;
      gap: 6px;
      color: #405248;
      font-size: 12px;
      line-height: 1.25;
    }
    .toggle-row input {
      width: 14px;
      height: 14px;
      margin: 0;
    }
    button, input, select { font: inherit; }
    button {
      border: 1px solid #cbd8ce;
      background: #fff;
      color: #26382e;
      border-radius: 6px;
      height: 28px;
      cursor: pointer;
    }
    button:hover { border-color: #91a996; background: #f7fbf7; }
    .fit-button {
      width: 100%;
      margin-top: 7px;
      font-size: 12px;
    }
    input[type="range"] { width: 100%; }
    .scale-readout {
      font-size: 12px;
      color: #405248;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .legend {
      position: absolute;
      left: 24px;
      top: 116px;
      background: var(--panel);
      border: 1px solid #d7e1d8;
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 9px 11px;
      display: flex;
      gap: 12px;
      align-items: center;
      color: #50645a;
      font-size: 12px;
      pointer-events: none;
      z-index: 4;
    }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
    .side {
      border-left: 1px solid #d8e3da;
      background: #fff;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .side header {
      padding: 22px 20px 16px;
      border-bottom: 1px solid #e2e9e2;
    }
    .search {
      width: 100%;
      height: 40px;
      border: 1px solid #cbd8ce;
      border-radius: 8px;
      padding: 0 12px;
      font-size: 15px;
      outline: none;
    }
    .search:focus { border-color: #32845c; box-shadow: 0 0 0 3px rgba(50,132,92,.16); }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 12px;
    }
    .chip {
      height: 30px;
      padding: 0 10px;
      font-size: 13px;
    }
    .chip.active {
      border-color: #32845c;
      color: #12643c;
      background: #eaf7ee;
    }
    .regions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      padding: 14px 20px;
      border-bottom: 1px solid #e2e9e2;
    }
    .region-btn {
      height: 36px;
      font-size: 13px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .result-meta {
      padding: 12px 20px 8px;
      color: var(--muted);
      font-size: 13px;
    }
    .list {
      overflow: auto;
      padding: 0 12px 16px;
    }
    .item {
      width: 100%;
      min-height: 58px;
      height: auto;
      border: 0;
      border-radius: 8px;
      background: #fff;
      display: grid;
      grid-template-columns: 52px 1fr;
      gap: 10px;
      padding: 9px 8px;
      text-align: left;
    }
    .item:hover, .item.selected { background: #eef7f1; }
    .code {
      display: inline-grid;
      place-items: center;
      height: 34px;
      min-width: 48px;
      border-radius: 7px;
      color: #fff;
      font-weight: 850;
      font-size: 13px;
      letter-spacing: 0;
      align-self: start;
    }
    .name {
      font-size: 15px;
      font-weight: 760;
      line-height: 1.25;
      color: #25372d;
    }
    .meta {
      margin-top: 4px;
      font-size: 12px;
      color: #66786e;
      line-height: 1.35;
    }
    .detail {
      margin: 0 20px 18px;
      padding: 14px;
      border: 1px solid #dce6dd;
      border-radius: 8px;
      background: #f8fbf8;
      color: #405248;
      font-size: 13px;
      line-height: 1.65;
    }
    .detail strong {
      color: #203026;
      font-size: 16px;
    }
    .samples {
      display: block;
      margin-top: 4px;
      color: #5f7167;
      max-height: 78px;
      overflow: auto;
    }
    @media (max-width: 980px) {
      body { overflow: auto; }
      .app {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(520px, 68vh) auto;
        grid-template-rows: minmax(520px, 68dvh) auto;
      }
      .map-wrap { height: auto; min-height: 520px; }
      .side { border-left: 0; border-top: 1px solid #d8e3da; max-height: none; }
      .hud { left: 12px; top: 12px; }
      .controls { left: 12px; bottom: 12px; }
      .title h1 { font-size: 19px; }
      .subtitle { white-space: normal; }
      .zoom-box { width: 320px; max-width: calc(100vw - 24px); }
      .legend { left: 12px; top: 102px; flex-wrap: wrap; max-width: calc(100% - 24px); }
    }
  </style>
</head>
<body>
  <main class="app" id="app">
    <section class="map-wrap">
      <svg id="map" viewBox="0 0 ${SVG_W} ${SVG_H}" aria-label="亚朵酒店覆盖城市可缩放地图">
        <g id="mapLayer">${provincePaths}</g>
        <g id="cityLayer"></g>
        <g id="labelLayer"></g>
      </svg>
      <div class="hud">
        <div class="title">
          <h1>亚朵酒店覆盖城市查询图</h1>
          <div class="subtitle">共 ${total} 个检出城市；10+ 强覆盖 ${hubs} 个，1-9 城市 ${total - hubs} 个</div>
        </div>
      </div>
      <div class="controls">
        <div class="zoom-box">
          <div class="zoom-row">
            <div class="control-label">比例</div>
            <button id="zoomOut" title="缩小">−</button>
            <input id="zoomSlider" type="range" min="0.75" max="8" step="0.05" value="1">
            <button id="zoomIn" title="放大">＋</button>
            <div id="scaleReadout" class="scale-readout">1.00×</div>
          </div>
          <div class="zoom-row">
            <div class="control-label">文字</div>
            <button id="labelDown" title="缩小文字">−</button>
            <input id="labelSlider" type="range" min="0.45" max="2.4" step="0.05" value="1.00">
            <button id="labelUp" title="放大文字">＋</button>
            <div id="labelReadout" class="scale-readout">1.00×</div>
          </div>
          <label class="toggle-row">
            <input id="showAllLabels" type="checkbox">
            强制显示全部城市名
          </label>
          <button id="fitMap" class="fit-button" title="回到全国总览">适应全图</button>
        </div>
      </div>
      <div class="legend">
        <span><i class="dot" style="background:var(--red)"></i>10+ 强覆盖</span>
        <span><i class="dot" style="background:var(--blue)"></i>1-9 检出</span>
        <span>拖拽平移，滚轮缩放，搜索/筛选会显示对应城市名</span>
      </div>
    </section>
    <aside class="side">
      <header>
        <input id="search" class="search" placeholder="搜索城市、省份、区域或样例门店" autocomplete="off">
        <div class="filters">
          <button class="chip active" data-scope="all">全部 ${total}</button>
          <button class="chip" data-scope="hub">10+ 强覆盖 ${hubs}</button>
          <button class="chip" data-scope="minor">1-9 城市 ${total - hubs}</button>
        </div>
      </header>
      <div class="regions" id="regions"></div>
      <div class="result-meta" id="resultMeta"></div>
      <div class="list" id="list"></div>
      <div class="detail" id="detail">选择城市后显示覆盖等级、坐标和样例门店。搜索或筛选时，对应城市名会直接显示在地图上。</div>
    </aside>
  </main>
  <script>
    const CITIES = ${cityJson};
    const REGIONS = [
      { name: "新疆 / 西北", extent: [72.5, 34.0, 108.5, 49.8] },
      { name: "青藏 / 川西", extent: [78.0, 26.0, 106.5, 38.8] },
      { name: "东北 / 蒙东", extent: [112.0, 38.0, 134.5, 53.8] },
      { name: "华北 / 黄淮", extent: [104.0, 31.0, 123.5, 42.8] },
      { name: "长三角 / 华东", extent: [112.0, 26.5, 123.5, 34.5] },
      { name: "华中 / 成渝", extent: [101.0, 27.0, 116.5, 34.5] },
      { name: "西南 / 云贵桂", extent: [96.0, 20.5, 111.5, 31.5] },
      { name: "华南 / 海岛", extent: [107.0, 18.0, 122.5, 25.8] }
    ];
    const SVG_W = ${SVG_W};
    const SVG_H = ${SVG_H};
    const BASE_PAD = 120;
    const color = { hub: "#c83b36", minor: "#2f78b7" };

    const app = document.getElementById("app");
    const svg = document.getElementById("map");
    const mapLayer = document.getElementById("mapLayer");
    const cityLayer = document.getElementById("cityLayer");
    const labelLayer = document.getElementById("labelLayer");
    const slider = document.getElementById("zoomSlider");
    const labelSlider = document.getElementById("labelSlider");
    const showAllLabels = document.getElementById("showAllLabels");
    const scaleReadout = document.getElementById("scaleReadout");
    const labelReadout = document.getElementById("labelReadout");
    const search = document.getElementById("search");
    const list = document.getElementById("list");
    const resultMeta = document.getElementById("resultMeta");
    const detail = document.getElementById("detail");
    const regionBox = document.getElementById("regions");
    const chips = [...document.querySelectorAll(".chip")];

    let transform = { k: 1, x: 0, y: 0 };
    let fitTransform = { k: 1, x: 0, y: 0 };
    let labelScale = Number(labelSlider.value);
    let activeScope = "all";
    let selected = null;
    let dragging = false;
    let dragMoved = false;
    let lastPoint = null;
    let pointerDownPoint = null;

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function svgPoint(event) {
      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const ctm = svg.getScreenCTM().inverse();
      const p = pt.matrixTransform(ctm);
      return { x: p.x, y: p.y };
    }

    function setTransform(next) {
      transform = {
        k: Math.max(0.75, Math.min(8, next.k)),
        x: next.x,
        y: next.y
      };
      mapLayer.setAttribute("transform", \`translate(\${transform.x} \${transform.y}) scale(\${transform.k})\`);
      slider.value = transform.k.toFixed(2);
      scaleReadout.textContent = \`\${transform.k.toFixed(2)}×\`;
      drawCities();
    }

    function syncViewportSize() {
      const width = Math.max(window.innerWidth || document.documentElement.clientWidth || 0, 640);
      const height = Math.max(window.innerHeight || document.documentElement.clientHeight || 0, 620);
      app.style.width = \`\${width}px\`;
      app.style.height = \`\${height}px\`;
      requestAnimationFrame(drawCities);
    }

    function contentBounds(items = CITIES) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const city of items) {
        minX = Math.min(minX, city.x);
        minY = Math.min(minY, city.y);
        maxX = Math.max(maxX, city.x);
        maxY = Math.max(maxY, city.y);
      }
      return {
        minX: minX - BASE_PAD,
        minY: minY - BASE_PAD,
        maxX: maxX + BASE_PAD,
        maxY: maxY + BASE_PAD
      };
    }

    function fitItems(items, resetSelection = false) {
      if (resetSelection) selected = null;
      const b = contentBounds(items.length ? items : CITIES);
      const k = Math.min(SVG_W / (b.maxX - b.minX), SVG_H / (b.maxY - b.minY));
      fitTransform = {
        k,
        x: (SVG_W - (b.minX + b.maxX) * k) / 2,
        y: (SVG_H - (b.minY + b.maxY) * k) / 2
      };
      setTransform(fitTransform);
    }

    function zoomAt(point, nextK) {
      const oldK = transform.k;
      const k = Math.max(0.75, Math.min(8, nextK));
      const worldX = (point.x - transform.x) / oldK;
      const worldY = (point.y - transform.y) / oldK;
      setTransform({
        k,
        x: point.x - worldX * k,
        y: point.y - worldY * k
      });
    }

    function cityScreen(city) {
      return {
        x: transform.x + city.x * transform.k,
        y: transform.y + city.y * transform.k
      };
    }

    function cityVisibleByScope(city) {
      if (activeScope === "all") return true;
      if (activeScope === "hub") return city.hub;
      return !city.hub;
    }

    function cityVisibleBySearch(city) {
      const q = search.value.trim().toLowerCase();
      if (!q) return true;
      return [city.name, city.shortName, city.provinceName, city.region, city.density, city.samples]
        .some(v => String(v).toLowerCase().includes(q));
    }

    function visibleCities() {
      return CITIES.filter(city => cityVisibleByScope(city) && cityVisibleBySearch(city));
    }

    function labelAllowed(city, searchActive) {
      if (selected && selected.adcode === city.adcode) return true;
      if (showAllLabels.checked) return true;
      if (searchActive) return true;
      if (activeScope !== "all") return true;
      if (transform.k >= fitTransform.k * 2.3) return true;
      if (transform.k >= fitTransform.k * 1.55) return city.hub || city.count >= 5;
      return city.hub;
    }

    function drawCities() {
      cityLayer.replaceChildren();
      labelLayer.replaceChildren();
      const visible = visibleCities();
      const searchActive = search.value.trim().length > 0;
      const sorted = [...visible].sort((a, b) => Number(a.hub) - Number(b.hub));

      for (const city of sorted) {
        const p = cityScreen(city);
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", p.x);
        circle.setAttribute("cy", p.y);
        circle.setAttribute("r", city.hub ? 14 : Math.max(7, 6 + city.count * 0.9));
        circle.setAttribute("class", \`city-hit \${city.hub ? "hub" : "minor"}\${selected && selected.adcode === city.adcode ? " selected" : ""}\`);
        circle.style.opacity = "1";
        cityLayer.appendChild(circle);
      }

      const labelCandidates = visible.filter(city => labelAllowed(city, searchActive));
      for (const city of labelCandidates) {
        const p = cityScreen(city);
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", p.x + 12);
        text.setAttribute("y", p.y - 20 * labelScale);
        text.setAttribute("class", city.hub ? "label hub-label" : "label");
        text.style.fontSize = \`\${(city.hub ? 66 : 58) * labelScale}px\`;
        text.style.strokeWidth = \`\${(city.hub ? 15 : 13) * labelScale}px\`;
        text.textContent = city.shortName;
        labelLayer.appendChild(text);
      }

      renderList(visible);
    }

    function renderList(items) {
      const scopeName = { all: "全部城市", hub: "10+ 强覆盖城市", minor: "1-9 城市" }[activeScope] || "城市";
      resultMeta.textContent = \`\${scopeName}：显示 \${items.length} 个\`;
      const topItems = [...items].sort((a, b) => {
        if (a.hub !== b.hub) return Number(b.hub) - Number(a.hub);
        if (b.count !== a.count) return b.count - a.count;
        return a.shortName.localeCompare(b.shortName, "zh-Hans-CN");
      });
      list.replaceChildren();
      for (const city of topItems) {
        const btn = document.createElement("button");
        btn.className = "item" + (selected && selected.adcode === city.adcode ? " selected" : "");
        btn.innerHTML = \`
          <span class="code" style="background:\${city.hub ? color.hub : color.minor}">\${city.density}</span>
          <span>
            <span class="name">\${escapeHtml(city.shortName)}</span>
            <span class="meta">\${escapeHtml(city.provinceName)} · \${escapeHtml(city.region)} · 检出 \${city.count} 条</span>
          </span>\`;
        btn.addEventListener("click", () => selectCity(city, true));
        list.appendChild(btn);
      }
    }

    function selectCity(city, fly) {
      selected = city;
      const sampleText = city.samples ? city.samples.split("；").slice(0, 6).join("；") : "无样例门店";
      detail.innerHTML = \`<strong>\${escapeHtml(city.shortName)}｜\${city.density}</strong><br>
        省份/区域：\${escapeHtml(city.provinceName)} · \${escapeHtml(city.region)}<br>
        检出条目：\${city.count}　坐标：\${city.lat.toFixed(4)}, \${city.lon.toFixed(4)}<br>
        <span class="samples">样例：\${escapeHtml(sampleText)}</span>\`;
      if (fly) {
        const targetK = Math.max(transform.k, fitTransform.k * 2.4);
        setTransform({
          k: targetK,
          x: SVG_W / 2 - city.x * targetK,
          y: SVG_H / 2 - city.y * targetK
        });
      } else {
        drawCities();
      }
    }

    function nearestCityAt(point) {
      let nearest = null;
      let best = Infinity;
      for (const city of visibleCities()) {
        const p = cityScreen(city);
        const distance = Math.hypot(p.x - point.x, p.y - point.y);
        const hitRadius = Math.max(62, city.hub ? 76 : 62);
        if (distance <= hitRadius && distance < best) {
          nearest = city;
          best = distance;
        }
      }
      return nearest;
    }

    for (const region of REGIONS) {
      const btn = document.createElement("button");
      btn.className = "region-btn";
      btn.textContent = region.name;
      btn.title = region.name;
      btn.addEventListener("click", () => {
        const [minLon, minLat, maxLon, maxLat] = region.extent;
        const items = CITIES.filter(city =>
          city.lon >= minLon && city.lon <= maxLon && city.lat >= minLat && city.lat <= maxLat
        );
        selected = null;
        fitItems(items);
      });
      regionBox.appendChild(btn);
    }

    svg.addEventListener("pointerdown", event => {
      dragging = true;
      dragMoved = false;
      lastPoint = svgPoint(event);
      pointerDownPoint = lastPoint;
      svg.classList.add("dragging");
      svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener("pointermove", event => {
      if (!dragging) return;
      const p = svgPoint(event);
      if (pointerDownPoint && Math.hypot(p.x - pointerDownPoint.x, p.y - pointerDownPoint.y) > 35) {
        dragMoved = true;
      }
      setTransform({ k: transform.k, x: transform.x + p.x - lastPoint.x, y: transform.y + p.y - lastPoint.y });
      lastPoint = p;
    });
    svg.addEventListener("pointerup", event => {
      const p = svgPoint(event);
      dragging = false;
      svg.classList.remove("dragging");
      svg.releasePointerCapture(event.pointerId);
      if (!dragMoved) {
        const city = nearestCityAt(p);
        if (city) selectCity(city, false);
      }
      pointerDownPoint = null;
    });
    svg.addEventListener("wheel", event => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.13 : 0.885;
      zoomAt(svgPoint(event), transform.k * factor);
    }, { passive: false });

    slider.addEventListener("input", () => zoomAt({ x: SVG_W / 2, y: SVG_H / 2 }, Number(slider.value)));
    labelSlider.addEventListener("input", () => {
      labelScale = Number(labelSlider.value);
      labelReadout.textContent = \`\${labelScale.toFixed(2)}×\`;
      drawCities();
    });
    showAllLabels.addEventListener("change", drawCities);
    document.getElementById("zoomIn").addEventListener("click", () => zoomAt({ x: SVG_W / 2, y: SVG_H / 2 }, transform.k * 1.22));
    document.getElementById("zoomOut").addEventListener("click", () => zoomAt({ x: SVG_W / 2, y: SVG_H / 2 }, transform.k / 1.22));
    document.getElementById("fitMap").addEventListener("click", () => fitItems(CITIES, true));
    document.getElementById("labelUp").addEventListener("click", () => {
      labelSlider.value = Math.min(2.4, labelScale * 1.15).toFixed(2);
      labelSlider.dispatchEvent(new Event("input"));
    });
    document.getElementById("labelDown").addEventListener("click", () => {
      labelSlider.value = Math.max(0.45, labelScale / 1.15).toFixed(2);
      labelSlider.dispatchEvent(new Event("input"));
    });
    search.addEventListener("input", () => {
      selected = null;
      drawCities();
    });

    chips.forEach(chip => chip.addEventListener("click", () => {
      chips.forEach(item => item.classList.remove("active"));
      chip.classList.add("active");
      activeScope = chip.dataset.scope;
      selected = null;
      drawCities();
    }));

    window.addEventListener("resize", syncViewportSize);
    window.addEventListener("orientationchange", syncViewportSize);

    syncViewportSize();
    fitItems(CITIES);
  </script>
</body>
</html>`;

fs.writeFileSync("atour_china_hotels_interactive.html", html);
console.log("created atour_china_hotels_interactive.html");
