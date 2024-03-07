import { readdir, writeFile } from 'fs/promises';
import path from 'path';
import { _appendToFile, _changeInFile, _exec, _spawn } from '../utils.js';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { LOG_PROPS, params } from '../params.js';
import { v4 as uuidv4 } from 'uuid';
import { getReporter, processMochAwesomeResults } from './mochawesome.js';
import { triggerBuild, waitForFreeParallelBuild } from '../codebuild.js';
import { _error, _info, _notice, _ok } from '../logging.js';

const CYPRESS_ENV = {
  SECURITY_ENABLED: !params.has('--disable-security'),
  security_enabled: !params.has('--disable-security'),
  username: 'admin',
  password: 'admin',
  openSearchUrl: params.has('--disable-security') ? 'http://localhost:9200' : 'https://localhost:9200',
  //opensearch_url: params.has('--disable-security') ? 'http://localhost:9200' : 'https://localhost:9200',
  WAIT_FOR_LOADER_BUFFER_MS: 500
};

const ignoredFolders = [
  'node_modules',
  '.git',
  '.github'
];

const cypressConfigFiles = [
  'cypress.json',
  'cypress.config.js',
  'cypress.config.ts',
  'cypress.config.cjs',
  'cypress.config.mjs',
];

export const findCypressRoots = async (folder) => {
  const items = await readdir(folder, { withFileTypes: true, encoding: 'utf8' });
  const cypressRoots = [];
  let hasCypressFolder = false;
  let hasCypressConfigFile = false;
  for (const item of items) {
    if (item.isDirectory()) {
      if (item.name === 'cypress' || item.name === '.cypress') hasCypressFolder = true;
      else if (!ignoredFolders.includes(item.name)) cypressRoots.push(...(await findCypressRoots(path.join(folder, item.name))));
    } else if (item.isFile()) {
      if (cypressConfigFiles.includes(item.name)) hasCypressConfigFile = true;
    }
  }

  if (hasCypressFolder && hasCypressConfigFile)
    cypressRoots.unshift(folder);

  return cypressRoots;
};

export const patchCypressRootCodeCoverage = async (folder) => {
  return _notice(`Skipping code coverage patching in ${folder}`);

  let cypressFolder = path.join(folder, 'cypress');
  if (!existsSync(cypressFolder)) cypressFolder = path.join(folder, '.cypress');
  if (!existsSync(cypressFolder)) throw `Can't fine Cypress folder in ${folder}`;

  const pluginIndexFile = path.join(cypressFolder, 'plugins/index.js');
  let foundReturnConfig = false;
  if (existsSync(pluginIndexFile)) {
    foundReturnConfig = await _changeInFile(pluginIndexFile, {
      'return config': 'require(\'@cypress/code-coverage/task\')(on, config);\nreturn config;'
    });
  }
  if (!foundReturnConfig) {
    await writeFile(
      pluginIndexFile,
      `module.exports = (on, config) => { require('@cypress/code-coverage/task')(on, config); return config; }`,
      'utf8'
    );
  }

  const supportIndexFile = path.join(cypressFolder, 'support/index.js');
  if (existsSync(supportIndexFile)) {
    await _appendToFile(supportIndexFile, `import '@cypress/code-coverage/support';`);
  } else {
    await writeFile(
      supportIndexFile,
      `import '@cypress/code-coverage/support';\n`,
      'utf8'
    );
  }
};

