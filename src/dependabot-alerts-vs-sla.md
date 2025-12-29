# Dependabot Alerts vs SLAs

Create your key here: https://github.com/settings/personal-access-tokens

TODO: Work out minimum permissions needed

```js
// Shared code
const flattenSeverity = (severity) => `${severity.value}-${severity.label}`;
const formatFlatSeverity = (severity) => severity.replace(/\d+\-/, "");
```

Repositories:

```js
const dependabotAlertsVsSla = await FileAttachment(
  "./data/github/dependabot-alerts-vs-sla.json"
).json();
const { repositories, alerts } = dependabotAlertsVsSla;
```

```js
const repoName = view(Inputs.text({label: "Repository Name", placeholder: "Filter by name"}));
```

```js
const tableData = repositories
    .filter(repo => repo.name_text.toLocaleLowerCase().includes(repoName.toString().toLocaleLowerCase()))
    .map((repo) => ({
        ...repo,
        most_severe_alert_level: repo.most_severe_alert_level && flattenSeverity(repo.most_severe_alert_level) 
    }));

const createLink = ([name, link]) => {
    const element = document.createElement('a');
    element.href = link;
    element.text = name;
    return element;
}

let selectedRepos = view(Inputs.table(tableData, {
    sort: "name_link", // This shouldn't work
    columns: ["name_link", "most_severe_alert_level"],
    header: {
        name_link: "Name",
        most_severe_alert_level: "Most Severe Alert"
    },
    format: {
        name_link: createLink,
        most_severe_alert_level: formatFlatSeverity,
    }
}));
```

Dependabot Alerts:

```js
const alertName = view(Inputs.text({label: "Alert Name", placeholder: "Filter by name"}));
```

```js
const selectedRepoIds = selectedRepos.map((repo) => repo.id);

view(selectedRepoIds);

const tableData = alerts
    .filter(alert => (
        alert.in_repositories.some(repo_id => selectedRepoIds.includes(repo_id))
    ))
    .filter(alert => (
        alert.name_text.toLocaleLowerCase().includes(alertName.toString().toLocaleLowerCase())
    ))
    .map((alert) => ({ 
        ...alert, 
        severity: alert.severity && flattenSeverity(alert.severity) 
    }));

display(Inputs.table(tableData, {
    sort: "severity", // This shouldn't work
    columns: ["name_text", "severity"],
    header: {
        name_text: "Name",
        severity: "Severity"
    },
    format: {
        severity: formatFlatSeverity,
    }
}));
```
