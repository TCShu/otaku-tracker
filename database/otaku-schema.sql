-- USE otakutracker;
-- CREATE TABLE Users (
--     user_id INT AUTO_INCREMENT PRIMARY KEY,
--     username VARCHAR(50) UNIQUE NOT NULL,
--     email VARCHAR(100) UNIQUE NOT NULL,
--     password_hash TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     avatar_url TEXT
-- );

-- USE otakutracker;
-- CREATE TABLE Series (
--     series_id INT AUTO_INCREMENT PRIMARY KEY,
--     title VARCHAR(255) NOT NULL,
--     type VARCHAR(20) NOT NULL,
--     year INT,
--     status VARCHAR(50) NOT NULL,
--     total_episodes INT,
--     total_chapters INT,
--     avg_episode_duration INT,
--     average_score FLOAT,
--     description TEXT,
--     cover_image_url TEXT,
--     source VARCHAR(50)
-- );

-- USE otakutracker;
-- CREATE TABLE Genres (
--     genre_id INT AUTO_INCREMENT PRIMARY KEY,
--     genre_name VARCHAR(50) UNIQUE NOT NULL
-- );

-- USE otakutracker;
-- CREATE TABLE SeriesGenres (
--     series_id INT,
--     genre_id INT,
--     PRIMARY KEY (series_id, genre_id),
--     FOREIGN KEY (series_id) REFERENCES Series(series_id) ON DELETE CASCADE,
--     FOREIGN KEY (genre_id) REFERENCES Genres(genre_id) ON DELETE CASCADE
-- );

-- USE otakutracker;
-- CREATE TABLE UserLibrary (
--     library_id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     series_id INT NOT NULL,
--     status VARCHAR(20) NOT NULL,
--     progress INT DEFAULT 0,
--     rating INT,
--     date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     date_completed TIMESTAMP,
--     UNIQUE (user_id, series_id),
--     FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
--     FOREIGN KEY (series_id) REFERENCES Series(series_id) ON DELETE CASCADE
-- );

-- USE otakutracker;
-- CREATE TABLE MoodGenreMapping (
--     mood_id INT AUTO_INCREMENT PRIMARY KEY,
--     mood_name VARCHAR(50) NOT NULL,
--     genre_id INT NOT NULL,
--     relevance_score FLOAT NOT NULL,
-- 
--     UNIQUE (mood_name, genre_id),
-- 
--     FOREIGN KEY (genre_id) REFERENCES Genres(genre_id)
-- );


