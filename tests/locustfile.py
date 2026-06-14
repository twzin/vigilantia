"""
Vigilantia SIEM — Load Test (RNF01)
====================================
Objetivo: validar que o endpoint /ingest suporta 1000 eventos em ≤500ms p95.

Execução:
    pip install locust
    INGEST_API_KEY=<sua_key> locust -f locustfile.py --host=http://localhost:8000

Modo headless (sem UI):
    INGEST_API_KEY=<sua_key> locust -f locustfile.py --host=http://localhost:8000 \
        --headless -u 50 -r 10 --run-time 60s --html report.html
"""

import os
import random
from locust import HttpUser, task, between

INGEST_API_KEY = os.getenv("INGEST_API_KEY", "troque-pela-sua-api-key")

SEVERITIES = ["INFO", "WARNING", "ERROR", "CRITICAL"]
SOURCES    = ["nginx", "auth-service", "parser", "firewall", "ssh", "kernel", "app"]


class VigilantiaUser(HttpUser):
    """Simula um usuário misto: ingestão (Filebeat) + consultas (analista)."""

    wait_time = between(0.05, 0.3)

    def on_start(self):
        """Autentica como admin para obter token JWT."""
        resp = self.client.post(
            "/login",
            data={"username": "admin_user", "password": "senha123"},
            name="[setup] login",
        )
        self.token = resp.json().get("access_token", "") if resp.status_code == 200 else ""

    # ── Ingestão (maior peso — é o fluxo crítico de performance) ───────────────

    @task(6)
    def ingest_single(self):
        """POST /ingest — evento único via API Key."""
        self.client.post(
            "/ingest",
            json={
                "source":   random.choice(SOURCES),
                "message":  f"Load test event #{random.randint(1, 99999)}",
                "severity": random.choice(SEVERITIES),
            },
            headers={"X-API-Key": INGEST_API_KEY},
            name="/ingest",
        )

    # ── Consultas (peso menor — analista navegando no dashboard) ───────────────

    @task(3)
    def search_logs(self):
        """GET /search — busca de logs autenticada."""
        self.client.get(
            "/search",
            params={
                "q":        random.choice(SOURCES),
                "size":     20,
                "severity": random.choice(["", "ERROR", "CRITICAL"]),
            },
            headers={"Authorization": f"Bearer {self.token}"},
            name="/search",
        )

    @task(2)
    def get_stats(self):
        """GET /stats — painel de estatísticas."""
        self.client.get(
            "/stats",
            headers={"Authorization": f"Bearer {self.token}"},
            name="/stats",
        )

    @task(1)
    def get_alerts(self):
        """GET /alerts — histórico de alertas."""
        self.client.get(
            "/alerts",
            headers={"Authorization": f"Bearer {self.token}"},
            name="/alerts",
        )
