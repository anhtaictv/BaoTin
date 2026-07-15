# `districts.boundary` is `Geometry(MultiPolygon,4326)`, not `Polygon`

`docs/DATABASE_SCHEMA.md` originally specified `boundary GEOMETRY(Polygon, 4326)`. The real administrative boundary data we import (`data/raw/Daklak.geojson`, 102 xã/phường of Đắk Lắk post-2025 merger) has every feature typed `MultiPolygon` — post-merger wards routinely combine multiple disjoint polygons. The column type was changed to match the real data rather than force a lossy conversion at import time; `ST_Contains` works identically against `MultiPolygon`.
