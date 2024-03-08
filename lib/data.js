import { Client } from '@opensearch-project/opensearch';
import { _error } from './logging.js';
import * as config from './config.js';

/**
 * @type {string}
 */
const TEST_RESULTS_INDEX_NAME = config.get('opensearch.index.results');

/**
 * @type {string}
 */
const TEST_SUMMARIES_INDEX_NAME = config.get('opensearch.index.summaries');

const client = new Client({
  node: config.get('opensearch.domain.endpoint'),
  auth: config.get('opensearch.auth'),
  compression: 'gzip',
});

export const init = async () => {
  const summaryTemplateName = `${TEST_SUMMARIES_INDEX_NAME}-template`;
  const summaryTemplateExists = await client.indices.existsIndexTemplate({ name: summaryTemplateName });
  if (!summaryTemplateExists?.body) {
    await client.indices.putIndexTemplate({
      name: summaryTemplateName,
      body: {
        index_patterns: [TEST_SUMMARIES_INDEX_NAME],
        template: {
          settings: {
            number_of_replicas: '2',
            number_of_shards: '5',
          },
          mappings: {
            properties: {
              spec: {
                type: 'keyword'
              },
              src: {
                type: 'keyword'
              },
              ref: {
                type: 'keyword'
              },
              count: {
                properties: {
                  failed: {
                    type: 'short'
                  },
                  passed: {
                    type: 'short'
                  },
                  pending: {
                    type: 'short'
                  },
                  skipped: {
                    type: 'short'
                  }
                }
              },
              results: {
                properties: {
                  duration: {
                    type: 'unsigned_long'
                  },
                  state: {
                    type: 'keyword',
                  },
                  title: {
                    type: 'text',
                    fields: {
                      keyword: {
                        type: 'keyword',
                        ignore_above: 256
                      }
                    }
                  },
                  error: {
                    type: 'text'
                  },
                }
              },
              version: {
                properties: {
                  'alerting-test': {
                    type: 'keyword',
                  },
                  'anomaly-detection-test': {
                    type: 'keyword',
                  },
                  'assistant-test': {
                    type: 'keyword',
                  },
                  dashboards: {
                    type: 'keyword',
                  },
                  'dashboards-test': {
                    type: 'keyword',
                  },
                  'functional-test': {
                    type: 'keyword',
                  },
                  'gantt-chart-test': {
                    type: 'keyword',
                  },
                  'index-management-test': {
                    type: 'keyword',
                  },
                  'maps-test': {
                    type: 'keyword',
                  },
                  'ml-commons-test': {
                    type: 'keyword',
                  },
                  'notifications-test': {
                    type: 'keyword',
                  },
                  'observability-test': {
                    type: 'keyword',
                  },
                  opensearch: {
                    type: 'keyword',
                  },
                  'query-workbench-test': {
                    type: 'keyword',
                  },
                  'reporting-test': {
                    type: 'keyword',
                  },
                  'search-relevance-test': {
                    type: 'keyword',
                  },
                  'security-analytics-test': {
                    type: 'keyword',
                  },
                  'security-test': {
                    type: 'keyword',
                  }
                }
              },
              'with-security': {
                type: 'boolean'
              },
              timestamp: {
                type: 'date'
              }
            }
          }
        },
      }
    });
  }

  const resultsTemplateName = `${TEST_RESULTS_INDEX_NAME}-template`;
  const resultsTemplateExists = await client.indices.existsIndexTemplate({ name: resultsTemplateName });
  if (!resultsTemplateExists?.body) {
    await client.indices.putIndexTemplate({
      name: resultsTemplateName,
      body: {
        index_patterns: [TEST_RESULTS_INDEX_NAME],
        template: {
          settings: {
            number_of_replicas: '2',
            number_of_shards: '5',
          },
          mappings: {
            properties: {
              spec: {
                type: 'keyword'
              },
              src: {
                type: 'keyword'
              },
              ref: {
                type: 'keyword'
              },
              duration: {
                type: 'unsigned_long'
              },
              state: {
                type: 'keyword',
              },
              error: {
                type: 'text'
              },
              title: {
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword',
                    ignore_above: 256
                  }
                }
              },
              version: {
                properties: {
                  'alerting-test': {
                    type: 'keyword',
                  },
                  'anomaly-detection-test': {
                    type: 'keyword',
                  },
                  'assistant-test': {
                    type: 'keyword',
                  },
                  dashboards: {
                    type: 'keyword',
                  },
                  'dashboards-test': {
                    type: 'keyword',
                  },
                  'functional-test': {
                    type: 'keyword',
                  },
                  'gantt-chart-test': {
                    type: 'keyword',
                  },
                  'index-management-test': {
                    type: 'keyword',
                  },
                  'maps-test': {
                    type: 'keyword',
                  },
                  'ml-commons-test': {
                    type: 'keyword',
                  },
                  'notifications-test': {
                    type: 'keyword',
                  },
                  'observability-test': {
                    type: 'keyword',
                  },
                  opensearch: {
                    type: 'keyword',
                  },
                  'query-workbench-test': {
                    type: 'keyword',
                  },
                  'reporting-test': {
                    type: 'keyword',
                  },
                  'search-relevance-test': {
                    type: 'keyword',
                  },
                  'security-analytics-test': {
                    type: 'keyword',
                  },
                  'security-test': {
                    type: 'keyword',
                  }
                }
              },
              'with-security': {
                type: 'boolean'
              },
              timestamp: {
                type: 'date'
              }
            }
          }
        },
      }
    });
  }
};

/** Check if index exists
 *
 * @param {string} index
 * @returns {Promise<boolean>}
 */
export const _indexExists = async index => {
  const { body } = await client.indices.exists({ index });
  return body;
};

/** Add document to an index
 *
 * @param {string} index
 * @param {Object.<string,any>} doc
 * @returns {Promise<string|undefined>}
 */
const _indexDoc = async (index, doc) => {
  if (!index?.trim()) throw 'Invalid index name';

  const exists = await _indexExists(index);
  if (!exists) await client.indices.create({ index });

  const result = await client.index({
    index,
    body: doc,
    refresh: true,
  });

  const success = result?.statusCode === 201;
  if (!success) {
    _error('Failed to index', result.meta?.body?.error);
    _error('Failure details:', result);
    throw 'Index failed';
  }

  return result.body?._id;
};

/** Add a summary document
 *
 * @param {Object.<string,any>} doc
 * @returns {Promise<string|undefined>}
 */
export const addSummaryDoc = async (doc) => {
  return _indexDoc(TEST_SUMMARIES_INDEX_NAME, doc);
};

/** Add a result document
 *
 * @param {Object.<string,any>} doc
 * @returns {Promise<string|undefined>}
 */
export const addResultDoc = async (doc) => {
  return _indexDoc(TEST_RESULTS_INDEX_NAME, doc);
};