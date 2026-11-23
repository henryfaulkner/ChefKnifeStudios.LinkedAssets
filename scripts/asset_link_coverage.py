#!/usr/bin/env python3
"""Snapshot a MyGeotab instance's automatic asset links and rank them by area coverage.

Coverage for a link is the greatest distance (km) between any two member devices'
latest reported positions at one captured snapshot instant, so a two-member link's
separation is directly observable; every pairwise member distance is also printed.
Membership uses the Linked Assets app's semantics: AssetLink records of linkType
Automatic, with member intervals evaluated at the snapshot instant. DeviceLink
(manual) links are out of scope. All requests are read-only Geotab `Get` calls with
property selectors limited to exactly the fields consumed here (constitution I).

Deterministic: one snapshot instant is captured up front, membership and positions
are evaluated against it, and output order is coverage descending, then link id.
Reruns against an unchanged database reproduce the same report. Pass `--at <RFC3339>`
to pin the snapshot instant instead of using the current time.

Credentials come from the cli-mygeotab session export (never committed or logged):
  MYG_EXPORTS=$(cli-mygeotab auth export) && eval "$MYG_EXPORTS" && \
      python3 scripts/asset_link_coverage.py
Two export shapes are supported: a legacy session (MYG_SESSION_ID, sent as the
JSON-RPC credentials object) or an IAM/Keycloak session (MYG_BEARER_TOKEN, sent as
Authorization + Database headers, the same contract the MyGeotab SPA uses). Both
require MYG_DATABASE (and MYG_USERNAME for the legacy shape); MYG_SERVER defaults
to my.geotab.com.
"""
from __future__ import annotations

import itertools
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

PAGE_SIZE = 1000
DETAILS_CAP = 1000
PARENT_BATCH = 50
EARTH_RADIUS_KM = 6371.0088

# Wire fields must match exactly what this script consumes; an omitted field stays unknown.
SELECTORS = {
    "AssetLink": ["id", "linkType", "isActive"],
    "AssetLinkDetails": ["id", "assetLinkId", "device", "activeFrom", "activeTo"],
    "Device": ["id", "name"],
    "DeviceStatusInfo": ["device", "latitude", "longitude", "dateTime"],
}


class RpcError(Exception):
    """A Geotab API call failed after its retry budget."""


def _retry_delay(header: str | None, attempt: int) -> float:
    try:
        return max(1.0, float(header))
    except (TypeError, ValueError):
        return 2.0 * (attempt + 1)


def call(host, auth, type_name: str, params: dict):
    """One read-only JSON-RPC Get; retries transient HTTP 429/5xx and OverLimit twice.

    `auth` is `(credentials, headers)`: classic sessions put a credentials object in
    the body; IAM sessions put the bearer token and database in headers instead.
    """
    credentials, auth_headers = auth
    body_params = {"typeName": type_name, **params}
    if credentials is not None:
        body_params["credentials"] = credentials
    body = json.dumps({"method": "Get", "params": body_params}).encode()
    for attempt in range(3):
        request = urllib.request.Request(host + "/apiv1", data=body,
                                         headers={"Content-Type": "application/json", **(auth_headers or {})},
                                         method="POST")
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if error.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(_retry_delay(error.headers.get("Retry-After"), attempt))
                continue
            raise RpcError(f"{type_name}: HTTP {error.code}") from None
        if payload.get("error"):
            name = payload["error"].get("name") or ""
            if "OverLimit" in name and attempt < 2:
                time.sleep(_retry_delay(None, attempt))
                continue
            raise RpcError(f"{type_name}: {name or 'request rejected'}")
        return payload.get("result")
    raise RpcError(f"{type_name}: retries exhausted")


def get_paged(host: str, auth, type_name: str, search: dict | None = None) -> list[dict]:
    """Complete read: sort by id ascending and advance the sort offset to the last id."""
    rows: dict[str, dict] = {}
    cursors: set[str] = set()
    offset = None
    while True:
        params = {"resultsLimit": PAGE_SIZE,
                  "propertySelector": {"fields": SELECTORS[type_name], "isIncluded": True},
                  "sort": {"sortBy": "id", "sortDirection": "asc", "offset": offset}}
        if search is not None:
            params["search"] = search
        page = call(host, auth, type_name, params) or []
        known = len(rows)
        for row in page:
            if isinstance(row, dict) and row.get("id"):
                rows[row["id"]] = row
        if len(page) < PAGE_SIZE:
            return list(rows.values())
        offset = page[-1].get("id")
        if not offset or offset in cursors or len(rows) == known:
            raise RpcError(f"{type_name}: paging did not advance")
        cursors.add(offset)


