# Dependabot Alerts vs SLAs

TODO: Work out minimum permissions needed

```js
const dependabotAlertsVsSla = await FileAttachment(
  "./data/github/dependabot-alerts-vs-sla.json"
).json();
```

Raw Data:

```js
const nameInput = Inputs.text({label: "Name", placeholder: "Filter by name"});
display(nameInput);
const name = view(nameInput) || '';

view(nameInput);

const tableData = dependabotAlertsVsSla.filter(row => (
    row.name_text.includes(name) || true // No idea how to get the value of the input
));

const createLink = ([name, link]) => {
    const element = document.createElement('a');
    element.href = link;
    element.text = name;
    return element;
}

display(Inputs.table(tableData, {
    sort: "name_link", // This shouldn't work
    columns: ["name_link"],
    header: { name_link: "Name" },
    format: {
        name_link: createLink,
    }
}));
```
