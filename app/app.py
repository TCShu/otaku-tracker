import re
import requests as http
from flask import Flask, jsonify, render_template, request
from database import get_db_connection

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("dashboard.html")

JIKAN  = "https://api.jikan.moe/v4"
ANILIST = "https://graphql.anilist.co"

# ─── Normalization helpers ───────────────────────────────────────────────────

def _parse_duration(raw):
    if not raw:
        return None
    m = re.search(r"(\d+)\s*min", str(raw))
    return int(m.group(1)) if m else None

def _strip_html(text):
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()

def _jikan_status(raw):
    finished = {"Finished Airing", "Finished", "Discontinued", "Complete"}
    return "Finished" if raw in finished else "Ongoing"

def normalize_jikan_anime(item):
    return {
        "external_id":        f"mal_{item['mal_id']}",
        "source":             "mal",
        "title":              item.get("title_english") or item.get("title", ""),
        "type":               "anime",
        "year":               item.get("year") or (item.get("aired") or {}).get("prop", {}).get("from", {}).get("year"),
        "status":             _jikan_status(item.get("status", "")),
        "total_episodes":     item.get("episodes"),
        "total_chapters":     None,
        "avg_episode_duration": _parse_duration(item.get("duration")),
        "average_score":      item.get("score"),
        "description":        item.get("synopsis", ""),
        "cover_image_url":    (item.get("images") or {}).get("jpg", {}).get("large_image_url"),
        "genres":             [g["name"] for g in item.get("genres", [])],
    }

def normalize_jikan_manga(item):
    raw_type = (item.get("type") or "").lower()
    media_type = "manhwa" if raw_type == "manhwa" else "manga"
    return {
        "external_id":        f"mal_{item['mal_id']}",
        "source":             "mal",
        "title":              item.get("title_english") or item.get("title", ""),
        "type":               media_type,
        "year":               (item.get("published") or {}).get("prop", {}).get("from", {}).get("year"),
        "status":             _jikan_status(item.get("status", "")),
        "total_episodes":     None,
        "total_chapters":     item.get("chapters"),
        "avg_episode_duration": None,
        "average_score":      item.get("score"),
        "description":        item.get("synopsis", ""),
        "cover_image_url":    (item.get("images") or {}).get("jpg", {}).get("large_image_url"),
        "genres":             [g["name"] for g in item.get("genres", [])],
    }

_ANILIST_QUERY = """
query ($search: String, $type: MediaType, $format_in: [MediaFormat], $country: CountryCode, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(search: $search, type: $type, format_in: $format_in, countryOfOrigin: $country, sort: SCORE_DESC) {
      id
      title { english romaji }
      type
      format
      status
      startDate { year }
      episodes
      chapters
      averageScore
      description(asHtml: false)
      coverImage { large }
      genres
      countryOfOrigin
    }
  }
}
"""

