-- ==========================================
-- OtakuTracker Query Collection
-- ==========================================


-- 1. JOIN QUERY
-- Retrieve all series with their genres

SELECT s.title, g.genre_name
FROM Series s
JOIN SeriesGenres sg ON s.series_id = sg.series_id
JOIN Genres g ON sg.genre_id = g.genre_id
ORDER BY s.title;


-- 2. USER LIBRARY QUERY
-- Show all series a user is watching

SELECT s.title, ul.status, ul.progress
FROM UserLibrary ul
JOIN Series s ON ul.series_id = s.series_id
WHERE ul.user_id = 1
AND ul.status = 'Watching';


-- 3. AGGREGATE QUERY
-- Count number of series by status

SELECT status, COUNT(*) AS total_series
FROM UserLibrary
GROUP BY status;


-- 4. AVERAGE RATING QUERY

SELECT AVG(rating) AS avg_user_rating
FROM UserLibrary
WHERE rating IS NOT NULL;