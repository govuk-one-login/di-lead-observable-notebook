# Dependabot Alerts vs SLAs

Create your key here: https://github.com/settings/personal-access-tokens

You will need a fine grain access token configured with the following:

> Owner: `govuk-one-login`
> 
> Organisation Permissions:
> - `Custom Properties (read)`
> 
> Repository Permissions:
> - `Dependabot Alerts (read)`
> - `Metadata (read)` (automatically added with the previous permission)

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
const podName = view(Inputs.text({label: 'Pod Name', placeholder: 'Filter by name'}));
const teamName = view(Inputs.text({label: 'Team Name', placeholder: 'Filter by name'}));
const repoName = view(Inputs.text({label: 'Repository Name', placeholder: 'Filter by name'}));
```

```js
const selectedAlertNames = selectedAlertSummaries.map((alert) => alert.name);

const repoTableData = repositories
    .filter((repo) => repo.alerts.some((alert) => selectedAlertNames.includes(alert.name)))
    .filter((repo) => repo.name.toLocaleLowerCase().includes(repoName.toString().toLocaleLowerCase()))
    .filter((repo) => repo.properties.pod.toLocaleLowerCase().includes(podName.toString().toLocaleLowerCase()))
    .filter((repo) => repo.properties.team.toLocaleLowerCase().includes(teamName.toString().toLocaleLowerCase()))
    .map((repo) => ({
        ...repo,
        cpPod: repo.properties.pod,
        cpTeam: repo.properties.team,
        cpProd: repo.properties.productionAssets,
        maxSeverity: repo.maxSeverity && flattenSeverity(repo.maxSeverity)
    }));

let selectedRepos = view(Inputs.table(repoTableData, {
    sort: 'maxSeverity',
    columns: ['cpPod', 'cpTeam', 'name', 'url', 'maxSeverity', 'inSla', 'cpProd'],
    header: {
        cpPod: 'Pod',
        cpTeam: 'Team',
        name: 'Name',
        url: '',
        maxSeverity: 'Most Severe',
        inSla: 'SLA?',
        cpProd: 'Prod?'
    },
    format: {
        cpPod: formatTextWithTitle,
        cpTeam: formatTextWithTitle,
        name: formatTextWithTitle,
        url: formatLink,
        maxSeverity: formatFlatSeverity,
        inSla: formatBoolean,
        cpProd: formatBoolean,
    },
    width: {
        cpPod: '10%',
        cpTeam: '10%',
        name: 'auto',
        url: '5%',
        maxSeverity: '10%',
        inSla: '5%',
        cpProd: '5%',
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
            cpPod: repo.properties.pod,
            cpTeam: repo.properties.team,
            repoName: repo.name,
            alertName: alert.name,
            url: alert.url,
            severity: flattenSeverity(alert.severity),
            ageInDays: alert.ageInDays,
            inSla: alert.inSla,
            relationship: alert.relationship,
            hasPatch: alert.hasPatch,
            cpProd: repo.properties.productionAssets,
        }))
    )
    .filter((alert) => selectedAlertNames.includes(alert.alertName));

view(Inputs.table(flattenedAlerts, {
    sort: 'severity',
    header: {
        cpPod: 'Pod',
        cpTeam: 'Team',
        repoName: 'Repository',
        alertName: 'Alert',
        url: '',
        severity: 'Severity',
        ageInDays: 'Age',
        inSla: 'SLA?',
        relationship: 'Relationship',
        hasPatch: 'Patch?',
        cpProd: 'Prod?',
    },
    format: {
        cpPod: formatTextWithTitle,
        cpTeam: formatTextWithTitle,
        repoName: formatTextWithTitle,
        alertName: formatTextWithTitle,
        url: formatLink,
        severity: formatFlatSeverity,
        ageInDays: formatDays,
        inSla: formatBoolean,
        relationship: formatTextWithTitle,
        hasPatch: formatBoolean,
        cpProd: formatBoolean,
    },
    tableLayout: 'auto',
    maxWidth: '100%',
}));
```

## Leaderboards

Shows how many alerts are out of SLA:

```js
const flatAlerts = repositories
    .flatMap((repo) =>
        repo.alerts.map((alert) => ({
            cpPod: repo.properties.pod,
            cpTeam: repo.properties.team,
            repoName: repo.name,
            alertName: alert.name,
            url: alert.url,
            severity: flattenSeverity(alert.severity),
            ageInDays: alert.ageInDays,
            inSla: alert.inSla,
            relationship: alert.relationship,
            hasPatch: alert.hasPatch,
            cpProd: repo.properties.productionAssets,
        }))
    );
```

Pod Leaderboard

```js
const podLeaderboard = flatAlerts
    .filter((alert) => !alert.inSla)
    .reduce(
        (acc, cur) => {
            const name = cur.cpPod;
            return {
                ...acc,
                [name]: acc[name] ? acc[name] + 1 : 1,
            }
        },
        {}
    );

view(Inputs.table(Object.entries(podLeaderboard), {
    sort: '1',
    reverse: true,
    header: {
        '0': 'Pod',
        '1': 'Alerts out of SLA',
    },
}));
```

Team Leaderboard

```js
const teamLeaderboard = flatAlerts
    .filter((alert) => !alert.inSla)
    .reduce(
        (acc, cur) => {
            const name = `${cur.cpPod}: ${cur.cpTeam}`
            return {
                ...acc,
                [name]: acc[name] ? acc[name] + 1 : 1,
            }
        },
        {}
    );

view(Inputs.table(Object.entries(teamLeaderboard), {
    sort: '1',
    reverse: true,
    header: {
        '0': 'Team',
        '1': 'Alerts out of SLA',
    },
}));
```
