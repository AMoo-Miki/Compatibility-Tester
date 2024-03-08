import path from 'path';
import os from 'os';

export const params = new Map();
for (const arg of process.argv) {
  if (arg.startsWith('-')) {
    const [key, ...rest] = arg.split('=');
    params.set(key, rest.length ? rest.join('') : true);
  }
}

export const tmpDir = params.get('--tmp-dir') || path.join(os.homedir(), 'osd');
export const PLATFORM = process.platform === 'win32' ? 'windows' : process.platform;
export const ARCH = process.arch === 'arm64' ? 'arm64' : 'x64';
export const EXTENSION = process.platform === 'win32' ? 'zip' : 'tar.gz';
export const TYPE = process.platform === 'win32' ? 'zip' : 'tar';

export const LOG_PROPS = {
  package: {},
  'with-security': !params.has('--disable-security'),
  platform: `${PLATFORM}-${ARCH}`,
};

export const dashboardsPlugins = {
  'alerting': 'git://opensearch-project/alerting-dashboards-plugin/2.12',
  'anomaly-detection': 'git://opensearch-project/anomaly-detection-dashboards-plugin/2.12',
  'assistant': 'git://opensearch-project/dashboards-assistant/2.12',
  'maps': 'git://opensearch-project/dashboards-maps/2.12',
  'gantt-chart': 'git://opensearch-project/dashboards-visualizations/2.12',
  'index-management': 'git://opensearch-project/index-management-dashboards-plugin/2.12',
  'ml-commons': 'git://opensearch-project/ml-commons-dashboards/2.12',
  'notifications': 'git://opensearch-project/dashboards-notifications/2.12',
  'observability': 'git://opensearch-project/dashboards-observability/2.12',
  'query-workbench': 'git://opensearch-project/dashboards-query-workbench/2.12',
  'reporting': 'git://opensearch-project/dashboards-reporting/2.12',
  'search-relevance': 'git://opensearch-project/dashboards-search-relevance/2.12',
  'security-analytics': 'git://opensearch-project/security-analytics-dashboards-plugin/2.12',
  'security': 'git://opensearch-project/security-dashboards-plugin/2.12',
};

export const dashboardsDefault = 'git://opensearch-project/OpenSearch-Dashboards/2.12';

export const slugs = {
  '/core-opensearch-dashboards/': 'dashboards',
  '/plugins/reports-dashboards/': 'dashboards/plugin/reporting',
  '/plugins/observability-dashboards/': 'dashboards/plugin/observability',
  '/plugins/notifications-dashboards/': 'dashboards/plugin/notifications',
  '/plugins/alerting-dashboards-plugin/': 'dashboards/plugin/alerting',
  '/plugins/anomaly-detection-dashboards-plugin/': 'dashboards/plugin/anomaly-detection',
  '/plugins/index-management-dashboards-plugin/': 'dashboards/plugin/index-management',
  '/plugins/gantt-chart-dashboards/': 'dashboards/plugin/gantt-chart',
  '/plugins/search-relevance-dashboards/': 'dashboards/plugin/search-relevance',
  '/plugins/security/': 'dashboards/plugin/security',
  '/plugins/security-dashboards-plugin/': 'dashboards/plugin/security',
  '/plugins/security-analytics-dashboards-plugin/': 'dashboards/plugin/security-analytics',
  '/plugins/query-workbench-dashboards/': 'dashboards/plugin/query-workbench',
  '/plugins/custom-import-map-dashboards/': 'dashboards/plugin/maps',
  '/plugins/ml-commons-dashboards/': 'dashboards/plugin/ml-commons',
  '/plugins/dashboards-assistant/': 'dashboards/plugin/assistant'
}
