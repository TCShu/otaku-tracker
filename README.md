# OtakuTracker

Smart Anime & Manga Planner with a Mood-Aware Recommendation Engine.

## Features

- Track anime, manga, manhwa, and light novels
- Manage personal watch/read lists
- Track progress (episodes / chapters)
- Dashboard statistics
- Mood-based recommendation engine

## Tech Stack

Backend:
- Python
- Flask
- MySQL

Frontend:
- HTML
- CSS
- JavaScript
- Bootstrap 5

APIs:
- Jikan API
- AniList GraphQL API

## Database Design

The database contains the following core tables:

- Users
- Series
- Genres
- SeriesGenres
- UserLibrary
- MoodGenreMapping

## Core Database Operations

- Insert records
- Search series
- Update progress
- Delete library entries
- Multi-table JOIN queries
- Aggregate statistics

## Advanced Feature

Mood-aware recommendation engine that suggests series based on:

- User mood
- Available time
- Commitment level
- Media type

## Setup

Clone the repository:

```bash
git clone https://github.com/yourusername/otaku-tracker.git
````

Install dependencies:

```
pip install -r requirements.txt
```

Run Flask app:

```
python app.py
```

## Project Purpose

This project was built for a Database Systems course and demonstrates a full database-driven web application with CRUD operations and advanced SQL queries.


---

## Folder Structure
```

otaku-tracker/
│
├── app/
│   ├── routes/
│   ├── services/
│   ├── models/
│
├── templates/
│
├── static/
│   ├── css/
│   ├── js/
│
├── database/
│   ├── schema.sql
│   ├── seed.sql
│
├── scripts/
│   ├── api_seeder.py
│
├── app.py
├── requirements.txt
├── .env
├── README.md
└── .gitignore

```