def _anilist_type(item):
    fmt     = item.get("format", "")
    country = item.get("countryOfOrigin", "JP")
    if fmt in ("TV", "TV_SHORT", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC"):
        return "anime"
    if fmt == "NOVEL":
        return "light_novel"
    if country == "KR":
        return "manhwa"
    return "manga"

def _anilist_status(raw):
    return "Finished" if raw in ("FINISHED",) else "Ongoing"

def normalize_anilist(item):
    score = item.get("averageScore")
    return {
        "external_id":        f"anilist_{item['id']}",
        "source":             "anilist",
        "title":              item["title"].get("english") or item["title"].get("romaji", ""),
        "type":               _anilist_type(item),
        "year":               (item.get("startDate") or {}).get("year"),
        "status":             _anilist_status(item.get("status", "")),
        "total_episodes":     item.get("episodes"),
        "total_chapters":     item.get("chapters"),
        "avg_episode_duration": None,
        "average_score":      round(score / 10, 1) if score else None,
        "description":        _strip_html(item.get("description", "")),
        "cover_image_url":    (item.get("coverImage") or {}).get("large"),
        "genres":             item.get("genres", []),
    }

def _call_anilist(variables):
    try:
        r = http.post(ANILIST, json={"query": _ANILIST_QUERY, "variables": variables}, timeout=8)
        return r.json().get("data", {}).get("Page", {}).get("media", [])
    except Exception:
        return []

# ─── Browse top (Jikan top lists) ────────────────────────────────────────────

@app.route("/browse/top")
def browse_top():
    media_type = request.args.get("type", "anime")   # anime | manga
    page       = int(request.args.get("page", 1))

    endpoint = "anime" if media_type == "anime" else "manga"
    try:
        r = http.get(f"{JIKAN}/top/{endpoint}", params={
            "page": page, "limit": 24
        }, timeout=8)
        raw = r.json().get("data", [])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    normalize = normalize_jikan_anime if endpoint == "anime" else normalize_jikan_manga
    results   = [normalize(item) for item in raw]

    has_next = len(raw) == 24
    return jsonify({"results": results, "has_next": has_next, "page": page})

# ─── Search ──────────────────────────────────────────────────────────────────

@app.route("/search")
def search():
    q          = request.args.get("q", "").strip()
    media_type = request.args.get("type", "")

    if not q:
        return jsonify([])

    results = []

    try:
        if media_type == "anime" or not media_type:
            r = http.get(f"{JIKAN}/anime", params={"q": q, "limit": 20}, timeout=8)
            for item in r.json().get("data", []):
                results.append(normalize_jikan_anime(item))

        if media_type in ("manga", ""):
            r = http.get(f"{JIKAN}/manga", params={"q": q, "limit": 20}, timeout=8)
            for item in r.json().get("data", []):
                results.append(normalize_jikan_manga(item))

        if media_type == "manhwa":
            items = _call_anilist({"search": q, "type": "MANGA", "country": "KR", "perPage": 20})
            for item in items:
                results.append(normalize_anilist(item))

        if media_type == "light_novel":
            items = _call_anilist({"search": q, "type": "MANGA", "format_in": ["NOVEL"], "perPage": 20})
            for item in items:
                results.append(normalize_anilist(item))

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # deduplicate by external_id
    seen = set()
    unique = []
    for r in results:
        if r["external_id"] not in seen:
            seen.add(r["external_id"])
            unique.append(r)

    return jsonify(unique)

# ─── Series import (API → your DB) ───────────────────────────────────────────

@app.route("/series/import", methods=["POST"])
def import_series():
    data = request.get_json()
    ext_id = data.get("external_id")

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Return existing row if already imported
    cursor.execute("SELECT series_id FROM Series WHERE external_id = %s", (ext_id,))
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        conn.close()
        return jsonify({"series_id": existing["series_id"]})

    # Insert series
    cursor.execute("""
        INSERT INTO Series
            (title, type, year, status, total_episodes, total_chapters,
             avg_episode_duration, average_score, description, cover_image_url,
             source, external_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        data.get("title"), data.get("type"), data.get("year"),
        data.get("status"), data.get("total_episodes"), data.get("total_chapters"),
        data.get("avg_episode_duration"), data.get("average_score"),
        data.get("description"), data.get("cover_image_url"),
        data.get("source"), ext_id,
    ))
    series_id = cursor.lastrowid

    # Insert genres
    for genre_name in (data.get("genres") or []):
        cursor.execute(
            "INSERT IGNORE INTO Genres (genre_name) VALUES (%s)", (genre_name,)
        )
        cursor.execute(
            "SELECT genre_id FROM Genres WHERE genre_name = %s", (genre_name,)
        )
        genre = cursor.fetchone()
        if genre:
            cursor.execute(
                "INSERT IGNORE INTO SeriesGenres (series_id, genre_id) VALUES (%s, %s)",
                (series_id, genre["genre_id"]),
            )

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"series_id": series_id})

# ─── Series (local DB) ───────────────────────────────────────────────────────

@app.route("/series-browse")
def series_browse():
    type_filter   = request.args.get("type")
    status_filter = request.args.get("status")
    sort          = request.args.get("sort", "score")
    search        = request.args.get("search", "").strip()
    user_id       = request.args.get("user_id", 1)

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT s.series_id, s.title, s.type, s.year, s.status,
               s.total_episodes, s.total_chapters, s.average_score,
               s.description, s.cover_image_url,
               GROUP_CONCAT(g.genre_name ORDER BY g.genre_name SEPARATOR ',') AS genres
        FROM Series s
        LEFT JOIN SeriesGenres sg ON s.series_id = sg.series_id
        LEFT JOIN Genres g        ON sg.genre_id  = g.genre_id
        WHERE s.series_id NOT IN (
            SELECT series_id FROM UserLibrary WHERE user_id = %s
        )
    """
    params = [user_id]

    if type_filter:
        query += " AND s.type = %s"
        params.append(type_filter)
    if status_filter:
        query += " AND s.status = %s"
        params.append(status_filter)
    if search:
        query += " AND s.title LIKE %s"
        params.append(f"%{search}%")

    query += " GROUP BY s.series_id"
    if sort == "alphabetical":
        query += " ORDER BY s.title ASC"
    elif sort == "year":
        query += " ORDER BY s.year DESC"
    else:
        query += " ORDER BY s.average_score DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    for row in rows:
        raw = row.get("genres") or ""
        row["genres"] = [g for g in raw.split(",") if g] if raw else []

    return jsonify(rows)

@app.route("/series")
def get_series():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM Series")
    series = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(series)

# ─── Library ─────────────────────────────────────────────────────────────────

@app.route("/library/<int:user_id>")
def get_library(user_id):
    status_filter = request.args.get("status")

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT s.series_id, s.title, s.type, s.year, s.status AS series_status,
               s.total_episodes, s.total_chapters, s.average_score,
               s.description, s.cover_image_url,
               ul.status, ul.progress, ul.rating, ul.date_added,
               GROUP_CONCAT(g.genre_name ORDER BY g.genre_name SEPARATOR ',') AS genres
        FROM UserLibrary ul
        JOIN Series s ON ul.series_id = s.series_id
        LEFT JOIN SeriesGenres sg ON s.series_id = sg.series_id
        LEFT JOIN Genres g        ON sg.genre_id  = g.genre_id
        WHERE ul.user_id = %s
    """
    params = [user_id]

    if status_filter and status_filter != "All":
        query += " AND ul.status = %s"
        params.append(status_filter)

    sort = request.args.get("sort", "recent")
    query += " GROUP BY ul.library_id"
    if sort == "title":
        query += " ORDER BY s.title ASC"
    elif sort == "rating":
        query += " ORDER BY ul.rating DESC, ul.date_added DESC"
    elif sort == "status":
        query += " ORDER BY ul.status ASC, s.title ASC"
    else:
        query += " ORDER BY ul.date_added DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    for row in rows:
        raw = row.get("genres") or ""
        row["genres"] = [g for g in raw.split(",") if g] if raw else []
        if row.get("date_added"):
            row["date_added"] = str(row["date_added"])

    return jsonify(rows)

@app.route("/library-stats/<int:user_id>")
def get_library_stats(user_id):
    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT status, COUNT(*) AS count
        FROM UserLibrary
        WHERE user_id = %s
        GROUP BY status
    """, (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    stats = {"watching": 0, "completed": 0, "planned": 0, "dropped": 0, "total": 0}
    for row in rows:
        key = row["status"].lower()
        if key in stats:
            stats[key] = row["count"]
        stats["total"] += row["count"]
    return jsonify(stats)

@app.route("/library/entry/<int:user_id>/<int:series_id>")
def get_library_entry(user_id, series_id):
    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT ul.status, ul.progress, ul.rating
        FROM UserLibrary ul
        WHERE ul.user_id = %s AND ul.series_id = %s
    """, (user_id, series_id))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return jsonify(row or {})

@app.route("/library/update", methods=["PUT"])
def update_library_entry():
    data      = request.get_json()
    user_id   = data.get("user_id")
    series_id = data.get("series_id")
    status    = data.get("status")
    progress  = data.get("progress", 0)
    rating    = data.get("rating")

    conn   = get_db_connection()
    cursor = conn.cursor()
    # Upsert so it works even if the row was just inserted by /library/add
    cursor.execute("""
        INSERT INTO UserLibrary (user_id, series_id, status, progress, rating)
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            status   = VALUES(status),
            progress = VALUES(progress),
            rating   = VALUES(rating)
    """, (user_id, series_id, status, progress, rating))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"success": True})

@app.route("/library/remove", methods=["DELETE"])
def remove_from_library():
    data      = request.get_json()
    user_id   = data.get("user_id")
    series_id = data.get("series_id")

    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM UserLibrary WHERE user_id = %s AND series_id = %s",
        (user_id, series_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"success": True})

@app.route("/library/add", methods=["POST"])
def add_to_library():
    data      = request.get_json()
    user_id   = data.get("user_id")
    series_id = data.get("series_id")
    status    = data.get("status", "Watching")

    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO UserLibrary (user_id, series_id, status)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE status = VALUES(status)
    """, (user_id, series_id, status))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"success": True})

