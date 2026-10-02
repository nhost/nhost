To contribute a dashboard, please follow the steps below:

1. Create/Modify the dashboard in our Grafana.
2. Click on the "share" button on the top-left, next to the title.
3. Click on the "Export" tab.
4. Make sure the "Export for sharing externally" checkbox is NOT checked.
5. Click on the "Save to file" button.
6. Save the file in the `dashboards` directory.

## Template safety

`rules_nhost.yaml` and the dashboard JSON files are Go templates. Preserve their `{{ ... }}` actions exactly; do not run formatters that rewrite template delimiters or insert spaces between their braces.
