.PHONY: envrc-install
envrc-install: ## Copy envrc.sample to all project folders
	@for f in $$(find . -name "project.nix"); do \
		echo "Copying envrc.sample to $$(dirname $$f)/.envrc"; \
		cp ./envrc.sample $$(dirname $$f)/.envrc; \
	done

.PHONY: nixops-container-env
nixops-container-env: ## Enter a NixOS container environment
	docker run \
		-it \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v ./:/build \
		-w /build \
		nixops:0.0.0-dev \
			bash
