import 'dotenv/config';
import {Octokit} from '@octokit/core';
import {restEndpointMethods} from '@octokit/plugin-rest-endpoint-methods';
import {paginateRest} from '@octokit/plugin-paginate-rest';
import {Endpoints} from '@octokit/types';

const GITHUB_ORG = 'govuk-one-login';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const TEST_MODE = process.env.TEST_MODE;

type AlertsResponse = Endpoints['GET /repos/{owner}/{repo}/dependabot/alerts']['response']['data'];
type RepositoriesResponse = Endpoints['GET /orgs/{org}/repos']['response']['data'];
type CustomPropertiesResponse = Endpoints['GET /repos/{owner}/{repo}/properties/values']['response']['data'];

// Responses are arrays that are themselves not typed, so we can infer the type the array is of with this magic
type Unpacked<T> = T extends (infer U)[] ? U : T;

// These represent the individual items in the arrays returned by the endpoints
type AlertResponse = Unpacked<AlertsResponse>;
type RepositoryResponse = Unpacked<RepositoriesResponse>;
type CustomPropertyResponse = Unpacked<CustomPropertiesResponse>;

const RestOctokit = Octokit.plugin(restEndpointMethods, paginateRest);
const octokit = new RestOctokit({auth: GITHUB_TOKEN});

type SeverityLabel =
    | 'critical'
    | 'high'
    | 'medium'
    | 'low'
    ;

type Severity = {
    label: SeverityLabel,
    value: number,
}

const compareSeverity = (a: Severity, b: Severity) =>
    a.value - b.value;

const mostSevere = (a: Severity, b: Severity) =>
    a.value > b.value ? a : b;

const labelToValue: Record<SeverityLabel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 4,
}
const severityLabelToValue = (label: SeverityLabel): number =>
    labelToValue[label]

const labelToSeverity = (label: SeverityLabel): Severity => ({
    label,
    value: severityLabelToValue(label),
});

type Repository = {
    id: number;
    name: string;
    url: string;
    alerts: Alert[],
    archived: boolean,
    maxSeverity?: Severity,
    inSla: boolean,
    properties: CustomProperties,
}

type Relationship =
    | 'unknown'
    | 'direct'
    | 'transitive'
    ;

type Scope =
    | 'runtime'
    | 'development'
    ;

type CustomProperties = {
    pod?: string;
    productionAssets?: boolean;
    team?: string;
} | {
    // Any other custom properties will appear here and not be processed
    [name: string]: string | string[];
}


type Alert = {
    id: number;
    repositoryId: number;
    name: string;
    url: string;
    severity: Severity;
    createdAt: Date;
    ageInDays: number;
    inSla: boolean;
    relationship: Relationship;
    hasPatch: boolean;
    scope?: Scope;
}

type AlertSummery = {
    name: string,
    inRepositories: number[],
    severity: Severity,
    ageInDays: number,
    inSla: boolean,
    count: number,
}

type FormattedDataForObservable = {
    repositories: Repository[],
    alertSummaries: AlertSummery[],
}

const SLA_DAYS = {
    critical: 7,
    high: 14,
    medium: 30,
    low: 60
};
const isInSla = (days: number, severity: Severity) => (
    SLA_DAYS[severity.label] > days
)

const dayInMillis = 1000 * 60 * 60 * 24;
const calculateAgeInDays = (date: Date): number =>
    Math.round((Date.now() - date.getTime()) / dayInMillis);

const repositoryResponseToRepository = (response: RepositoryResponse): Repository => ({
    id: response.id,
    name: response.name,
    url: response.html_url,
    archived: response.archived ?? false,
    alerts: [],
    inSla: true,
    properties: {},
});

const alertToNewSummary = (alert: Alert): AlertSummery => ({
    name: alert.name,
    inRepositories: [alert.repositoryId],
    severity: alert.severity,
    ageInDays: alert.ageInDays,
    inSla: alert.inSla,
    count: 1,
});

const alertResponseToDependabotAlert = (response: AlertResponse): Alert => {
    const severity = labelToSeverity(response.security_advisory.severity);
    const createdAt = new Date(response.created_at);
    const ageInDays = calculateAgeInDays(createdAt);
    const inSla = isInSla(ageInDays, severity);
    return {
        id: response.number,
        repositoryId: 0,
        name: response.security_advisory.summary ?? '',
        url: response.html_url,
        severity,
        createdAt,
        ageInDays,
        inSla,
        relationship: response.dependency.relationship,
        hasPatch: !!response.security_vulnerability.first_patched_version,
        scope: response.dependency.scope,
    }
}

const podValue = (value: string | string[]): CustomProperties => {
    if (Array.isArray(value)) {
        console.warn('Pod value was an array')
        return {};
    }
    return {pod: value};
}

const teamResponsibleValue = (value: string | string[]): CustomProperties => {
    if (Array.isArray(value)) {
        console.warn('team-responsible value was an array')
        return {};
    }
    return {team: value};
}

