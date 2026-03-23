from flask import Flask, jsonify
from database import get_db_connection

app = Flask(__name__)

@app.route("/")
def home():
    return "OtakuTracker API running"

@app.route("/series")
def get_series():

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM Series")

    series = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(series)

@app.route("/library/<int:user_id>")
def get_library(user_id):

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT s.title, ul.status, ul.progress, ul.rating
        FROM UserLibrary ul
        JOIN Series s ON ul.series_id = s.series_id
        WHERE ul.user_id = %s
    """, (user_id,))

    results = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(results)

from flask import request

@app.route("/recommendations")
def get_recommendations():

    mood = request.args.get("mood")
    user_id = request.args.get("user_id")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT 
            s.series_id,
            s.title,
            s.type,
            SUM(mgm.relevance_score) AS recommendation_score
        FROM Series s
        JOIN SeriesGenres sg 
            ON s.series_id = sg.series_id
        JOIN MoodGenreMapping mgm 
            ON sg.genre_id = mgm.genre_id
        WHERE mgm.mood_name = %s
        AND s.series_id NOT IN (
            SELECT series_id
            FROM UserLibrary
            WHERE user_id = %s
        )
        GROUP BY s.series_id
        ORDER BY recommendation_score DESC
        LIMIT 10;
        """
    cursor.execute(query, (mood, user_id))
    results = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True)



