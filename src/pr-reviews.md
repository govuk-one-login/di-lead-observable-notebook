# Pull request / review analysis

Analysis of the time it takes for one team to start a review on a PR after it's created.

To change the list of repositories this pulls from, edit the `REPOS` constant in `/src/data/github/pr-reviews.json.ts`.

```js
const pullRequests = await FileAttachment(
  "./data/github/pr-reviews.json"
).json();
display(Inputs.table(pullRequests));
```

## Time to review a PR after it's created (working hours)

```js
const MILLIS_IN_HOUR = 1000 * 60 * 60;
const workingHoursToReview = pullRequests.map((pr) => ({
  number: pr.number,
  repo: pr.repo,
  author: pr.author,
  reviewer: pr.reviewer,
  created_morning_or_afternoon: pr.created_morning_or_afternoon,
  review_hours: Math.floor(pr.working_time_create_to_review / MILLIS_IN_HOUR),
}));

// Work out the largest value so we get 1 bin per hour
const maxWorkingHours = Math.max(
  ...workingHoursToReview.map((i) => i.review_hours)
);

display(
  Plot.plot({
    width: 1000,
    x: {
      label: "Time taken for a PR to be reviewed (working hours)",
      domain: [0, 50],
    },
    y: { grid: true, label: "Number of PRs" },
    color: { legend: true, label: "PR opened in the" },
    marks: [
      Plot.rectY(
        workingHoursToReview,
        Plot.binX(
          { y: "count" },
          {
            x: { thresholds: maxWorkingHours, value: "review_hours" },
            fill: "created_morning_or_afternoon",
          }
        )
      ),
      Plot.ruleY([0]),
    ],
  })
);
```

## Time to review by PR author

```js
display(
  Plot.plot({
    width: 1000,
    x: {
      label: "Time taken for a PR to be reviewed (working hours)",
      domain: [0, 50],
    },
    y: { grid: true, label: "Number of PRs" },
    color: { legend: true, label: "PR opened in the" },
    marks: [
      Plot.rectY(
        workingHoursToReview,
        Plot.binX(
          { y: "count" },
          {
            x: { thresholds: maxWorkingHours, value: "review_hours" },
            fill: "author",
          }
        )
      ),
      Plot.ruleY([0]),
    ],
  })
);
```

## Time to review by first reviewer

```js
display(
  Plot.plot({
    width: 1000,
    x: {
      label: "Time taken for a PR to be reviewed (working hours)",
      domain: [0, 50],
    },
    y: { grid: true, label: "Number of PRs" },
    color: { legend: true, label: "PR opened in the" },
    marks: [
      Plot.rectY(
        workingHoursToReview,
        Plot.binX(
          { y: "count" },
          {
            x: { thresholds: maxWorkingHours, value: "review_hours" },
            fill: "reviewer",
          }
        )
      ),
      Plot.ruleY([0]),
    ],
  })
);
```
