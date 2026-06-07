from fastapi import FastAPI

app = FastAPI(title="Vigilantia SIEM - API Gateway")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Vigilantia API Gateway is running.",
        "mock_alert": {
            "source": "network_sensor",
            "description": "Potential C2 Beaconing detected",
            "indicators": {
                "suspicious_ja3_hash": "e7d705a3286e19ea42f587b344ee6865",
                "sni_header": "malicious-domain.com"
            }
        }
    }