const productionAssetsValue = (value: string | string[]): CustomProperties => {
    if (Array.isArray(value)) {
        console.warn('Production Assets value was an array')
        return {};
    }
    if (value !== 'true' && value !== 'false') {
        console.error(`production-assets value was invalid ${value}`);
        return {};
    }
    // Fail-safe to true in case the previous "if" is missed
    return {productionAssets: value !== 'false'};
}

const customPropertyResponseToPartialCustomProperties = (property: CustomPropertyResponse): CustomProperties => {
    switch (property.property_name) {
        case 'pod':
            return podValue(property.value);
        case 'production-assets':
            return productionAssetsValue(property.value);
        case 'team-responsible':
            return teamResponsibleValue(property.value);
    }
    // If it's not one of these properties we'll keep it here unprocessed
    return {[property.property_name]: property.value}
}

const customPropertiesResponseToCustomProperties = (customPropertiesResponse: CustomPropertiesResponse): CustomProperties =>
    customPropertiesResponse.reduce(
        (acc, cur) => (
            {...acc, ...customPropertyResponseToPartialCustomProperties(cur),}
        ),
        {}
    )


// Gets all repositories
const getAllRepositories = (): Promise<RepositoriesResponse> => (
    octokit.paginate(
        octokit.rest.repos.listForOrg, {
            org: GITHUB_ORG,
            type: 'all',
            per_page: 100,
        }
    )
);

// Gets a little slice of repos for testing / developing
const getSomeRepositories = async (): Promise<RepositoriesResponse> => {
    const rawResponse = await octokit.rest.repos.listForOrg({
        org: GITHUB_ORG,
        type: 'all',
        per_page: 20,
        page: 4,
    });
    return rawResponse.data;
}

const getRepositories = (): Promise<RepositoriesResponse> =>
    TEST_MODE
        ? getSomeRepositories()
        : getAllRepositories();

// Get dependencies for a specific repository
const getDependabotAlerts = async (repo: string): Promise<AlertsResponse> =>
    octokit.paginate(
        octokit.rest.dependabot.listAlertsForRepo,
        {
            owner: GITHUB_ORG,
            repo: repo,
            per_page: 100,
        }
    ).catch((error) => {
        console.warn(`Failed to fetch alerts for ${repo}:`, error);
        return [];
    });

const addAlertsToRepository = (repository: Repository, alerts: Alert[]): Alert[] => {
    repository.alerts = alerts.map(alert => ({...alert, repositoryId: repository.id}));
    repository.maxSeverity = alerts.map(alert => alert.severity).sort(compareSeverity)[0];
    repository.inSla = repository.inSla && alerts.every((alert) => alert.inSla);
    return repository.alerts;
}

const createAlertSummariser = (alertSummaries: AlertSummery[]) => (alert: Alert) => {
    const existingAlert = alertSummaries.find(({name}) => name === alert.name);

    if (!existingAlert) {
        alertSummaries.push(alertToNewSummary(alert));
        return;
    }

    existingAlert.inRepositories.push(alert.repositoryId);
    existingAlert.severity = mostSevere(existingAlert.severity, alert.severity);
    existingAlert.ageInDays = Math.max(existingAlert.ageInDays, alert.ageInDays);
    existingAlert.inSla = existingAlert.inSla && alert.inSla;
    existingAlert.count++;
}

// Get custom properties for a specific repository
const getCustomProperties = async (repo:string): Promise<CustomPropertiesResponse> =>
    octokit.paginate(
        octokit.rest.repos.getCustomPropertiesValues,
        {
            owner: GITHUB_ORG,
            repo: repo,
            per_page: 100,
        }
    ).catch((error) => {
        console.warn(`Failed to fetch alerts for ${repo}:`, error);
        return [];
    });

// This function just to check the type of data written to Observable is correct
const outputObservableData = (data: FormattedDataForObservable) => {
    console.log(JSON.stringify(data));
    // console.warn(JSON.stringify(data, null, 2)); // Uncomment to print JSON to terminal
};

(async () => {
    const rawRepoData = await getRepositories();
    const repositories = rawRepoData
        .map(repositoryResponseToRepository)
        .filter((repository) => !repository.archived);

    const alertSummaries: AlertSummery[] = [];
    const alertSummariser = createAlertSummariser(alertSummaries);

    for (const repository of repositories) {
        const [alertsForRepoRaw, propertiesForRepo] = await Promise.all([
            getDependabotAlerts(repository.name),
            getCustomProperties(repository.name),
        ]);

        // Add properties to repo
        repository.properties = customPropertiesResponseToCustomProperties(propertiesForRepo);

        // Add alerts to repo
        addAlertsToRepository(
            repository,
            alertsForRepoRaw
                .filter((alert) => alert.state === 'open')
                .map(alertResponseToDependabotAlert)
        );

        // Add alerts to summary
        repository.alerts.forEach(alertSummariser);
    }

    outputObservableData({
        repositories,
        alertSummaries,
    });
})();
