CREATE TABLE IF NOT EXISTS cycles (
    cycle_id INT AUTO_INCREMENT PRIMARY KEY,
    semester VARCHAR(20) NOT NULL UNIQUE,
    signup_deadline DATE NOT NULL,
    observation_deadline DATE NULL
);
