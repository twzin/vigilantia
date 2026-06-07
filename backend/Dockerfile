# Usa a imagem oficial do Python 3.12 slim para reduzir superfície de ataque
FROM python:3.12-slim

# Define o diretório de trabalho
WORKDIR /app

# Cria um usuário não-root por questões de segurança (DevSecOps)
RUN adduser --disabled-password --gecos '' appuser

# Copia e instala as dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da aplicação
COPY . .

# Altera a propriedade dos arquivos para o usuário não-root
RUN chown -R appuser:appuser /app

# Muda para o usuário seguro
USER appuser

# Expõe a porta do FastAPI
EXPOSE 8000

# Comando para rodar a aplicação
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]