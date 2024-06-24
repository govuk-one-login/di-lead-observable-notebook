# Environment variables

## API tokens

Environment variables can be set for local development using a `.env` file. An example file is included as a starting point.

| Name                  | Description                                                         | Token Requirements                                                                      |
| :-------------------- | :------------------------------------------------------------------ | ----------------------------------------------------------------------------------------|
| GITHUB_TOKEN | API token created in https://github.com/settings/tokens?type=beta in the format of `ACCESS_TOKEN` | [See README](./src/data/github/README.md)                          |
| JIRA_TOKEN | API token created in https://id.atlassian.com/manage-profile/security/api-tokens in the format of `EMAIL_ADDRESS:ACCESS_TOKEN` | [See README](./src/data/jira/README.md) |
| PAGER_DUTY_TOKEN | API token created in the User settings section under pagerduty.com in the format of `ACCESS_TOKEN` | [See README](./src/data/pagerduty/README.md)                  |
| SONARCLOUD_TOKEN | API token created in https://sonarcloud.io/account/security in the format of `ACCESS_TOKEN` | [See README](./src/data/sonarcloud/README.md)                        |

## General

| Name                  | Description                                                         | More info                              |
| :-------------------- | :------------------------------------------------------------------ | -------------------------------------- |
| AWS_ACCOUNT_NAMES     | List of aws profiles from `~/.aws/config` in CSV format             | [See README](./src/data/aws/README.md) |
