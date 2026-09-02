"""Build compact EZC territory metadata and copy GeoJSON into public/boundaries."""

from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "boundaries"
PUBLIC = ROOT / "public" / "boundaries"
OUT = ROOT / "src" / "lib" / "ezc-index.json"

SKIP_HARARE_NAMES = {"", "none", "####", "chit"}
SKIP_COVERAGE_ADM2 = {"harare"}  # pastoral districts cover Harare urban

DISTRICT_COLORS = ["#ffc24a", "#9eecff", "#5dffb2", "#ff4de8", "#7aa8ff", "#ff5d7a", "#c9b8ff"]
CHURCH_COLORS = ["#5dffb2", "#9eecff", "#ffc24a", "#ff4de8", "#7aa8ff", "#ff5d7a"]


def slug(value: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "_", (value or "").lower()).strip("_")
    return text or "unnamed"


def color_for(name: str, palette: list[str]) -> str:
    digest = hashlib.md5(name.encode("utf-8")).hexdigest()
    return palette[int(digest[:8], 16) % len(palette)]


def clean_name(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def rings_of(geom: dict) -> list[list[list[float]]]:
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    if geom["type"] == "MultiPolygon":
        rings: list[list[list[float]]] = []
        for poly in geom["coordinates"]:
            rings.extend(poly)
        return rings
    return []


def outer_rings(geom: dict) -> list[list[list[float]]]:
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon":
        return [poly[0] for poly in geom["coordinates"] if poly]
    return []


def ring_contains(ring: list[list[float]], lng: float, lat: float) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat):
            denom = (yj - yi) or 1e-15
            if lng < (xj - xi) * (lat - yi) / denom + xi:
                inside = not inside
        j = i
    return inside


def geom_contains(geom: dict, lng: float, lat: float) -> bool:
    if geom["type"] == "Polygon":
        coords = geom["coordinates"]
        if not coords or not ring_contains(coords[0], lng, lat):
            return False
        return not any(ring_contains(hole, lng, lat) for hole in coords[1:])
    if geom["type"] == "MultiPolygon":
        return any(geom_contains({"type": "Polygon", "coordinates": poly}, lng, lat) for poly in geom["coordinates"])
    return False


def bbox_of_geom(geom: dict) -> list[float] | None:
    min_lng = min_lat = float("inf")
    max_lng = max_lat = float("-inf")
    for ring in rings_of(geom or {}):
        for lng, lat, *_ in ring:
            if not (math.isfinite(lng) and math.isfinite(lat)):
                continue
            min_lng = min(min_lng, lng)
            max_lng = max(max_lng, lng)
            min_lat = min(min_lat, lat)
            max_lat = max(max_lat, lat)
    if not math.isfinite(min_lng):
        return None
    return [min_lat, min_lng, max_lat, max_lng]


def merge_bbox(boxes: list[list[float]]) -> list[float]:
    return [
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    ]


