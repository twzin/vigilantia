users de teste:
admin_user / cliente_user
senha123

Teste de ingestão de log:
{
  "source": "firewall",
  "message": "Login failed for root user: unauthorized access attempt"
}


Debbugando:
2 terminais em /backend:
uvicorn auth_service:app --reload --port 8001
uvicorn main:app --reload --port 8000

1 terminal em /frontend:
npm run dev
