# Common tasks for the blog. Run `make` (or `make help`) to list them.

.DEFAULT_GOAL := help
.PHONY: help install dev build preview test typecheck check-urls check-links verify verify-editor write lint share clean deploy

POST ?=

help: ## List the targets
	@awk 'BEGIN { FS = ":.*## " } /^[a-z-]+:.*## / { printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

node_modules: package.json package-lock.json
	npm ci
	@touch node_modules

install: node_modules ## Install dependencies (npm ci)

dev: node_modules ## Serve on http://localhost:4321 with drafts and live reload
	npm run dev

build: node_modules ## Clean production build into dist/ (drafts left out)
	rm -rf node_modules/.astro  # Astro caches rendered posts; stale after plugin changes
	npm run build

preview: build ## Build, then serve the production build
	npm run preview

test: node_modules ## Unit tests
	npm test

typecheck: node_modules ## Type-check the Astro and TypeScript sources
	npm run check

check-urls: ## Check every old Hugo URL still exists in dist/
	npm run check:urls

check-links: ## Check internal links in dist/
	npm run check:links

verify: test typecheck build check-urls check-links ## Everything the deploy checks, plus the type check

verify-editor: test typecheck ## The editor's unit tests and its end-to-end test
	npx playwright install chromium
	npx playwright test

write: node_modules ## Open the writing editor on the drafts page, or a post with POST=<slug>
	node editor/main.ts --open $(if $(POST),--post $(POST),)

lint: ## Lint a post: make lint POST=<slug> (defaults to the active draft)
	python3 scripts/lint_post.py $(if $(POST),$(POST),--active)

share: ## Share kit for a published post: make share POST=<slug> (defaults to the newest)
	python3 scripts/share.py $(POST)

clean: ## Remove build output and caches
	rm -rf dist .astro node_modules/.astro

deploy: ## Verify, then push master (GitHub Actions deploys it)
	@test "$$(git rev-parse --abbrev-ref HEAD)" = master || { echo "Not on master"; exit 1; }
	@git diff --quiet && git diff --cached --quiet || { echo "Uncommitted changes; commit first"; exit 1; }
	$(MAKE) verify
	git push origin master
