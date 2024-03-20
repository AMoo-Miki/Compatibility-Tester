import path from 'path';
import os from 'os';

export const params = new Map();
for (const arg of process.argv) {
  if (arg.startsWith('-')) {
    const [key, ...rest] = arg.split('=');
    params.set(key, rest.length ? rest.join('') : true);
  }
}

if ([false, 'false'].includes(params.get('--disable-security'))) params.delete('--disable-security');
if ([false, 'false'].includes(params.get('--no-plugins'))) params.delete('--no-plugins');
if (params.has('--no-plugins')) params.set('--disable-security', true);

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
  'alerting': 'git://opensearch-project/alerting-dashboards-plugin/2.x',
  'anomaly-detection': 'git://opensearch-project/anomaly-detection-dashboards-plugin/2.x',
  'assistant': 'git://opensearch-project/dashboards-assistant/2.x',
  'maps': 'git://opensearch-project/dashboards-maps/2.x',
  'gantt-chart': 'git://opensearch-project/dashboards-visualizations/2.x',
  'index-management': 'git://opensearch-project/index-management-dashboards-plugin/2.x',
  'ml-commons': 'git://opensearch-project/ml-commons-dashboards/2.x',
  'notifications': 'git://opensearch-project/dashboards-notifications/2.x',
  'observability': 'git://opensearch-project/dashboards-observability/2.x',
  'query-workbench': 'git://opensearch-project/dashboards-query-workbench/2.x',
  'reporting': 'git://opensearch-project/dashboards-reporting/2.x',
  'search-relevance': 'git://opensearch-project/dashboards-search-relevance/2.x',
  'security-analytics': 'git://opensearch-project/security-analytics-dashboards-plugin/2.x',
  'security': 'git://opensearch-project/security-dashboards-plugin/2.x',
};

export const dashboardsDefault = 'git://opensearch-project/OpenSearch-Dashboards/2.x';

export const slugs = {
  '/core-opensearch-dashboards/': 'dashboards',
  '/plugins/reports-dashboards/': 'dashboards/plugins/reporting',
  '/plugins/observability-dashboards/': 'dashboards/plugins/observability',
  '/plugins/notifications-dashboards/': 'dashboards/plugins/notifications',
  '/plugins/alerting-dashboards-plugin/': 'dashboards/plugins/alerting',
  '/plugins/anomaly-detection-dashboards-plugin/': 'dashboards/plugins/anomaly-detection',
  '/plugins/index-management-dashboards-plugin/': 'dashboards/plugins/index-management',
  '/plugins/gantt-chart-dashboards/': 'dashboards/plugins/gantt-chart',
  '/plugins/search-relevance-dashboards/': 'dashboards/plugins/search-relevance',
  '/plugins/security/': 'dashboards/plugins/security',
  '/plugins/security-dashboards-plugin/': 'dashboards/plugins/security',
  '/plugins/security-analytics-dashboards-plugin/': 'dashboards/plugins/security-analytics',
  '/plugins/query-workbench-dashboards/': 'dashboards/plugins/query-workbench',
  '/plugins/custom-import-map-dashboards/': 'dashboards/plugins/maps',
  '/plugins/ml-commons-dashboards/': 'dashboards/plugins/ml-commons',
  '/plugins/dashboards-assistant/': 'dashboards/plugins/assistant'
}