# ─── Jikan-powered smart recommendations ─────────────────────────────────────

# MAL genre IDs mapped to each mood
MOOD_GENRES = {
    "Hype":      [1, 30, 76],      # Action, Sports, Award Winning
    "Cozy":      [36, 4],          # Slice of Life, Comedy
    "Emotional": [8, 22, 36],      # Drama, Romance, Slice of Life
    "Romance":   [22, 74],         # Romance, Iyashikei
    "Dark":      [14, 40, 41, 58], # Horror, Psychological, Thriller, Gore
    "Adventure": [2, 10, 24],      # Adventure, Fantasy, Sci-Fi
    "Mystery":   [7, 40, 39],      # Mystery, Psychological, Detective
}

@app.route("/recommendations/smart")
def smart_recommendations():
    mood       = request.args.get("mood", "Hype")
    commitment = request.args.get("commitment", "Medium")

    genre_ids    = MOOD_GENRES.get(mood, [1])
    genres_param = ",".join(str(g) for g in genre_ids)

    ep_ranges = {
        "Short":  (None, 13),
        "Medium": (12, 52),
        "Long":   (49, None),
    }
    ep_min, ep_max = ep_ranges.get(commitment, (None, None))

    def fetch_genre(genres, limit=25):
        try:
            r = http.get(f"{JIKAN}/anime", params={
                "genres": genres, "order_by": "score",
                "sort": "desc", "limit": limit,
            }, timeout=10)
            return r.json().get("data", [])
        except Exception:
            return []

    # Primary fetch with all mood genres
    items = fetch_genre(genres_param)

    # Fallback: use only the first (strongest) genre if primary gave nothing
    if not items and len(genre_ids) > 1:
        items = fetch_genre(str(genre_ids[0]))

    # Second fallback: top anime overall
    if not items:
        try:
            r = http.get(f"{JIKAN}/top/anime", params={"limit": 25}, timeout=10)
            items = r.json().get("data", [])
        except Exception:
            pass

    # Score each item: preference match, but never discard entirely
    def score_item(item):
        eps = item.get("episodes")
        s   = 0
        if eps is not None:
            if ep_min and eps >= ep_min:
                s += 2
            if ep_max and eps <= ep_max:
                s += 2
            # penalise (but keep) out-of-range entries
            if ep_min and eps < ep_min:
                s -= 1
            if ep_max and eps > ep_max:
                s -= 1
        return s

    scored = sorted(items, key=score_item, reverse=True)
    results = [normalize_jikan_anime(i) for i in scored[:12]]
    return jsonify(results)

# ─── DB recommendations (legacy, used by dashboard widget) ────────────────────

@app.route("/recommendations")
def get_recommendations():
    mood          = request.args.get("mood")
    user_id       = request.args.get("user_id")
    type_filter   = request.args.get("type")
    status_filter = request.args.get("status")
    sort          = request.args.get("sort")

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT s.series_id, s.title, s.type, s.cover_image_url,
               SUM(mgm.relevance_score) AS recommendation_score
        FROM Series s
        JOIN SeriesGenres sg      ON s.series_id = sg.series_id
        JOIN MoodGenreMapping mgm ON sg.genre_id  = mgm.genre_id
        WHERE mgm.mood_name = %s
        AND s.series_id NOT IN (
            SELECT series_id FROM UserLibrary WHERE user_id = %s
        )
    """
    params = [mood, user_id]

    if type_filter:
        query += " AND s.type = %s"
        params.append(type_filter)
    if status_filter:
        query += " AND s.status = %s"
        params.append(status_filter)

    query += " GROUP BY s.series_id"
    query += " ORDER BY s.title ASC" if sort == "alphabetical" else " ORDER BY recommendation_score DESC"
    query += " LIMIT 10"

    cursor.execute(query, params)
    results = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True)
