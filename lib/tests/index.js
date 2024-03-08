import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { _exec, _spawn } from '../utils.js';
import { existsSync } from 'fs';
import {
  patchDashboardsCodeOverage,
  patchDashboardsFunctionalTests,
  patchDashboardsPlugins,
  patchTestCodeOverage
} from '../dashboards.js';
import { dashboardsPlugins, params, tmpDir } from '../params.js';
import { _info } from '../logging.js';

export * from './cypress.js';
export * from './mocha.js';

const testSources = {
  functional: 'git://opensearch-project/opensearch-dashboards-functional-test/2.12',
  dashboards: 'git://opensearch-project/OpenSearch-Dashboards/2.12',
  plugins: dashboardsPlugins
};

/**
 * @returns {Promise<{dest:string, versions: Object.<string, string>}>}
 */
export const prepareTests = async () => {
  let testDir = params.get('--use-tests');
  const versions = {};
  if (testDir) {
    if (!existsSync(testDir))
      throw `Path doesn't point to Tests: ${testDir}`;
  } else {
    testDir = path.join(tmpDir, 'Tests');
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });

    const { plugins: pluginTestSources, ...mainTestSources } = testSources;
    for (const key of Object.keys(mainTestSources)) {
      const version = params.get(`--${key}-test-version`)?.startsWith?.('git://')
        ? params.get(`--${key}-test-version`)
        : mainTestSources[key];
      const [, , user, repo, branch] = version.split('/');
      const testDest = path.join(testDir, key);

      _info(`Cloning ${key} tests from ${version}`);

      await _spawn(`git clone https://github.com/${user}/${repo}.git --depth 1 --branch ${branch} -- ${testDest}`);
      const clonedHash = await _exec('git log --pretty=format:\'%h\' -n 1', {
        cwd: testDest,
      });
      versions[`${key}-test`] = `git://${user}/${repo}/${branch}@${clonedHash.trim()}`;

      if (key === 'functional') {
        await patchTestCodeOverage(testDest);
      }
      if (key !== 'dashboards' && existsSync(path.join(testDest, 'package-lock.json'))) {
        await _spawn('npm i', { cwd: testDest, maxBuffer: 100 * 1024 * 1024 });
      }
    }

    const dashboardsTestDir = path.join(testDir, 'dashboards');

    for (const key of Object.keys(pluginTestSources)) {
      const version = params.get(`--${key}-test-version`)?.startsWith?.('git://')
        ? params.get(`--${key}-test-version`)
        : pluginTestSources[key];
      const [, , user, repo, branch] = version.split('/');
      const testDest = path.join(dashboardsTestDir, 'plugins', key);

      _info(`Cloning ${key} plugin tests from ${version}`);

      await _spawn(`git clone https://github.com/${user}/${repo}.git --depth 1 --branch ${branch} -- ${testDest}`);
      const clonedHash = await _exec('git log --pretty=format:\'%h\' -n 1', {
        cwd: testDest,
      });
      versions[`${key}-test`] = `git://${user}/${repo}/${branch}@${clonedHash.trim()}`;
    }

    await patchDashboardsPlugins(dashboardsTestDir);
    await patchDashboardsFunctionalTests(dashboardsTestDir);
    await patchDashboardsCodeOverage(dashboardsTestDir);

    await _spawn('node scripts/upgrade_chromedriver.js', { cwd: dashboardsTestDir });
    await _spawn('yarn osd bootstrap --single-version=loose', { cwd: dashboardsTestDir });

    if (!params.has('--parallel')) {
      _info(`Building Platform Plugins in ${dashboardsTestDir}`);
      await _spawn('node scripts/build_opensearch_dashboards_platform_plugins --no-examples --workers 10', { cwd: dashboardsTestDir });
      _info(`Building Test Platform Plugins in ${dashboardsTestDir}`);
      await _spawn('node scripts/build_opensearch_dashboards_platform_plugins --no-examples --workers 10 --scan-dir "./test/plugin_functional/plugins"', { cwd: dashboardsTestDir });
    }
  }

  return {
    dest: testDir,
    versions,
  };
};
