---
"@nhost-examples/docker-compose": patch
---

Improve QA

- Add end-to-end tests
- Use the default health checks from the services
- Do not use `latest` tags so we are sure the docker-compose example works for the given versions of the services
