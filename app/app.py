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


if __name__ == "__main__":
    app.run(debug=True)



