-- Migración 002: Tabla de administradores para autenticación
-- Ejecutar después de 001_init.sql

CREATE TABLE IF NOT EXISTS admin_usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario       TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);
