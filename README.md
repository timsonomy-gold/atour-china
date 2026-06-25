# 亚朵酒店覆盖城市中国地图

这是一个可缩放、可搜索的亚朵酒店覆盖城市查询图，并叠加铁路干线廊道，方便规划只入住亚朵酒店的铁路旅行线路。

## 查看

直接打开 `index.html`。

## 内容

- `index.html`: 可直接浏览的交互式全国地图，含高铁、动车、普速铁路图层开关
- `atour_china_hotels_interactive.html`: 同内容备份文件
- `atour_city_coverage_baidu_suggestion.csv`: 城市覆盖数据
- `generate_atour_interactive_china_map.mjs`: 页面生成脚本
- `extract_cnrail_rail_tiles.mjs`: 从公开铁路矢量瓦片抽取高铁/动车线路的辅助脚本
- `rail_routes_wtrans2_20260325.json`: 高铁/动车线路抽取结果
- `province_*_full.json`: 中国省级边界数据

## 数据口径

城市覆盖来自逐城查询百度地图搜索建议“城市 + 亚朵酒店”。每城最多返回 10 条，因此 `10+` 表示达到接口返回上限，不等于官方精确门店数。实际订房前请按日期在亚朵官方渠道或 OTA 再确认。

高铁/动车层来自 `railmap.geogv.org` 的 `wtrans2-20260325` 公开铁路矢量瓦片，抽取 `HSR/HSR2` 为高铁、`RR/RR2` 为动车/快速铁路，用于观察“有亚朵覆盖城市”和铁路旅行网络的重叠关系。普速层目前仍为干线示意，后续可继续补足；铁路层不代表实时 12306 全量运行图，也不表示所有经停站和当日车次。

## 复现

```bash
node generate_atour_interactive_china_map.mjs
```

如需重新抽取高铁/动车瓦片数据，先准备临时解码依赖：

```bash
npm install --prefix /tmp/atour-rail-tools @mapbox/vector-tile pbf
node extract_cnrail_rail_tiles.mjs
node generate_atour_interactive_china_map.mjs
```
