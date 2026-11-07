# Tribal TV — Android catalogue API (read-only contract)

The Android app reads the built-in channel catalogue straight from Supabase's
auto-generated REST API (PostgREST). There is **no Edge Function** in this path.
Row Level Security decides what the app can see.

> **Not yet verified against the Android source.** This contract was written from
> the database schema and the description of the existing player (per-stream
> User-Agent / Referer / Origin, Room caching, `tvg_id` EPG matching). The Kotlin
> files (`M3uChannel.kt`, `ChannelEntity.kt`, `M3uPlaylistParser.kt`,
> `PlayerFactory.kt`) were not available when this was written. Check the field
> mapping below against them before implementing.

## Connection

| Item | Value |
|---|---|
| Base URL | `https://<project-ref>.supabase.co/rest/v1` (project ref: `jigzoerxsbumpijksveo`) |
| Header | `apikey: <publishable key>` (`sb_publishable_…`) |
| Legacy anon JWT keys | also send `Authorization: Bearer <same key>` |
| Secrets in the app | **Only** the URL and the publishable key. Never a service-role or secret key. |

Anonymous (`anon`) requests may read only: `catalogue_meta`, **active** categories,
**active** channels in an active category, and **active** streams of those channels.
Inactive rows are simply absent from responses.

> **Stream URLs and headers are public.** Anyone who has the publishable key can
> list active streams. Treat them as public, never as secrets. Do not put
> credentials in stream URLs or headers. They can also be captured from network
> traffic. `http://` streams are allowed (the app currently permits cleartext).

## 1. Check the catalogue version (cheap, do this on every refresh)

```
GET /catalogue_meta?select=version,updated_at&id=eq.1
```
```json
[{ "version": 12, "updated_at": "2026-11-06T09:30:11.512+00:00" }]
```
`version` increases by 1 for every write statement touching categories, channels
or streams. If it equals the cached version, stop.

## 2. Download categories

```
GET /channel_categories?select=id,slug,name,sort_order&order=sort_order.asc,id.asc
```
```json
[{ "id": "b4f1…", "slug": "news", "name": "News", "sort_order": 10 }]
```

## 3. Download channels with their streams (paginate)

```
GET /channels
  ?select=id,slug,name,category_id,logo_url,country,language,epg_id,sort_order,
          channel_streams!inner(id,stream_url,stream_type,priority,user_agent,referer,origin)
  &channel_streams.order=priority.asc
  &order=sort_order.asc,id.asc
  &limit=500&offset=0
```
- `channel_streams!inner` returns only channels that have **at least one enabled
  stream**, which is what the player needs.
- Request more pages with `offset=500`, `1000`, … until a page returns fewer than
  `limit` rows. The server caps a response at 1000 rows.
- `order=sort_order.asc,id.asc` gives a stable order across pages.

```json
[
  {
    "id": "1d0c…",
    "slug": "example-news",
    "name": "Example News",
    "category_id": "b4f1…",
    "logo_url": "https://jigzoerxsbumpijksveo.supabase.co/storage/v1/object/public/channel-logos/6f2c….png",
    "country": "GB",
    "language": "en",
    "epg_id": "ExampleNews.uk",
    "sort_order": 10,
    "channel_streams": [
      { "id": "a1…", "stream_url": "https://example.com/live/a.m3u8", "stream_type": "hls",
        "priority": 0, "user_agent": "TribalTV/1.0", "referer": "https://example.com/", "origin": "https://example.com" },
      { "id": "a2…", "stream_url": "https://backup.example.net/live/b.m3u8", "stream_type": "hls",
        "priority": 1, "user_agent": null, "referer": null, "origin": null }
    ]
  }
]
```

## Field reference

| Field | Type | Notes |
|---|---|---|
| `channels.id` | uuid | Stable key for Room |
| `channels.slug` | string | Stable human identifier |
| `channels.name` | string | Display name |
| `channels.category_id` | uuid | Always set; join to `channel_categories.id` |
| `channels.logo_url` | string \| null | `https://` only. File names are unique (UUID), so a changed logo has a new URL |
| `channels.country` | string \| null | ISO 3166-1 alpha-2, upper case |
| `channels.language` | string \| null | ISO 639 code, lower case |
| `channels.epg_id` | string \| null | XMLTV / `tvg-id` value, no spaces |
| `channels.sort_order` | int | Lower is first (global order) |
| `channel_streams.stream_type` | `hls` \| `dash` \| `progressive` | Choose the Media3 media source from this |
| `channel_streams.priority` | int ≥ 0 | **0 is tried first**; higher numbers are backups |
| `channel_streams.user_agent` / `referer` / `origin` | string \| null | Per stream. Apply to that stream's HTTP data source only |

## Mapping to the M3U model the app already uses (verify against the Kotlin files)

| M3U / app concept | Catalogue field |
|---|---|
| `tvg-id` (EPG matching) | `epg_id` |
| `tvg-name` / channel title | `name` |
| `tvg-logo` | `logo_url` |
| `group-title` | category `name` via `category_id` |
| `http-user-agent` | `user_agent` (per stream) |
| `http-referrer` | `referer` (per stream) |
| `http-origin` | `origin` (per stream) |
| Stream URL | `stream_url` |

## Sync algorithm (recommended)

1. On app start and on a timer or pull-to-refresh, call **§1**.
2. If the version is unchanged → use the Room cache.
3. If changed → download §2 and §3 **completely**; then read the version again.
   If it changed during the download, repeat (at most twice).
4. Replace the built-in rows in Room **in one transaction**, then store the new
   version. Never store the new version before the data is fully saved.
5. Any network or HTTP error → keep and use the existing Room cache (offline fallback).
6. Playback: sort a channel's streams by `priority` ascending; try the next one when
   playback fails.
7. Deletions are not reported individually; a full replace in step 4 handles them.
   Prefer deactivating over deleting in the dashboard.

Personal M3U playlists stay entirely on the device and must not be mixed into the
same Room tables as the built-in catalogue (use a separate table or a source flag).

## Errors

| HTTP | Meaning | App behaviour |
|---|---|---|
| 200 / 206 | OK | Use the data |
| 401 / 403 | Wrong or missing `apikey` | Treat as a configuration error; keep the cache |
| 404 / 5xx / timeout | Service problem | Keep the cache and retry later |
