# Dependabot alerts

```js
const alerts = await FileAttachment(
  "./data/github/dependabot-alerts.json"
).json();
display(Inputs.table(alerts));
```

Looks at all Dependabot alerts across the GitHub org.
This requires a fine-grained access token with repo read access to Dependabot alerts, code, custom properties for repositories, metadata and organisation read access to repo custom properties.

## Duplicate open alerts

```js
const openAlerts = alerts.filter((alert) => alert.state == "open");

const duplicateAlerts = openAlerts.reduce((acc, alert) => {
  const existing = acc.find((item) => item.dependency === alert.dependency);
  if (existing) {
    existing.count++;
    existing.repositories.push(alert.repo);
    if (!existing.pods.includes(alert.pod)) {
      existing.pods.push(alert.pod);
    }
  } else {
    acc.push({
      dependency: alert.dependency,
      count: 1,
      pods: [alert.pod],
      repositories: [alert.repo],
    });
  }
  return acc;
}, []);

display(Inputs.table(duplicateAlerts));
```

## Have other teams solved the same upgrade?

```js
const closedAlerts = alerts.filter((alert) => alert.state == "fixed");

for (const duplicateAlert of duplicateAlerts) {
  const matchingClosed = closedAlerts.filter(
    (closed) =>
      closed.dependency === duplicateAlert.dependency &&
      closed.severity ===
        openAlerts.find((open) => open.dependency === duplicateAlert.dependency)
          ?.severity &&
      new Date(closed.created_at).toDateString() ===
        new Date(
          openAlerts.find(
            (open) => open.dependency === duplicateAlert.dependency
          )?.created_at
        ).toDateString()
  );

  if (matchingClosed.length > 0) {
    display(html`<h3>${duplicateAlert.dependency}</h3>`);
    display(
      Inputs.table(
        matchingClosed.map((alert) => ({
          repo: alert.repo,
          pod: alert.pod,
          fixed_at: alert.fixed_at,
          severity: alert.severity,
        }))
      )
    );
  }
}
```
