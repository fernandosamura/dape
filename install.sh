#!/bin/bash

echo "🔧 Iniciando instalação do Zapwink 2.0..."

echo "📦 Subindo containers com Docker Compose..."
docker compose up -d --build

sleep 10

echo "🛠️ Aplicando migrações..."
docker compose exec backend npx sequelize db:migrate

echo "🌱 Aplicando seed inicial..."
docker compose exec backend npx sequelize db:seed:all

echo "✅ Instalação concluída! Acesse pelo IP da VPS na porta 80."
