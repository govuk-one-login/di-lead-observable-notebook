# GOV.UK One Login Repos

```js
const repos = await FileAttachment("data/github/repositories.json").json()
```

```js
const pods = [... new Set(repos.map( r => r.pod).sort())]

const selection = view(Inputs.select( ["", ...pods], { value: "", label: "Pod Selected"}));
```

```js
const filtered = selection === "" ? repos : repos.filter(r => r.pod === selection)
```

```js

Inputs.table(
  filtered, {
    sort: "pod",
    rows: 50,
    format: {
      'name': (repo) => htl.html`<a href='https://www.github.com/govuk-one-login/${repo}'>${repo}</a>`
    }
  }
)
```