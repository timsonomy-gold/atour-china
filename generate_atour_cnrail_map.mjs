import fs from "node:fs";

const esc = value => String(value)
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
  ["楚雄彝族自治州", "楚雄"],
  ["黔东南苗族侗族自治州", "黔东南"],
  ["黔南布依族苗族自治州", "黔南"],
  ["凉山彝族自治州", "凉山"],
  ["巴音郭楞蒙古自治州", "巴音郭楞"],
  ["博尔塔拉蒙古自治州", "博尔塔拉"],
  ["伊犁哈萨克自治州", "伊犁"],
]);

function displayName(name) {
  if (shortNameOverrides.has(name)) return shortNameOverrides.get(name);
  return name.replace(/市$|地区$|盟$|自治州$/, "");
}

function parseCsv(file) {
  return fs.readFileSync(file, "utf8").trim().split(/\r?\n/).slice(1).map(line => {
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

function regionFor(code) {
  if (["110000", "120000", "130000", "140000", "150000"].includes(code)) return "华北";
  if (["210000", "220000", "230000"].includes(code)) return "东北";
  if (["310000", "320000", "330000", "340000"].includes(code)) return "长三角";
  if (["350000", "360000", "370000"].includes(code)) return "华东沿海";
  if (["410000", "420000", "430000"].includes(code)) return "华中";
  if (["440000", "450000", "460000"].includes(code)) return "华南";
  if (["500000", "510000", "520000", "530000", "540000"].includes(code)) return "西南";
  return "西北";
}

const cities = parseCsv("atour_city_coverage_baidu_suggestion.csv")
  .filter(city => city.count > 0)
  .map(city => ({
    ...city,
    provinceName: provinceNameByCode.get(city.province) || city.province,
    region: regionFor(city.province),
    hub: city.density === "10+",
  }));

const total = cities.length;
const hubs = cities.filter(city => city.hub).length;
const cityJson = JSON.stringify(cities);

const cnrailStyle = {
  version: 8,
  name: "Atour CNRail Overlay",
  sources: {
    cnrail: {
      type: "vector",
      tiles: ["./cnrail_tiles/{z}/{x}/{y}.pbf"],
      minzoom: 1,
      maxzoom: 8,
      attribution: "Rail data style inspired by cnrail.geogv.org / WTRANS2, OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f4f5f0" } },
    { id: "water", type: "fill", source: "cnrail", "source-layer": "water", paint: { "fill-color": "#dbe5e8" } },
    { id: "natural-water", type: "fill", source: "cnrail", "source-layer": "natural", filter: ["==", "natural", "water"], paint: { "fill-color": "#dbe5e8" } },
    { id: "admin2b", type: "line", source: "cnrail", "source-layer": "admin2b", paint: { "line-color": "#9da8a0", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.4] } },
    { id: "admin4b", type: "line", source: "cnrail", "source-layer": "admin4b", minzoom: 5, paint: { "line-color": "#bdc6bd", "line-width": 0.8, "line-dasharray": [3, 2] } },
    { id: "rail-other-minor", type: "line", source: "cnrail", "source-layer": "rail", filter: ["in", "type", "MINOR", "NONE"], paint: { "line-color": "#7a748d", "line-opacity": 0.48, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.45, 8, 1.25, 12, 2] } },
    { id: "rail-f", type: "line", source: "cnrail", "source-layer": "rail", filter: ["in", "type", "F", "F2"], paint: { "line-color": "#86a800", "line-opacity": 0.7, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 8, 1.8, 12, 3] } },
    { id: "rail-r", type: "line", source: "cnrail", "source-layer": "rail", filter: ["in", "type", "R", "R2"], paint: { "line-color": "#209a3b", "line-opacity": 0.78, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 8, 2.0, 12, 3.2] } },
    { id: "rail-rr", type: "line", source: "cnrail", "source-layer": "rail", filter: ["in", "type", "RR", "RR2"], paint: { "line-color": "#f08a00", "line-opacity": 0.86, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 8, 2.4, 12, 3.8] } },
    { id: "rail-hsr", type: "line", source: "cnrail", "source-layer": "rail", filter: ["in", "type", "HSR", "HSR2"], paint: { "line-color": "#ef2f21", "line-opacity": 0.9, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.0, 8, 2.8, 12, 4.2] } },
    { id: "rail-construction", type: "line", source: "cnrail", "source-layer": "rail", filter: ["in", "type", "HSR_CON", "RR_CON"], paint: { "line-color": "#ef2f21", "line-opacity": 0.42, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.0, 10, 2.6], "line-dasharray": [2, 2] } },
  ],
};

