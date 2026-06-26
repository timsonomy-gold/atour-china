# 亚朵酒店覆盖城市中国地图

这是一个可缩放、可搜索的亚朵酒店覆盖城市查询图，并叠加 cnrail/WTRANS2 精细铁路矢量底图，方便规划只入住亚朵酒店的铁路旅行线路。

## 查看

直接打开 `index.html`。

## 内容

- `index.html`: 可直接浏览的交互式全国地图，使用 MapLibre 加载本地缓存的 cnrail/WTRANS2 矢量瓦片
- `atour_china_hotels_interactive.html`: 同内容备份文件
- `atour_china_hotels_interactive_schematic.html`: 上一版手工铁路廊道示意图备份
- `cnrail_style_atour.json`: 本项目使用的 cnrail/WTRANS2 线路分类样式
- `cnrail_tiles/`: 中国范围 z1-z8 cnrail/WTRANS2 矢量瓦片缓存，用于 GitHub Pages 同源加载，避免 HTTPS 页面加载 HTTP 瓦片被拦截
- `vendor/`: 本地缓存的 MapLibre GL JS/CSS，减少线上访问对第三方 CDN 的依赖
- `atour_city_coverage_baidu_suggestion.csv`: 城市覆盖数据
- `generate_atour_cnrail_map.mjs`: 生成 MapLibre/cnrail 版本页面
- `download_cnrail_tiles.mjs`: 下载中国范围 cnrail/WTRANS2 矢量瓦片缓存
- `generate_atour_interactive_china_map.mjs`: 页面生成脚本
- `province_*_full.json`: 中国省级边界数据

## 数据口径

城市覆盖来自逐城查询百度地图搜索建议“城市 + 亚朵酒店”。每城最多返回 10 条，因此 `10+` 表示达到接口返回上限，不等于官方精确门店数。实际订房前请按日期在亚朵官方渠道或 OTA 再确认。

铁路层使用 cnrail/WTRANS2 矢量线网缓存，按其 `type` 字段分为 `HSR` 高速铁路、`RR` 快速/动车通道、`R` 普速铁路、`F/其他` 和 `在建` 图层。该底图比上一版手工城市连线更接近真实线路走向和分类，但仍不是 12306 当日车次图，也不表示所有经停站和当日可售车次。

## 复现

```bash
node generate_atour_cnrail_map.mjs
# 如需刷新铁路瓦片缓存：
node download_cnrail_tiles.mjs
```
