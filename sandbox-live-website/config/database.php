<?php
declare(strict_types=1);

/**
 * MySQL/MariaDB connection settings for local Laragon/XAMPP.
 * Default Laragon/XAMPP: host 127.0.0.1 or localhost, user root, password empty.
 * Update host/port/username/password if your local MySQL differs.
 */
return [
    'host' => getenv('DB_HOST') !== false ? getenv('DB_HOST') : '127.0.0.1',
    'port' => (int)(getenv('DB_PORT') !== false ? getenv('DB_PORT') : 3306),
    'dbname' => getenv('DB_NAME') !== false ? getenv('DB_NAME') : 'come_n_meatshop_db',
    'username' => getenv('DB_USER') !== false ? getenv('DB_USER') : 'root',
    'password' => getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : '',
    'charset' => 'utf8mb4',
    'options' => [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ],
];