def candidate_points(geom: dict) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    box = bbox_of_geom(geom)
    if not box:
        return points
    points.append(((box[1] + box[3]) / 2, (box[0] + box[2]) / 2))
    for ring in outer_rings(geom):
        usable = ring[:-1] if len(ring) > 1 else ring
        if not usable:
            continue
        sx = sum(p[0] for p in usable)
        sy = sum(p[1] for p in usable)
        points.append((sx / len(usable), sy / len(usable)))
        step = max(1, len(usable) // 8)
        for p in usable[::step]:
            points.append((p[0], p[1]))
    return points


def representative_point(geom: dict) -> dict[str, float] | None:
    points = candidate_points(geom)
    if not points:
        return None
    for lng, lat in points:
        if geom_contains(geom, lng, lat):
            return {"lat": round(lat, 6), "lng": round(lng, 6)}
    lng, lat = points[0]
    if not (math.isfinite(lat) and math.isfinite(lng)):
        return None
    return {"lat": round(lat, 6), "lng": round(lng, 6)}


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for name in ("ezc_boundary.geojson", "harare_boundaries.geojson", "church_territories_official.geojson"):
        shutil.copy2(SRC / name, PUBLIC / name)

    ezc = load_json(SRC / "ezc_boundary.geojson")
    harare = load_json(SRC / "harare_boundaries.geojson")
    churches = load_json(SRC / "church_territories_official.geojson")

    harare_districts: list[dict] = []
    seen_names: set[str] = set()
    for index, feature in enumerate(harare["features"]):
        raw = clean_name(feature["properties"].get("District"))
        if raw.lower() in SKIP_HARARE_NAMES:
            continue
        key = slug(raw)
        if key in seen_names:
            continue
        seen_names.add(key)
        name = raw.replace("Harare  South", "Harare South")
        pastor = clean_name(feature["properties"].get("Pastor"))
        harare_districts.append(
            {
                "id": f"hdist_{key}",
                "name": name,
                "shortName": name,
                "pastorName": pastor or None,
                "color": color_for(name, DISTRICT_COLORS),
                "featureIndex": index,
                "kind": "harare_pastoral",
            }
        )

    coverage: dict[str, dict] = {}
    for ezc_index, feature in enumerate(ezc["features"]):
        adm2 = clean_name(feature["properties"].get("adm2_name"))
        if not adm2 or adm2.lower() in SKIP_COVERAGE_ADM2:
            continue
        coverage[adm2] = {
            "id": f"dist_{slug(adm2)}",
            "name": adm2,
            "shortName": adm2,
            "adm1": clean_name(feature["properties"].get("adm1_name")),
            "color": color_for(adm2, DISTRICT_COLORS),
            "kind": "ezc_coverage",
            "featureIndex": ezc_index,
            "adm2Name": adm2,
        }

    church_rows: list[dict] = []
    used_ids: set[str] = set()
    for index, feature in enumerate(churches["features"]):
        props = feature["properties"]
        church_id = (props.get("church_id") or "").strip() or "NONE"
        name = clean_name(props.get("church_name") or props.get("name") or f"Church {index + 1}")
        civic = clean_name(props.get("district")) or "Unassigned"
        tid = church_id if church_id != "NONE" else f"none_{index}"
        if tid in used_ids:
            tid = f"{tid}_{index}"
        used_ids.add(tid)
        territory_id = f"ct_{tid}"
        pin = representative_point(feature["geometry"])
        parent_id = None
        pip_points: list[tuple[float, float]] = []
        if pin:
            pip_points.append((pin["lng"], pin["lat"]))
        pip_points.extend(candidate_points(feature["geometry"]))
        for lng, lat in pip_points:
            for district in harare_districts:
                geom = harare["features"][district["featureIndex"]]["geometry"]
                if geom_contains(geom, lng, lat):
                    parent_id = district["id"]
                    break
            if parent_id:
                break
        if not parent_id:
            if civic.lower() == "harare":
                parent_id = "hdist_harare_central"
            else:
                coverage.setdefault(
                    civic,
                    {
                        "id": f"dist_{slug(civic)}",
                        "name": civic,
                        "shortName": civic,
                        "color": color_for(civic, DISTRICT_COLORS),
                        "kind": "ezc_coverage",
                    },
                )
                parent_id = coverage[civic]["id"]
        church_rows.append(
            {
                "id": territory_id,
                "name": name,
                "shortName": name,
                "parentId": parent_id,
                "civicDistrict": civic,
                "sourceChurchId": church_id,
                "color": color_for(name, CHURCH_COLORS),
                **({"pin": pin} if pin else {}),
                "featureIndex": index,
            }
        )

    def find_church(*needles: str) -> dict:
        for row in church_rows:
            hay = row["name"].lower()
            if all(n.lower() in hay for n in needles):
                return row
        raise SystemExit(f"Could not find church matching {needles}")

    waterfalls = find_church("waterfalls central")
    highlands = next(row for row in church_rows if row["name"] == "Highlands")
    central = next((row for row in church_rows if row["name"] == "Harare Main"), None)
    if not central:
        central = next(row for row in church_rows if row["parentId"] == "hdist_harare_central")

    boxes = [box for box in (bbox_of_geom(ft["geometry"]) for ft in ezc["features"]) if box]
    bbox = merge_bbox(boxes)

    index_doc = {
        "version": "ezc_official_v1",
        "pitch": "SHEPHERD360 starts with the East Zimbabwe Conference and rolls the same SDA hierarchy worldwide.",
        "files": {
            "conference": "/boundaries/ezc_boundary.geojson",
            "harareDistricts": "/boundaries/harare_boundaries.geojson",
            "churches": "/boundaries/church_territories_official.geojson",
        },
        "bbox": bbox,
        "gc": {"id": "ter_gc", "name": "General Conference of Seventh-day Adventists", "shortName": "GC"},
        "division": {
            "id": "ter_sid",
            "name": "Southern Africa-Indian Ocean Division",
            "shortName": "SID",
        },
        "union": {"id": "ter_zuc", "name": "Zimbabwe Union Conference", "shortName": "ZUC"},
        "conference": {
            "id": "ter_zec",
            "name": "East Zimbabwe Conference",
            "shortName": "EZC",
            "code": "EZC",
        },
        "harareDistricts": [{k: v for k, v in row.items() if k != "kind"} for row in harare_districts],
        "coverageDistricts": sorted(
            [{k: v for k, v in row.items() if k != "kind"} for row in coverage.values()],
            key=lambda row: row["name"],
        ),
        "churches": church_rows,
        "demoLinks": {
            "conferenceId": "ter_zec",
            "harareCentralDistrictId": "hdist_harare_central",
            "waterfallsDistrictId": "hdist_waterfalls",
            "highlandsDistrictId": "hdist_highlands",
            "centralChurchTerritoryId": central["id"],
            "waterfallsChurchTerritoryId": waterfalls["id"],
            "eastviewChurchTerritoryId": highlands["id"],
            "centralChurchName": central["name"],
            "waterfallsChurchName": waterfalls["name"],
            "eastviewChurchName": highlands["name"],
        },
        "counts": {
            "harareDistricts": len(harare_districts),
            "coverageDistricts": len(coverage),
            "churches": len(church_rows),
        },
    }

    OUT.write_text(json.dumps(index_doc, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    print(
        f"Wrote {OUT.name}: {index_doc['counts']} demo={index_doc['demoLinks']['centralChurchName']}, "
        f"{index_doc['demoLinks']['waterfallsChurchName']}, {index_doc['demoLinks']['eastviewChurchName']}"
    )


if __name__ == "__main__":
    main()
