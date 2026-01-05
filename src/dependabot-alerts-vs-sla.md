# Dependabot Alerts vs SLAs

Create your key here: https://github.com/settings/personal-access-tokens

You will need a fine grain access token. Set the tokens owner to the `govuk-one-login` organisation and give it the
`Dependabot Alerts (read)` permission. This will automatically add the `Metadata (read)` permission which is the only
other permission you need.

The GitHub token must be provided in the a `GITHUB_TOKEN` environment variable. Getting the data currently takes over
two minutes and that will likely only increase, so be patient. If you just need to see if the code is workin, set an
environment variable `TEST_MODE=true` to only download 20 repositories and their associated alerts.


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
const severityLabel = {
    critical: '‼️',
    high: '🔴', 
    medium: '🟠', 
    low: '🟢',
}
const formatSeverityLabel = (severity) => {
    const element = document.createElement('span');
    element.title = severity;
    element.textContent = severityLabel[severity];
    return element;
}
const formatFlatSeverity = (severity) => {
    const label = severity.replace(/\d+\-/, '');
    return formatSeverityLabel(label);
}
const formatDays = (days) => `${days} days`;
const formatBoolean = (bool) => bool ? '✅' : '❌';
const formatLink = (link) => {
    const element = document.createElement('a');
    element.href = link;
    element.text = 'Link';
    return element;
}
const formatTextWithTitle = (text) => {
    const element = document.createElement('span');
    element.title = text;
    element.textContent = text;
    return element;
}
```

## Alert Summaries:

This shows all alerts (collated by name) across the organisation and initially sorted by severity. You can filter alerts
by name, or select individual alerts and the Repositories table below will be filtered to only repositories impacted by
those alerts.

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
        name: formatTextWithTitle,
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

Lists all repositories that are impacted by at least one of the above alerts, initially sorted by severity. Shows
whether the repository is in SLA or not, and provides a link to the repository.

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
    sort: 'maxSeverity',
    columns: ['name', 'url', 'maxSeverity', 'inSla'],
    header: {
        name: 'Name',
        url: '',
        maxSeverity: 'Most Severe',
        inSla: 'In SLA',
    },
    format: {
        name: formatTextWithTitle,
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

Selecting or filtering repositories in the above table causes this one to show only alerts for that specific repository.
Note: this shows all alerts for that repository, not just ones matching the first table. From here you can see if the 
alert is within SLA, whether the alert is on a direct dependency or transitive dependency (a dependency of a dependency)
and whether there is a patch for the alert. There is also a link to take you straight to the Dependabot alert page for
the alert on that specific repo.

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
    )
    .filter((alert) => selectedAlertNames.includes(alert.alertName));

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
        repoName: formatTextWithTitle,
        alertName: formatTextWithTitle,
        url: formatLink,
        severity: formatFlatSeverity,
        ageInDays: formatDays,
        inSla: formatBoolean,
        relationship: formatTextWithTitle,
        hasPatch: formatBoolean,
    },
    tableLayout: 'auto',
    maxWidth: '100%',
    width: {
        repoName: '15%',
        alertName: '45%',
        url: '4%',
        severity: '6%',
        ageInDays: '8%',
        inSla: '4%',
        relationship: '12%',
        hasPatch: '6%',
    },
}));
```
