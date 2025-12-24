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

## Alerts by SLO

```js

const SLA_DAYS = {
  critical: 7,
  high: 14,
  medium: 30,
  low: 60
};

const daysOpen = (createdAt, now = new Date()) => {
  const created = new Date(createdAt);
  // If createdAt is invalid, treat as unknown age
  if (Number.isNaN(created.getTime())) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((now - created) / msPerDay);
};

const groupBySeverityThenSla = (alerts, now = new Date()) =>
  alerts.reduce((acc, alert) => {
    const severity = (alert.severity ?? "unknown").toLowerCase();
    const slaDays = SLA_DAYS[severity] ?? null;

    const ageDays = daysOpen(alert.created_at, now);

    // Decide bucket. If we can't compute age or SLA, shove into "unknown".
    const slaBucket =
      slaDays == null || ageDays == null
        ? "unknown"
        : ageDays > slaDays
          ? "over_sla"
          : "in_sla";

    acc[severity] ??= { over_sla: [], in_sla: [], unknown: [] };
    acc[severity][slaBucket].push({ ...alert, ageDays, slaDays });

    return acc;
  }, {});

const capitalize = (str) => {
  if (!str) return str; // handles empty string / null-ish
  return str[0].toUpperCase() + str.slice(1);
}

const groupedAlerts = groupBySeverityThenSla(openAlerts);

const displayAlertsGroupedBySLAandSeverity = (alerts, severity) => {
  if (Object.hasOwn(alerts, severity)) {
    display(html`<h3>${capitalize(severity)}</h3>`);
    display(html`<p>SLA: ${SLA_DAYS[severity]} Days</p>`)

    if (alerts[severity].over_sla.length > 0) {
      display(html`<h4>SLA missed</h4>`);
      display(
        Inputs.table(
          alerts[severity].over_sla.map((alert) => ({
            dependency: alert.dependency,
            repo: alert.repo,
            pod: alert.pod,
            days_open: daysOpen(alert.created_at),
            severity: alert.severity,
          }))
        )
      )
    } else {
      display(html`<p>Yay, no ${severity} alerts out of SLA<p>`)
    }

    if (alerts[severity].in_sla.length > 0) {
      display(html`<h4>In SLA</h4>`);
      display(
        Inputs.table(
          alerts[severity].in_sla.map((alert) => ({
            repo: alert.repo,
            pod: alert.pod,
            days_open: daysOpen(alert.created_at),
            severity: alert.severity,
          }))
        )
      )
    }
  }
  display(html`<hr>`)
}

displayAlertsGroupedBySLAandSeverity(groupedAlerts, "critical")
displayAlertsGroupedBySLAandSeverity(groupedAlerts, "high")
displayAlertsGroupedBySLAandSeverity(groupedAlerts, "medium")
displayAlertsGroupedBySLAandSeverity(groupedAlerts, "low")
