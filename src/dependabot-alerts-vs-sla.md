# Dependabot Alerts vs SLAs

Create your key here: https://github.com/settings/personal-access-tokens

TODO: Work out minimum permissions needed

```js
const dependabotAlertsVsSla = await FileAttachment(
  "./data/github/dependabot-alerts-vs-sla.json"
).json();
const { repositories, alerts } = dependabotAlertsVsSla;
```

Repositories:

```js
const repoName = view(Inputs.text({label: "Repository Name", placeholder: "Filter by name"}));
```

```js
const tableData = repositories.filter(row => (
    row.name_text.toLocaleLowerCase().includes(repoName.toString().toLocaleLowerCase())
));

const createLink = ([name, link]) => {
    const element = document.createElement('a');
    element.href = link;
    element.text = name;
    return element;
}

let selectedRepos = view(Inputs.table(tableData, {
    sort: "name_link", // This shouldn't work
    columns: ["name_link"],
    header: {name_link: "Name"},
    format: {
        name_link: createLink,
    }
}));
```

Dependabot Alerts:

```js
const alertName = view(Inputs.text({label: "Alert Name", placeholder: "Filter by name"}));
```

```js
const selectedRepoIds = selectedRepos.map((repo) => repo.id);

const tableData = alerts
    .filter(alert => (
        alert.in_repositories.some(repo_id => selectedRepoIds.includes(repo_id))
    ))
    .filter(alert => (
        alert.name_text.toLocaleLowerCase().includes(alertName.toString().toLocaleLowerCase())
    ));

display(Inputs.table(tableData));
```