def get_details(host: str, auth, parent_ids: list[str]) -> list[dict]:
    """Member history for the given links, batched and split when a batch hits the read cap."""
    rows: dict[str, dict] = {}

    def read_batch(ids: list[str]) -> None:
        page = call(host, auth, "AssetLinkDetails",
                    {"resultsLimit": DETAILS_CAP, "search": {"assetLinkIds": ids},
                     "propertySelector": {"fields": SELECTORS["AssetLinkDetails"], "isIncluded": True}}) or []
        if len(page) >= DETAILS_CAP and len(ids) > 1:
            split = len(ids) // 2
            read_batch(ids[:split])
            read_batch(ids[split:])
            return
        if len(page) >= DETAILS_CAP:
            raise RpcError("AssetLinkDetails: a link's member history reached the read limit")
        allowed = set(ids)
        for row in page:
            if isinstance(row, dict) and row.get("id") and row.get("assetLinkId") in allowed:
                rows[row["id"]] = row

    for start in range(0, len(parent_ids), PARENT_BATCH):
        read_batch(parent_ids[start:start + PARENT_BATCH])
    return list(rows.values())


def instant(value) -> datetime | None:
    """Parsed UTC instant; missing, malformed or sentinel-minimum values stay unknown."""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.year <= 1:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def member_active(row: dict, snapshot: datetime) -> bool:
    """App interval semantics: start must be known and elapsed; a malformed end never reopens."""
    start = instant(row.get("activeFrom"))
    if start is None or start > snapshot:
        return False
    raw_end = row.get("activeTo")
    if raw_end is None:
        return True
    end = instant(raw_end)
    return end is not None and snapshot < end


def _position(row: dict) -> tuple[float, float] | None:
    latitude, longitude = row.get("latitude"), row.get("longitude")
    if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
        return None
    if not (math.isfinite(latitude) and -90 <= latitude <= 90
            and math.isfinite(longitude) and -180 <= longitude <= 180):
        return None
    return (float(latitude), float(longitude))


def latest_position(host: str, auth, device_id: str) -> tuple[float, float] | None:
    """Latest reported position for one device (DeviceStatusInfo, untracked included)."""
    page = call(host, auth, "DeviceStatusInfo",
                {"resultsLimit": PAGE_SIZE,
                 "search": {"deviceSearch": {"id": device_id}, "includeUntrackedDevices": True},
                 "propertySelector": {"fields": SELECTORS["DeviceStatusInfo"], "isIncluded": True}}) or []
    floor = datetime.min.replace(tzinfo=timezone.utc)
    best, best_key = None, floor
    for row in page:
        if not isinstance(row, dict) or (row.get("device") or {}).get("id") != device_id:
            continue
        when = instant(row.get("dateTime")) or floor
        if best is None or when > best_key:
            best, best_key = row, when
    return _position(best) if best is not None else None


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    half = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(half))


