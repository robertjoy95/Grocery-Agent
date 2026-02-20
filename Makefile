COMPOSE_FILE := orchestration/docker-compose.yml
ENV_FILE     := orchestration/.env

.PHONY: start stop restart build logs clean

start:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up --build -d

stop:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down

fresh-start: stop clean start

restart: stop start

build:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) build

logs:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) logs -f

clean:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down -v
