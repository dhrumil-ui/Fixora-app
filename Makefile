.PHONY: help dev prod down logs logs-be logs-fe build rebuild clean \
        shell-be shell-fe shell-mongo shell-redis backup restore seed test

help:
	@echo "Fixora — Docker commands"
	@echo ""
	@echo "  make dev          Start dev (hot reload, ports 5173 + 5001)"
	@echo "  make prod         Start production (nginx on :80)"
	@echo "  make down         Stop everything"
	@echo "  make logs         Tail all logs"
	@echo "  make logs-be      Tail backend only"
	@echo "  make logs-fe      Tail frontend only"
	@echo "  make build        Build dev images"
	@echo "  make rebuild      Build without cache (slow, clean)"
	@echo "  make clean        Remove containers AND volumes (DB wiped!)"
	@echo "  make shell-be     Shell into backend container"
	@echo "  make shell-fe     Shell into frontend container"
	@echo "  make shell-mongo  mongosh in MongoDB container"
	@echo "  make shell-redis  redis-cli in Redis container"
	@echo "  make backup       Dump MongoDB to ./backups/"
	@echo "  make seed         Run backend seed script"

dev:
	@[ -f .env ] || { echo "Missing .env — run: cp .env.example .env"; exit 1; }
	docker compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "  Backend:   http://localhost:5001"
	@echo "  Frontend:  http://localhost:5173"
	@echo "  MongoDB:   mongodb://localhost:27017"
	@echo "  Redis:     redis://localhost:6379"
	@echo "  Debugger:  chrome://inspect -> :9229"

prod:
	docker compose up -d --build

down:
	-docker compose -f docker-compose.dev.yml down
	-docker compose down

logs:
	docker compose -f docker-compose.dev.yml logs -f --tail=100

logs-be:
	docker compose -f docker-compose.dev.yml logs -f --tail=200 backend

logs-fe:
	docker compose -f docker-compose.dev.yml logs -f --tail=200 frontend

build:
	docker compose -f docker-compose.dev.yml build

rebuild:
	docker compose -f docker-compose.dev.yml build --no-cache

clean:
	docker compose -f docker-compose.dev.yml down -v
	docker compose down -v
	@echo "All Fixora containers + volumes removed."

shell-be:
	docker exec -it fixora_backend_dev sh

shell-fe:
	docker exec -it fixora_frontend_dev sh

shell-mongo:
	docker exec -it fixora_mongo_dev mongosh -u $${MONGO_ROOT_USER:-admin} -p $${MONGO_ROOT_PASSWORD:-admin123} --authenticationDatabase admin

shell-redis:
	docker exec -it fixora_redis_dev redis-cli -a $${REDIS_PASSWORD:-redis123}

backup:
	@mkdir -p backups
	docker exec fixora_mongo_dev sh -c 'mongodump --uri="mongodb://$$MONGO_INITDB_ROOT_USERNAME:$$MONGO_INITDB_ROOT_PASSWORD@localhost:27017/?authSource=admin" --db=$$MONGO_INITDB_DATABASE --out=/backups/$(shell date +%Y%m%d_%H%M%S)'
	@echo "Backup saved in ./backups/"

seed:
	docker exec -it fixora_backend_dev npm run seed

test:
	docker exec -it fixora_frontend_dev npm test
