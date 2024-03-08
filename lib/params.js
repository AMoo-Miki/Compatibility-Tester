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
