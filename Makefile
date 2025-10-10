.PHONY: envrc-install
envrc-install: ## Copy envrc.sample to all project folders
	@for f in $$(find . -name "project.nix"); do \
		echo "Copying envrc.sample to $$(dirname $$f)/.envrc"; \
		cp ./envrc.sample $$(dirname $$f)/.envrc; \
	done
