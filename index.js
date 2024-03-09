import { mkdir, rm } from 'fs/promises';
import { setTimeout } from 'timers/promises';
import { v4 as uuidv4 } from 'uuid';
import { LOG_PROPS, params, tmpDir } from './lib/params.js';
import * as data from './lib/data.js';
import {
  handleCypressTests,
  handleMochaTests,
  prepareTests,
  runParallelCypressTests,
  runParallelMochaTests
} from './lib/tests/index.js';
import { waitForBuild } from './lib/codebuild.js';
import { prepareOpenSearch, runOpenSearch } from './lib/opensearch.js';
import { prepareDashboards, runDashboards } from './lib/dashboards.js';
import { killSubprocesses } from './lib/subprocess.js';
import { _error, _info, _verbose2 } from './lib/logging.js';

/* Options
 *    --disable-security        Disable security in OpenSearch.
 *    --use-opensearch          Use an already running instance of OpenSearch.
 *                              If a path is provided, OpenSearch in that path will be executed.
 *    --use-dashboards          Use an already running instance of OpenSearch Dashboards.
 *                              If a path is provided, OpenSearch Dashboards in that path will be executed.
 *    --opensearch-version      The release version of OpenSearch to use (#.#.#).
 *    --dashboards-version      The version of OpenSearch Dashboards to use; if a release version (#.#.#) is
 *                              provided, a release bundle that includes all the plugins will be used, and
 *                              if a Git endpoint is provided (git://fork-user/repo-name/branch-name), OSD will
 *                              be cloned from there with plugins cloned from the actual repositories.
 *                              If no version is provided, git://opensearch-project/OpenSearch-Dashboards/main
 *                              is used.
 */





const run = async () => {
  if (params.has('--init')) {
    await data.init();
    process.exit(0);
  }

  if (!params.has('--no-clean')) {
    _info(`Cleaning up...`);
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
  }

  _verbose2(`Starting up...`);

  const { dest: testDir, versions: downloadedVersions } = await prepareTests();
  for (const key of Object.keys(downloadedVersions))
    LOG_PROPS.package[key] = downloadedVersions[key];

  if (params.has('--parallel')) {
    const timestamp = Date.now();
    const ref = uuidv4();
    const builds = [];

    await runParallelMochaTests(testDir, builds, timestamp, ref);
    await runParallelCypressTests(testDir, builds, timestamp, ref);

    await waitForBuild('Parallel Tests', builds);
  } else {
    const osDir = await prepareOpenSearch();
    const osdDir = await prepareDashboards();

    if (params.get('--test-type') === 'cypress') {
      const osChild = await runOpenSearch(osDir, 180);
      if (!osChild) throw `Failed to run OpenSearch`;

      const ossChild = await runDashboards(osdDir, 600);
      if (!ossChild) throw `Failed to run OpenSearch Dashboards`;

      await handleCypressTests(testDir);
    }

    if (params.get('--test-type') === 'mocha') {
      killSubprocesses();
      await setTimeout(15000);
      await handleMochaTests(testDir, osDir, osdDir);
    }
  }

  await setTimeout(60000, 'Done');

  _verbose2('Ending...');
  process.exit(0);
};

run().catch(err => {
  _error('Error:', err);
  process.exit(1);
}).finally(() => killSubprocesses());

// Codcov token FTR: fff741ba-5df6-48f6-a4bd-dbd79b8a83e0
