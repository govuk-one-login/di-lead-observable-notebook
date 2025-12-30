# Dependabot Alerts vs SLAs

Create your key here: https://github.com/settings/personal-access-tokens

You will need to set the keys owner to the `govuk-one-login` organisation with the following permissions:
- TODO: Work out minimum permissions needed

```js
// Initial Data
const dependabotAlertsVsSla = await FileAttachment(
  './data/github/dependabot-alerts-vs-sla.json'
).json();
const { repositories, alertSummaries } = dependabotAlertsVsSla;
```

```js
// Shared code
const flattenSeverity = (severity) => `${severity.value}-${severity.label}`;
const flattenAlertSeverity = (alert) => ({
    ...alert,
    severity: alert.severity && flattenSeverity(alert.severity)
});
const formatSeverityLabel = (severity) => {
    switch (severity) {
        case 'critical':
            return '‼️';
        case 'high':
            return '🔴';
        case 'medium':
            return '🟠';
        case 'low':
            return '🟢';
    }
}
const formatFlatSeverity = (severity) => {
    const label = severity.replace(/\d+\-/, '');
    return `${formatSeverityLabel(label)} ${label}`;
}
const formatDays = (days) => `${days} Days`;
const formatBoolean = (bool) => bool ? '✅' : '❌';
const formatLink = (link) => {
    const element = document.createElement('a');
    element.href = link;
    element.text = 'Link';
    return element;
}
```

## Alert Summaries:

```js
const alertName = view(Inputs.text({label: 'Alert Name', placeholder: 'Filter by name'}));
```
```js
const alertSummariesTableData = alertSummaries
    .filter((alert) => alert.name.toLocaleLowerCase().includes(alertName.toString().toLocaleLowerCase()))
    .map(flattenAlertSeverity);

const selectedAlertSummaries = view(Inputs.table(alertSummariesTableData, {
    sort: 'severity',
    columns: ['name', 'severity', 'ageInDays', 'inSla'],
    header: {
        name: 'Name',
        severity: 'Severity',
        ageInDays: 'Age',
        inSla: 'In SLA',
    },
    format: {
        severity: formatFlatSeverity,
        ageInDays: formatDays,
        inSla: formatBoolean,
    },
    // layout: 'auto',
    maxWidth: '100%',
    width: {
        name: 'auto',
        severity: '8%',
        ageInDays: '7%',
        inSla: '5%',
    }
}));
```

## Repositories:

```js
const repoName = view(Inputs.text({label: 'Repository Name', placeholder: 'Filter by name'}));
```

```js
const selectedAlertNames = selectedAlertSummaries.map((alert) => alert.name);

const repoTableData = repositories
    .filter((repo) => repo.alerts.some((alert) => selectedAlertNames.includes(alert.name)))
    .filter((repo) => repo.name.toLocaleLowerCase().includes(repoName.toString().toLocaleLowerCase()))
    .map((repo) => ({
        ...repo,
        maxSeverity: repo.maxSeverity && flattenSeverity(repo.maxSeverity)
    }));

let selectedRepos = view(Inputs.table(repoTableData, {
    sort: 'name',
    columns: ['name', 'url', 'maxSeverity', 'inSla'],
    header: {
        name: 'Name',
        url: '',
        maxSeverity: 'Most Severe',
        inSla: 'In SLA',
    },
    format: {
        url: formatLink,
        maxSeverity: formatFlatSeverity,
        inSla: formatBoolean,
    },
    width: {
        name: 'auto',
        url: '4%',
        maxSeverity: '11%',
        inSla: '10%',
    },
}));
```

## Alerts for Selected Repos:

```js
const selectedRepoNames = selectedRepos.map((repo) => repo.name);

// Flatten the alerts
const flattenedAlerts = selectedRepos
    .filter((repo) => selectedRepoNames.includes(repo.name))
    .flatMap((repo) => 
        repo.alerts.map((alert) => ({
            repoName: repo.name,
            alertName: alert.name,
            url: alert.url,
            severity: flattenSeverity(alert.severity),
            ageInDays: alert.ageInDays,
            inSla: alert.inSla,
            relationship: alert.relationship,
            hasPatch: alert.hasPatch
        }))
    );

view(Inputs.table(flattenedAlerts, {
    sort: 'severity',
    header: {
        repoName: 'Repository',
        alertName: 'Alert',
        url: '',
        severity: 'Severity',
        ageInDays: 'Age',
        inSla: 'SLA',
        relationship: 'Relationship',
        hasPatch: 'Patch',
    },
    format: {
        url: formatLink,
        severity: formatFlatSeverity,
        ageInDays: formatDays,
        inSla: formatBoolean,
        hasPatch: formatBoolean,
    },
    tableLayout: 'auto',
    maxWidth: '100%',
    width: {
        repoName: '15%',
        alertName: 'auto',
        url: '4%',
        severity: '6%',
        ageInDays: '7%',
        inSla: '3%',
        relationship: '10%',
        hasPatch: '5%',
    },
}));
```
