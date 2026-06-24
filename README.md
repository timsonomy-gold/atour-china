# 亚朵酒店覆盖城市中国地图

这是一个可缩放、可搜索的亚朵酒店覆盖城市查询图。

## 查看

直接打开 `index.html`。

## 内容

- `index.html`: 可直接浏览的交互式全国地图
- `atour_china_hotels_interactive.html`: 同内容备份文件
- `atour_city_coverage_baidu_suggestion.csv`: 城市覆盖数据
- `generate_atour_interactive_china_map.mjs`: 生成脚本
- `province_*_full.json`: 中国省级边界数据

## 数据口径

城市覆盖来自逐城查询百度地图搜索建议“城市 + 亚朵酒店”。每城最多返回 10 条，因此 `10+` 表示达到接口返回上限，不等于官方精确门店数。实际订房前请按日期在亚朵官方渠道或 OTA 再确认。

## 复现

```bash
node generate_atour_interactive_china_map.mjs
```

