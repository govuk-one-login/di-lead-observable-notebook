# Pairing analysis

Analysis of how often changes are paired or ensemble.

```js
const prs = await FileAttachment("./data/github/pairing.json").json();

display(Plot.plot({
    marks: [
        Plot.axisX({tickRotate: 90, marginBottom: 200}),
        Plot.barY(prs, Plot.groupX({y: "count"}, {x: "repo", fill: "state", tip: true})),
        Plot.ruleY([0])
    ]
}));


```