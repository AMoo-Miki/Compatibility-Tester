import path from 'path';
import { _spawn } from '../utils.js';
import { params } from '../params.js';
import { v4 as uuidv4 } from 'uuid';
import { processMochAwesomeResults } from './mochawesome.js';
import { triggerBuild, waitForFreeParallelBuild } from '../codebuild.js';
import { _error, _info, _ok } from '../logging.js';


/**
 * @param {string} folder
 * @param {string} osDir
 * @param {string} osdDir
 * @param {number|string} group
 */
export const runDashboardsMochaTest = async (folder, osDir, osdDir, group) => {
  _info(`Running Dashboards Mocha tests in ${folder}...`);

  try {
    await _spawn(
      `node scripts/functional_tests ` +
      `--opensearch-dashboards-install-dir ${osdDir} ` +
      `--config test/functional/config.js ` +
      (group ? `--include ciGroup${group}` : ''),
      {
        cwd: folder,
        env: {
          ...process.env,
          TEST_OPENSEARCH_FROM: osDir,
          TEST_BROWSER_HEADLESS: '1',
          //LD_LIBRARY_PATH: '/opt/google/chrome',
          //TEST_BROWSER_BINARY_PATH: '/opt/google/chrome/google-chrome'
        }
      }
    );
  } catch (ex) {
    _error(`Error running tests in ${folder}`);
    _error('Error details:', ex);
  } finally {
    _info(`Finished running tests in ${folder}`);
  }
};

/**
 * @param {string} folder
 * @param {string} osDir
 * @param {string} osdDir
 */
export const runPluginsMochaTest = async (folder, osDir, osdDir) => {
  _info(`Running Plugins Mocha tests in ${folder}...`);

  try {
    await _spawn(
      `node scripts/functional_tests ` +
      `--opensearch-dashboards-install-dir ${osdDir} ` +
      `--config test/plugin_functional/config.ts`,
      {
        cwd: folder,
        env: {
          ...process.env,
          TEST_OPENSEARCH_FROM: osDir,
          TEST_BROWSER_HEADLESS: '1',
          //LD_LIBRARY_PATH: '/opt/google/chrome',
          //TEST_BROWSER_BINARY_PATH: '/opt/google/chrome/google-chrome'
        }
      }
    );
  } catch (ex) {
    _error(`Error running tests in ${folder}`);
    _error('Error details:', ex);
  } finally {
    _info(`Finished running tests in ${folder}`);
  }
};

export const handleMochaTests = async (folder, osDir, osdDir) => {
  const mochaRoot = path.join(folder, 'dashboards')
  _info(`Running Mocha tests in ${mochaRoot} ...`);
  const timestamp = params.get('--timestamp') || Date.now();
  const ref = params.get('--ref') || uuidv4();
  const group = params.get('--group');

  if (group && group !== '0') {
    await runDashboardsMochaTest(mochaRoot, osDir, osdDir, group);
  } else {
    await runPluginsMochaTest(mochaRoot, osDir, osdDir);
  }
  await processMochAwesomeResults(path.relative(folder, mochaRoot), mochaRoot, folder, ref, timestamp, false);
};

/**
 *
 * @param {number} job
 * @param {string} jobParams
 * @param {string} ref
 * @returns {Promise<*|string|number|number|string>}
 */
export const triggerMochaBuild = async (job, jobParams, ref) => {
  return triggerBuild({
    environmentVariablesOverride: [
      {
        name: 'SETUP_PARAMS',
        value: jobParams,
        type: 'PLAINTEXT'
      },
      {
        name: 'SETUP_GROUP',
        value: `${job}`,
        type: 'PLAINTEXT'
      },
    ],
    logsConfigOverride: {
      cloudWatchLogs: {
        status: 'ENABLED',
        groupName: 'compatibility-test-worker',
        streamName: `mocha-${job}/${ref}`,
      },
      s3Logs: {
        status: 'DISABLED',
      }
    },
  });
};

export const runParallelMochaTests = async (folder, builds, timestamp, ref) => {
  _info(`Identifying Mocha tests in ${folder} ...`);

  let cnt = 0;
  const jobParams = [
    `--ref=${ref}`,
    `--timestamp=${timestamp}`,
    `--test-type=mocha`,
  ];
  params.forEach((value, key) => {
    if (!['--parallel', '--no-clean', '--test-type', '--ref', '--timestamp'].includes(key))
      jobParams.push(`${key}=${value}`);
  });

  const maxGroup = 13;
  const totalBuilds = maxGroup + builds.length;

  for (let job = 0; job <= maxGroup; job++) {
    const buildId = await triggerMochaBuild(job, jobParams.join(' '), ref);
    if (buildId) {
      builds.push(buildId);
      _ok(`Started (${builds.length}: ${++cnt}/${totalBuilds}) ${buildId}`);
    }

    await waitForFreeParallelBuild(builds);
  }
};