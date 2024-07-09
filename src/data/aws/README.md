# Data Loaders - AWS 

These data loaders are written to scan multiple accounts using a single authentication by a user using SSO.

## AWS SSO Configuration

AWS SSO is configured using:

```bash
[sso-session my-session]
sso_start_url = {{ AWS START PAGE URL }}
sso_region = {{ AWS REGION }}
sso_registration_scopes = sso:account:access
```

Each AWS account will then be configured using:

```bash
[profile {{ PROFILE NAME}}]
sso_session = my-session
sso_account_id = {{ AWS ACCOUNT ID }}
sso_role_name = {{ AWS ROLE NAME }}
region = {{ AWS REGION}}

[profile {{ OTHER PROFILE NAME}}]
sso_session = my-session
sso_account_id = {{ OTHER AWS ACCOUNT ID }}
sso_role_name = {{ OTHER AWS ROLE NAME }}
region = {{ AWS REGION}}
```

## Environment variables

Multiple accounts can be scanned, and can be configured using .env property of 

```
AWS_ACCOUNT_NAMES={{ AWS PROFILE NAME}},{{ OTHER AWS PROFILE NAME}}
```


## Authentication

An npm task is provided as a convienence method:

```sh
npm run aws:login
```

which is a shortcut to

```sh
aws sso login --sso-session my-session"
```


## Tips

- AWS APIs use `NextToken` to implement token based pagination. Requests should be repeated until `NextToken` is null.
- A lot of data is returned in these API calls, some of which could be considered sensitive
    - For local usage, this is not an issue as the website is running on a trusted system. Extra data also helps to encourage insights.
    - For a deployed system, this information should be reduced to the minimum required to support the visualisation