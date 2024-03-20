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
    console.log('Creating index template for summaries');
    await client.indices.putIndexTemplate({
      name: summaryTemplateName,
      body: {
        index_patterns: [`${TEST_SUMMARIES_INDEX_NAME}-*`],
        template: {
          settings: {
            'plugins.index_state_management.rollover_alias': TEST_SUMMARIES_INDEX_NAME,
            number_of_replicas: '2',
            number_of_shards: '5',
            max_inner_result_window: '1000'
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
              package: {
                properties: {
                  alerting: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'alerting-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'anomaly-detection': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'anomaly-detection-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  assistant: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'assistant-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  dashboards: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'dashboards-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'functional-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'gantt-chart': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'gantt-chart-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'index-management': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'index-management-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  maps: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'maps-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'ml-commons': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'ml-commons-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  notifications: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'notifications-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  observability: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'observability-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  opensearch: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'query-workbench': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'query-workbench-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  reporting: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'reporting-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'search-relevance': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'search-relevance-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'security-analytics': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'security-analytics-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  security: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'security-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  }
                }
              },
              platform: {
                type: 'keyword'
              },
              scope: {
                type: 'keyword'
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

  try {
    await client.transport.request({
      method: 'GET',
      path: `/_plugins/_ism/policies/${TEST_SUMMARIES_INDEX_NAME}-rollover-policy`,
      body: {},
      querystring: {}
    });
  } catch {
    console.log('Creating rollover policy for summaries');
    await client.transport.request({
      method: 'PUT',
      path: `/_plugins/_ism/policies/${TEST_SUMMARIES_INDEX_NAME}-rollover-policy`,
      body: {
        policy: {
          description: `${TEST_SUMMARIES_INDEX_NAME}-rollover-policy`,
          default_state: 'rollover',
          states: [
            {
              name: 'rollover',
              actions: [{ rollover: { min_doc_count: 10000 } }],
              transitions: []
            }
          ],
          ism_template: {
            index_patterns: [`${TEST_SUMMARIES_INDEX_NAME}-*`],
            priority: 100
          }
        }
      },
      querystring: {}
    });
  }

  if (!(await aliasExists(TEST_SUMMARIES_INDEX_NAME))) {
    console.log('Creating alias for summaries');
    await client.indices.create({
      index: `${TEST_SUMMARIES_INDEX_NAME}-000001`,
      body: {
        aliases: {
          [TEST_SUMMARIES_INDEX_NAME]: {
            is_write_index: true
          }
        }
      }
    });
  }

  const resultsTemplateName = `${TEST_RESULTS_INDEX_NAME}-template`;
  const resultsTemplateExists = await client.indices.existsIndexTemplate({ name: resultsTemplateName });
  if (!resultsTemplateExists?.body) {
    console.log('Creating index template for results');
    await client.indices.putIndexTemplate({
      name: resultsTemplateName,
      body: {
        index_patterns: [`${TEST_RESULTS_INDEX_NAME}-*`],
        template: {
          settings: {
            'plugins.index_state_management.rollover_alias': TEST_RESULTS_INDEX_NAME,
            number_of_replicas: '2',
            number_of_shards: '5',
            max_inner_result_window: '1000'
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
              package: {
                properties: {
                  alerting: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'alerting-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'anomaly-detection': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'anomaly-detection-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  assistant: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'assistant-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  dashboards: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'dashboards-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'functional-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'gantt-chart': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'gantt-chart-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'index-management': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'index-management-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  maps: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'maps-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'ml-commons': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'ml-commons-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  notifications: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'notifications-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  observability: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'observability-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  opensearch: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'query-workbench': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'query-workbench-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  reporting: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'reporting-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'search-relevance': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'search-relevance-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'security-analytics': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'security-analytics-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  security: {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  },
                  'security-test': {
                    properties: {
                      src: { type: 'keyword' },
                      version: { type: 'keyword' },
                    }
                  }
                }
              },
              platform: {
                type: 'keyword'
              },
              scope: {
                type: 'keyword'
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

  try {
    await client.transport.request({
      method: 'GET',
      path: `/_plugins/_ism/policies/${TEST_RESULTS_INDEX_NAME}-rollover-policy`,
      body: {},
      querystring: {}
    });
  } catch {
    console.log('Creating rollover policy for results');
    await client.transport.request({
      method: 'PUT',
      path: `/_plugins/_ism/policies/${TEST_RESULTS_INDEX_NAME}-rollover-policy`,
      body: {
        policy: {
          description: `${TEST_RESULTS_INDEX_NAME}-rollover-policy`,
          default_state: 'rollover',
          states: [
            {
              name: 'rollover',
              actions: [{ rollover: { min_doc_count: 100000 } }],
              transitions: []
            }
          ],
          ism_template: {
            index_patterns: [`${TEST_RESULTS_INDEX_NAME}-*`],
            priority: 100
          }
        }
      },
      querystring: {}
    });
  }

  if (!(await aliasExists(TEST_RESULTS_INDEX_NAME))) {
    console.log('Creating alias for results');
    await client.indices.create({
      index: `${TEST_RESULTS_INDEX_NAME}-000001`,
      body: {
        aliases: {
          [TEST_RESULTS_INDEX_NAME]: {
            is_write_index: true
          }
        }
      }
    });
  }
};

/** Check if index exists
 *
 * @param {string} index
 * @returns {Promise<boolean>}
 */
export const indexExists = async index => {
  const { body } = await client.indices.exists({ index });
  return body;
};

/** Check if alias exists
 *
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export const aliasExists = async name => {
  const { body } = await client.indices.existsAlias({ name, ignore_unavailable: true });
  return body;
};

/** Add document to an index
 *
 * @param {string} index
 * @param {Object.<string,any>} doc
 * @returns {Promise<string|undefined>}
 */
const indexDoc = async (index, doc) => {
  if (!index?.trim()) throw 'Invalid index name';

  const exists = await indexExists(index);
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
  return indexDoc(TEST_SUMMARIES_INDEX_NAME, doc);
};

/** Add a result document
 *
 * @param {Object.<string,any>} doc
 * @returns {Promise<string|undefined>}
 */
export const addResultDoc = async (doc) => {
  return indexDoc(TEST_RESULTS_INDEX_NAME, doc);
};