def main() -> None:
    server = (os.environ.get("MYG_SERVER") or "my.geotab.com").strip()
    server = server.removeprefix("https://").removesuffix("/")
    if "/" in server or "@" in server or not (server == "geotab.com" or server.endswith(".geotab.com")):
        sys.exit(f"Refusing non-Geotab host: {server}")
    database, username, session_id, bearer_token = (os.environ.get(k) for k in
                                                    ("MYG_DATABASE", "MYG_USERNAME", "MYG_SESSION_ID", "MYG_BEARER_TOKEN"))
    if session_id:
        if not (database and username):
            sys.exit("MYG_SESSION_ID requires MYG_DATABASE and MYG_USERNAME. Run:\n"
                     '  MYG_EXPORTS=$(cli-mygeotab auth export) && eval "$MYG_EXPORTS" && \\\n'
                     "      python3 scripts/asset_link_coverage.py")
        auth = ({"database": database, "userName": username, "sessionId": session_id}, None)
    elif bearer_token:
        if not database:
            sys.exit("MYG_BEARER_TOKEN requires MYG_DATABASE. Run:\n"
                     '  MYG_EXPORTS=$(cli-mygeotab auth export) && eval "$MYG_EXPORTS" && \\\n'
                     "      python3 scripts/asset_link_coverage.py")
        auth = (None, {"Authorization": "Bearer " + bearer_token, "Database": database})
    else:
        sys.exit("Missing MYG_SESSION_ID or MYG_BEARER_TOKEN. Run:\n"
                 '  MYG_EXPORTS=$(cli-mygeotab auth export) && eval "$MYG_EXPORTS" && \\\n'
                 "      python3 scripts/asset_link_coverage.py")
    snapshot = None
    if len(sys.argv) > 2 and sys.argv[1] == "--at":
        snapshot = instant(sys.argv[2])
        if snapshot is None:
            sys.exit(f"Unparseable --at instant: {sys.argv[2]}")
    snapshot = snapshot or datetime.now(timezone.utc)

    host = "https://" + server
    try:
        asset_links = get_paged(host, auth, "AssetLink", search={"isActive": True})
        automatic = sorted((link for link in asset_links
                            if link.get("linkType") == "Automatic" and link.get("isActive") is True),
                           key=lambda link: link["id"])
        details = get_details(host, auth, [link["id"] for link in automatic]) if automatic else []
        devices = {row["id"]: row.get("name") for row in get_paged(host, auth, "Device")}
    except RpcError as error:
        sys.exit(str(error))

    periods: dict[str, list[dict]] = {}
    for row in details:
        periods.setdefault(row.get("assetLinkId"), []).append(row)

    links: list[tuple[str, list[str]]] = []
    member_ids: set[str] = set()
    for link in automatic:
        members = sorted({(row.get("device") or {}).get("id") for row in periods.get(link["id"], [])
                          if (row.get("device") or {}).get("id") and member_active(row, snapshot)})
        member_ids.update(members)
        links.append((link["id"], members))

    positions: dict[str, tuple[float, float] | None] = {}
    for device_id in sorted(member_ids):
        positions[device_id] = latest_position(host, auth, device_id)

    print("Automatic asset links ranked by area coverage (greatest member separation)")
    print(f"Host: {server}  Database: {database}  "
          f"Snapshot (UTC): {snapshot.isoformat(timespec='seconds').replace('+00:00', 'Z')}")
    print(f"Automatic links: {len(links)}  Members: {len(member_ids)}  "
          f"Members with position: {sum(1 for value in positions.values() if value is not None)}")
    print()
    if not links:
        print("No active automatic asset links at this snapshot.")
        return

    ranked = []
    for link_id, members in links:
        located = [member for member in members if positions[member] is not None]
        pairs = [(distance_km(positions[a], positions[b]), a, b)
                 for a, b in itertools.combinations(sorted(members), 2)
                 if positions[a] is not None and positions[b] is not None]
        coverage = max((entry[0] for entry in pairs), default=0.0)
        ranked.append((coverage, link_id, members, pairs, located))
    ranked.sort(key=lambda entry: (-entry[0], entry[1]))

    for rank, (coverage, link_id, members, pairs, located) in enumerate(ranked, 1):
        print(f"{rank}. {coverage:.2f} km  AssetLink {link_id}")
        labels = [devices.get(member) or f"(name unavailable: {member})" for member in members]
        print(f"   members ({len(members)}): " + ", ".join(labels))
        if pairs:
            print("   distances: " + "; ".join(
                f"{devices.get(a, a)} - {devices.get(b, b)} {km:.2f} km" for km, a, b in sorted(pairs, reverse=True)))
        unpositioned = [member for member in members if positions[member] is None]
        if unpositioned:
            print("   no reported position: " + ", ".join(devices.get(member, member) for member in unpositioned))
        if len(located) < 2:
            print("   coverage not measurable: fewer than two members have positions at this snapshot")
        print()


if __name__ == "__main__":
    main()