fs.writeFileSync("cnrail_style_atour.json", JSON.stringify(cnrailStyle, null, 2));

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>亚朵酒店覆盖城市 × 中国铁路精细底图</title>
  <link rel="stylesheet" href="./vendor/maplibre-gl.css">
  <style>
    :root {
      --panel: rgba(255,255,255,.95);
      --ink: #1e2b25;
      --muted: #66746d;
      --red: #c83b36;
      --blue: #2f78b7;
      --line: #d8e0da;
      --shadow: 0 12px 30px rgba(31,45,37,.14);
    }
    * { box-sizing: border-box; }
    html, body, .app, #map { width: 100%; height: 100%; margin: 0; }
    body {
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "STHeiti", "Microsoft YaHei", sans-serif;
      overflow: hidden;
    }
    .app { display: grid; grid-template-columns: minmax(0, 1fr) 380px; background: #eef1eb; }
    .map-shell { position: relative; min-width: 0; }
    .hud {
      position: absolute;
      top: 18px;
      left: 18px;
      z-index: 3;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: min(820px, calc(100% - 36px));
      pointer-events: none;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      pointer-events: auto;
    }
    .title { padding: 14px 18px 12px; }
    h1 { margin: 0 0 6px; font-size: 25px; line-height: 1.15; letter-spacing: 0; }
    .subtitle { color: var(--muted); font-size: 13px; line-height: 1.45; }
    .legend {
      padding: 10px 12px;
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      font-size: 12px;
      color: #394842;
    }
    .legend i {
      display: inline-block;
      vertical-align: middle;
      margin-right: 5px;
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .sample-line { width: 26px; border-top: 3px solid; }
    .controls {
      position: absolute;
      left: 18px;
      bottom: 18px;
      z-index: 3;
      width: 360px;
      padding: 12px;
    }
    .rail-toggles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .rail-toggles label, .toggle-row {
      display: flex;
      align-items: center;
      gap: 7px;
      min-height: 32px;
      padding: 6px 8px;
      border: 1px solid #d4ded6;
      border-radius: 6px;
      background: rgba(255,255,255,.78);
    }
    .fit-button {
      width: 100%;
      border: 1px solid #c7d4ca;
      background: #fff;
      border-radius: 6px;
      padding: 8px;
      color: #26352e;
      cursor: pointer;
    }
    .marker {
      display: grid;
      place-items: center;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.25);
      cursor: pointer;
    }
    .marker.hub {
      width: 19px;
      height: 19px;
      border-radius: 6px;
      background: var(--red);
    }
    .marker.minor {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--blue);
    }
    .marker.selected { outline: 3px solid rgba(30,43,37,.78); }
    .marker-label {
      position: absolute;
      left: 16px;
      top: -14px;
      white-space: nowrap;
      color: #172820;
      font-size: 13px;
      font-weight: 800;
      text-shadow: 0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff;
      pointer-events: none;
    }
    .side {
      min-width: 0;
      height: 100%;
      border-left: 1px solid #d8e0da;
      background: rgba(250,252,249,.97);
      padding: 22px 18px;
      overflow: auto;
    }
    .search {
      width: 100%;
      height: 40px;
      border: 1px solid #cbd8d0;
      border-radius: 8px;
      padding: 0 13px;
      font-size: 14px;
      background: #fff;
    }
    .filters, .regions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .chip, .region-btn {
      border: 1px solid #cbd8d0;
      background: #fff;
      border-radius: 6px;
      padding: 7px 10px;
      color: #2d3a34;
      cursor: pointer;
      font-size: 13px;
    }
    .chip.active { border-color: #218653; color: #137245; background: #edf8f0; }
    .region-btn { width: calc(50% - 4px); }
    .result-meta { margin: 20px 0 10px; font-size: 13px; color: var(--muted); }
    .list { display: grid; gap: 8px; padding-bottom: 120px; }
    .item {
      display: grid;
      grid-template-columns: 50px 1fr;
      gap: 10px;
      align-items: center;
      text-align: left;
      border: 0;
      border-radius: 8px;
      background: transparent;
      padding: 9px 0;
      cursor: pointer;
    }
    .item:hover, .item.selected { background: #eef5ef; }
    .code {
      width: 42px;
      height: 34px;
      display: grid;
      place-items: center;
      color: #fff;
      border-radius: 7px;
      font-weight: 800;
      font-size: 13px;
    }
    .name { display: block; font-weight: 800; font-size: 16px; }
    .meta { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; line-height: 1.35; }
    .detail {
      position: fixed;
      right: 18px;
      bottom: 18px;
      width: 344px;
      padding: 14px;
      border: 1px solid #d4ded6;
      border-radius: 8px;
      background: #f8fbf7;
      font-size: 13px;
      line-height: 1.65;
      box-shadow: 0 8px 24px rgba(31,45,37,.08);
    }
    .maplibregl-ctrl-attrib { font-size: 11px; }
    .map-error {
      display: none;
      position: absolute;
      inset: 50% auto auto 50%;
      transform: translate(-50%, -50%);
      z-index: 2;
      width: min(520px, calc(100% - 48px));
      padding: 18px;
      border: 1px solid #d9b9b3;
      border-radius: 8px;
      background: rgba(255,255,255,.96);
      color: #6b2b24;
      line-height: 1.6;
      box-shadow: var(--shadow);
    }
    @media (max-width: 900px) {
      .app { grid-template-columns: 1fr; grid-template-rows: minmax(0, 62%) minmax(260px, 38%); }
      .side { border-left: 0; border-top: 1px solid #d8e0da; }
      .controls { width: calc(100% - 36px); }
      .detail { display: none; }
      h1 { font-size: 21px; }
    }
  </style>
</head>
<body>
  <main class="app">
    <section class="map-shell">
      <div id="map"></div>
      <div id="mapError" class="map-error">铁路底图需要浏览器启用 WebGL。当前环境无法初始化 MapLibre，因此仅显示右侧城市列表；请在普通 Chrome/Safari/Edge 浏览器中打开以查看精细铁路底图。</div>
      <div class="hud">
        <div class="title panel">
          <h1>亚朵酒店覆盖城市 × 中国铁路精细底图</h1>
          <div class="subtitle">共 ${total} 个检出城市；10+ 强覆盖 ${hubs} 个；铁路底图使用 cnrail/WTRANS2 矢量瓦片缓存，按 HSR、RR、R、F/其他、在建分类显示。</div>
        </div>
        <div class="legend panel">
          <span><i class="dot" style="background:var(--red)"></i>10+ 强覆盖</span>
          <span><i class="dot" style="background:var(--blue)"></i>1-9 检出</span>
          <span><i class="sample-line" style="border-color:#ef2f21"></i>HSR 高速铁路</span>
          <span><i class="sample-line" style="border-color:#f08a00"></i>RR 快速/动车通道</span>
          <span><i class="sample-line" style="border-color:#209a3b"></i>R 普速铁路</span>
          <span><i class="sample-line" style="border-color:#86a800"></i>F/其他</span>
        </div>
      </div>
      <div class="controls panel">
        <div class="rail-toggles" id="railToggles">
          <label><input type="checkbox" value="hsr" checked>HSR 高速</label>
          <label><input type="checkbox" value="rr" checked>RR 快速/动车</label>
          <label><input type="checkbox" value="r" checked>R 普速</label>
          <label><input type="checkbox" value="f" checked>F/其他</label>
          <label><input type="checkbox" value="construction">在建</label>
          <label><input id="showLabels" type="checkbox" checked>城市名</label>
        </div>
        <button id="fitMap" class="fit-button">适应全国</button>
      </div>
    </section>
    <aside class="side">
      <input id="search" class="search" placeholder="搜索城市、省份、区域或样例门店" autocomplete="off">
      <div class="filters">
        <button class="chip active" data-scope="all">全部 ${total}</button>
        <button class="chip" data-scope="hub">10+ 强覆盖 ${hubs}</button>
        <button class="chip" data-scope="minor">1-9 城市 ${total - hubs}</button>
      </div>
      <div class="regions" id="regions"></div>
      <div class="result-meta" id="resultMeta"></div>
      <div class="list" id="list"></div>
      <div class="detail" id="detail">选择城市后显示覆盖等级和样例门店。铁路底图直接来自 cnrail/WTRANS2 矢量线网缓存，分类遵循其线路 type 字段；不代表 12306 当日车次。</div>
    </aside>
  </main>
  <script src="./vendor/maplibre-gl.js"></script>
  <script>
    const CITIES = ${cityJson};
    const REGIONS = [
      { name: "新疆 / 西北", bounds: [[73, 34], [109, 50]] },
      { name: "青藏 / 川西", bounds: [[78, 26], [107, 39]] },
      { name: "东北 / 蒙东", bounds: [[112, 38], [135, 54]] },
      { name: "华北 / 黄淮", bounds: [[104, 31], [124, 43]] },
      { name: "长三角 / 华东", bounds: [[112, 26], [124, 35]] },
      { name: "华中 / 成渝", bounds: [[101, 27], [117, 35]] },
      { name: "西南 / 云贵桂", bounds: [[96, 20], [112, 32]] },
      { name: "华南 / 海岛", bounds: [[107, 18], [123, 26]] }
    ];
    const LAYER_GROUPS = {
      hsr: ["rail-hsr"],
      rr: ["rail-rr"],
      r: ["rail-r"],
      f: ["rail-f", "rail-other-minor"],
      construction: ["rail-construction"],
    };
    const color = { hub: "#c83b36", minor: "#2f78b7" };
    const markers = new Map();
    let selected = null;
    let activeScope = "all";

    let map = null;
    try {
      map = new maplibregl.Map({
        container: "map",
        style: "./cnrail_style_atour.json",
        center: [105, 35.8],
        zoom: 3.55,
        minZoom: 3,
        maxZoom: 11,
        attributionControl: false
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    } catch (error) {
      document.getElementById("mapError").style.display = "block";
    }

    const search = document.getElementById("search");
    const resultMeta = document.getElementById("resultMeta");
    const list = document.getElementById("list");
    const detail = document.getElementById("detail");
    const chips = [...document.querySelectorAll(".chip")];
    const showLabels = document.getElementById("showLabels");
    const railToggles = document.getElementById("railToggles");

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }
    function cityVisibleByScope(city) {
      if (activeScope === "hub") return city.hub;
      if (activeScope === "minor") return !city.hub;
      return true;
    }
    function cityVisibleBySearch(city) {
      const q = search.value.trim().toLowerCase();
      if (!q) return true;
      return [city.name, city.shortName, city.provinceName, city.region, city.density, city.samples]
        .some(value => String(value).toLowerCase().includes(q));
    }
    function visibleCities() {
      return CITIES.filter(city => cityVisibleByScope(city) && cityVisibleBySearch(city));
    }
    function makeMarker(city) {
      if (!map) return;
      const el = document.createElement("div");
      el.className = "marker " + (city.hub ? "hub" : "minor");
      el.title = city.shortName;
      const label = document.createElement("span");
      label.className = "marker-label";
      label.textContent = city.shortName;
      el.appendChild(label);
      el.addEventListener("click", () => selectCity(city, true));
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([city.lon, city.lat])
        .addTo(map);
      markers.set(city.adcode, { marker, el, label });
    }
    function renderMarkers() {
      if (!map) return;
      const visible = new Set(visibleCities().map(city => city.adcode));
      for (const city of CITIES) {
        const item = markers.get(city.adcode);
        if (!item) continue;
        const isVisible = visible.has(city.adcode);
        item.el.style.display = isVisible ? "" : "none";
        item.label.style.display = showLabels.checked && (city.hub || map.getZoom() >= 5.2 || search.value.trim()) ? "" : "none";
        item.el.classList.toggle("selected", selected && selected.adcode === city.adcode);
      }
    }
    function renderList(items = visibleCities()) {
      const scopeName = { all: "全部城市", hub: "10+ 强覆盖城市", minor: "1-9 城市" }[activeScope] || "城市";
      resultMeta.textContent = scopeName + "：显示 " + items.length + " 个";
      list.replaceChildren();
      for (const city of [...items].sort((a, b) => Number(b.hub) - Number(a.hub) || b.count - a.count || a.shortName.localeCompare(b.shortName, "zh-Hans-CN"))) {
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
    function refresh() {
      const items = visibleCities();
      renderMarkers();
      renderList(items);
    }
    function selectCity(city, fly) {
      selected = city;
      const sampleText = city.samples ? city.samples.split("；").slice(0, 6).join("；") : "无样例门店";
      detail.innerHTML = \`<strong>\${escapeHtml(city.shortName)}｜\${city.density}</strong><br>
        省份/区域：\${escapeHtml(city.provinceName)} · \${escapeHtml(city.region)}<br>
        检出条目：\${city.count}　坐标：\${city.lat.toFixed(4)}, \${city.lon.toFixed(4)}<br>
        <span>样例：\${escapeHtml(sampleText)}</span>\`;
      if (fly && map) map.flyTo({ center: [city.lon, city.lat], zoom: Math.max(map.getZoom(), 7), speed: 0.9 });
      refresh();
    }
    function fitChina() {
      if (!map) return;
      map.fitBounds([[73, 18], [135, 54]], { padding: { top: 90, right: 30, bottom: 60, left: 30 }, duration: 600 });
    }
    function setLayerVisibility() {
      if (!map) return;
      for (const [key, ids] of Object.entries(LAYER_GROUPS)) {
        const input = railToggles.querySelector(\`input[value="\${key}"]\`);
        const visibility = input && input.checked ? "visible" : "none";
        for (const id of ids) {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
        }
      }
    }
    for (const city of CITIES) makeMarker(city);
    for (const region of REGIONS) {
      const btn = document.createElement("button");
      btn.className = "region-btn";
      btn.textContent = region.name;
      btn.addEventListener("click", () => map && map.fitBounds(region.bounds, { padding: 70, duration: 600 }));
      document.getElementById("regions").appendChild(btn);
    }
    if (map) {
      map.on("load", () => {
        setLayerVisibility();
        fitChina();
        refresh();
      });
      map.on("zoom", renderMarkers);
    } else {
      refresh();
    }
    search.addEventListener("input", () => { selected = null; refresh(); });
    showLabels.addEventListener("change", renderMarkers);
    railToggles.addEventListener("change", setLayerVisibility);
    document.getElementById("fitMap").addEventListener("click", fitChina);
    chips.forEach(chip => chip.addEventListener("click", () => {
      chips.forEach(item => item.classList.remove("active"));
      chip.classList.add("active");
      activeScope = chip.dataset.scope;
      selected = null;
      refresh();
    }));
  </script>
</body>
</html>`;

fs.writeFileSync("atour_china_hotels_interactive.html", html);
fs.writeFileSync("index.html", html);
console.log("created cnrail-based atour map");
