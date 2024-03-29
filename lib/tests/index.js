import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { _exec, _spawn, _spawnRetry } from '../utils.js';
import { existsSync } from 'fs';
import {
  patchDashboardsCodeOverage,
  patchDashboardsFunctionalTests,
  patchDashboardsPlugins,
  patchTestCodeOverage
} from '../dashboards.js';
import { dashboardsDefault, dashboardsPlugins, params, tmpDir } from '../params.js';
import { _info } from '../logging.js';

export * from './cypress.js';
export * from './mocha.js';

const testSources = {
  functional: 'git://opensearch-project/opensearch-dashboards-functional-test/2.x',
  dashboards: dashboardsDefault,
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
      versions[`${key}-test`] = {
        src: `git://${user}/${repo}/${branch}`,
        version: clonedHash.trim(),
      };

      if (key === 'functional') {
        await patchTestCodeOverage(testDest);
        if (params.has(`--no-plugins`)) {
          _info(`Removing plugins from ${testDest}`);
          await rm(path.join(testDest, 'cypress/integration/plugins'), { force: true, recursive: true });
        }
      }
      if (key !== 'dashboards' && existsSync(path.join(testDest, 'package-lock.json'))) {
        _info(`Installing NPM dependencies in ${testDest}`);
        await _spawnRetry('npm i', { cwd: testDest, maxBuffer: 100 * 1024 * 1024 }, 5);
      }
    }

    const dashboardsTestDir = path.join(testDir, 'dashboards');

    if (params.has(`--no-plugins`)) {
      _info(`Removing plugins from ${dashboardsTestDir}`);
      await rm(path.join(dashboardsTestDir, 'plugins'), { force: true, recursive: true });
      await mkdir(path.join(dashboardsTestDir, 'plugins'), { recursive: true });
    } else {
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
        versions[`${key}-test`] = {
          src: `git://${user}/${repo}/${branch}`,
          version: clonedHash.trim(),
        };
      }

      await patchDashboardsPlugins(dashboardsTestDir);
    }

    await patchDashboardsFunctionalTests(dashboardsTestDir);
    await patchDashboardsCodeOverage(dashboardsTestDir);

    await _spawnRetry('node scripts/upgrade_chromedriver.js', { cwd: dashboardsTestDir }, 5);
    await _spawnRetry('yarn osd bootstrap --single-version=loose', { cwd: dashboardsTestDir }, 5);

    if (!params.has('--parallel') && params.get('--test-type') === 'mocha') {
      if (params.get('--group') === '0') {
        _info(`Building Test Platform Plugins in ${dashboardsTestDir}`);
        await _spawn('node scripts/build_opensearch_dashboards_platform_plugins --no-examples --workers 10 --scan-dir "./test/plugin_functional/plugins"', { cwd: dashboardsTestDir });
      } else {
        _info(`Building Platform Plugins in ${dashboardsTestDir}`);
        await _spawn('node scripts/build_opensearch_dashboards_platform_plugins --no-examples --workers 10', { cwd: dashboardsTestDir });
      }
    }
  }

  return {
    dest: testDir,
    versions,
  };
};
