# Successful Pre-Merge Checks

Analysis of how many times the pre-merge checks for a Pull Request fail.

```js
const prs = await FileAttachment("./data/github/pairing.json").json();

display(Inputs.table(prs));
```