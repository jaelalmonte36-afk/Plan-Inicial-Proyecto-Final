CREATE DATABASE IF NOT EXISTS floristeria_jardin
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE floristeria_jardin;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  telefono VARCHAR(30) NOT NULL,
  flor_favorita VARCHAR(80) NOT NULL,
  password_hash VARCHAR(180) NOT NULL,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mensajes_contacto (
  id_mensaje INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  asunto VARCHAR(140) NOT NULL,
  mensaje TEXT NOT NULL,
  fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos_florales (
  id_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NULL,
  nombre_cliente VARCHAR(120) NOT NULL,
  email_cliente VARCHAR(160) NOT NULL,
  tipo_arreglo VARCHAR(80) NOT NULL,
  ocasion VARCHAR(80) NOT NULL,
  fecha_entrega DATE NOT NULL,
  direccion_entrega VARCHAR(220) NOT NULL,
  dedicatoria TEXT,
  presupuesto DECIMAL(10, 2) NOT NULL,
  fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedidos_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS suscripciones (
  id_suscripcion INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(160) NOT NULL UNIQUE,
  preferencia VARCHAR(80) NOT NULL,
  fecha_suscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