export const runCypressTest = async (folder, spec) => {
  _info(`Running tests in ${folder}...`);
  const localCypress = path.join(folder, 'node_modules/.bin/cypress');
  const cmd = existsSync(localCypress) ? path.relative(folder, localCypress) : 'cypress';
  const envValue = Object.keys(CYPRESS_ENV).map(key => `${key}=${CYPRESS_ENV[key]}`).join(',');

  try {
    if (LOG_PROPS.version.dashboards?.startsWith('git://')) {
      await patchCypressRootCodeCoverage(folder);
    }

    await _spawn(
      `${cmd} run ` +
      `--reporter ${path.relative(folder, getReporter())} --reporter-options reportDir="mochawesome/results",overwrite=false,html=false,json=true ` +
      `--headless --env ${envValue} --config video=false,screenshotOnRunFailure=false ` +
      (spec ? `--spec ${spec}` : ''),
      {
        cwd: folder,
      }
    );
  } catch (ex) {
    _error(`Error running tests in ${folder}`);
    _error('Error details:', ex);
  } finally {
    _info(`Finished running tests in ${folder}`);
  }
};

export const runCypressTests = async (folder, root) => {
  _info(`Running Cypress tests in ${folder} ...`);
  const timestamp = params.get('--timestamp') || Date.now();
  const ref = params.get('--ref') || uuidv4();
  const cypressRoots = await findCypressRoots(folder);
  const processors = [];
  for (const cypressRoot of cypressRoots) {
    await runCypressTest(cypressRoot, params.get('--spec'));
    processors.push(processMochAwesomeResults(path.relative(root, cypressRoot), cypressRoot, folder, ref, timestamp));
  }

  await Promise.all(processors);
};

/**
 *
 * @param {{root: string, specs: string[]}} job
 * @param {string} jobParams
 * @param {string} ref
 * @returns {Promise<*|string|number|number|string>}
 */
export const triggerCypressBuild = async (job, jobParams, ref) => {
  const specs = job.specs.join(',');
  const hash = createHash('md5').update(specs).digest('hex');
  return triggerBuild({
    environmentVariablesOverride: [
      {
        name: 'SETUP_PARAMS',
        value: `--spec=${specs} ${jobParams}`,
        type: 'PLAINTEXT'
      },
      {
        name: 'SETUP_ROOT',
        value: job.root,
        type: 'PLAINTEXT'
      },
    ],
    logsConfigOverride: {
      cloudWatchLogs: {
        status: 'ENABLED',
        groupName: 'compatibility-test-worker',
        streamName: `${hash}/${ref}`,
      },
      s3Logs: {
        status: 'DISABLED',
      }
    },
  });
};

export const runParallelCypressTests = async (folder, builds, timestamp, ref) => {
  _info(`Identifying Cypress tests in ${folder} ...`);

  const allSpecs = [];

  const cypressRoots = await findCypressRoots(folder);
  for (const cypressRoot of cypressRoots) {
    const specGroups = {};
    const specsFound = (await _exec(`find-cypress-specs`, {
      cwd: cypressRoot
    }))?.trim?.().split(',');

    specsFound.forEach(spec => {
      const loc = path.dirname(spec);
      if (!Array.isArray(specGroups[loc])) specGroups[loc] = [spec];
      else specGroups[loc].push(spec);
    });

    Object.keys(specGroups).forEach(key => {
      allSpecs.push({
        root: path.relative(folder, cypressRoot),
        specs: specGroups[key],
      });
    });
  }

  let cnt = 0;
  const jobParams = [
    `--ref=${ref}`,
    `--timestamp=${timestamp}`,
    `--test-type=cypress`,
  ];
  params.forEach((value, key) => {
    if (!['--parallel', '--no-clean', '--test-type', '--ref', '--timestamp'].includes(key))
      jobParams.push(`${key}=${value}`);
  });

  const specCount = allSpecs.length;
  const totalBuilds = specCount + builds.length;

  for (const job of allSpecs) {
    const buildId = await triggerCypressBuild(job, jobParams.join(' '), ref);
    if (buildId) {
      builds.push(buildId);
      _ok(`Started (${builds.length}: ${++cnt}/${totalBuilds}) ${buildId}`);
    }

    await waitForFreeParallelBuild(builds);
  }
};

export const handleCypressTests = async (folder) => {
  if (params.has('--root')) {
    await runCypressTests(path.join(folder, params.get('--root')), folder);
  } else {
    await runCypressTests(folder);
  }
};