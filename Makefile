NAMESPACE   = vigilantia
DEPLOYMENTS = auth parser gateway frontend

.PHONY: deploy rollout status logs

deploy: rollout status

rollout:
	kubectl rollout restart $(addprefix deployment/,$(DEPLOYMENTS)) -n $(NAMESPACE)

status:
	kubectl rollout status $(addprefix deployment/,$(DEPLOYMENTS)) -n $(NAMESPACE)

logs:
	kubectl logs -n $(NAMESPACE) -l app=parser --tail=50 -f
