import path from 'path';
import { copyFile, mkdir, readdir, readFile, rename, rm } from 'fs/promises';
import { _appendToFile, _changeInFile, _deleteFromFile, _download, _exec, _spawn, _unarchive } from './utils.js';
import { spawn } from 'child_process';
import { existsSync, rmSync } from 'fs';
import {
  ARCH,
  dashboardsDefault,
  dashboardsPlugins,
  EXTENSION,
  LOG_PROPS,
  params,
  PLATFORM,
  tmpDir,
  TYPE
} from './params.js';
import { setTimeout } from 'timers/promises';
import { recordProcess } from './subprocess.js';
import { _error, _info, _notice, _ok, _verbose } from './logging.js';

/** Download a release or GitHub version of OpenSearch Dashboards
 *
 * @param {string} version
 * @returns {Promise<{dest:string, versions: Object.<string, string>}>}
 */
export const downloadDashboards = async (version) => {
  const versions = {};
  if (version.startsWith('git://')) {
    const dest = path.join(tmpDir, version.replace(/[:\/ ]+/g, '-'));
    await rm(dest, { force: true, recursive: true });
    const [, , user, repo, branch] = version.split('/');
    const dashboardsBranch = /^\d+\.(x|\d+)$/.test(branch) ? branch : undefined;

    _info(`Cloning OpenSearch Dashboards from ${version}`);
    await _spawn(`git clone https://github.com/${user}/${repo}.git --depth 1 --branch ${branch} -- ${dest}`);
    const clonedHash = await _exec('git log --pretty=format:\'%h\' -n 1', {
      cwd: dest,
    });
    versions.dashboards = {
      src: `git://${user}/${repo}/${branch}`,
      version: clonedHash.trim(),
    };

    if (!params.has('--no-plugins')) {
      for (const key in dashboardsPlugins) {
        if (!dashboardsPlugins.hasOwnProperty(key)) continue;

        const pluginDest = path.join(dest, 'plugins', key);
        const [, , user, repo, branch] =
          (params.get(`--${key}-version`) || dashboardsPlugins[key].replace(/\/[^\/]+$/, `/${dashboardsBranch}`))
            .split('/');
        _info(`Cloning ${key} from git://${user}/${repo}/${branch}`);
        await _spawn(`git clone https://github.com/${user}/${repo}.git --depth 1 --branch ${branch} -- ${pluginDest}`);
        const clonedHash = await _exec('git log --pretty=format:\'%h\' -n 1', {
          cwd: pluginDest,
        });
        versions[key] = {
          src: `git://${user}/${repo}/${dashboardsBranch || branch}`,
          version: clonedHash.trim(),
        };
      }
    }

    return {
      dest,
      versions,
    };
  }

  const dest = path.join(tmpDir, `dashboards-${version}.${EXTENSION}`);
  const url = /^1\.[0-2]\./.test(version)
    ? `https://artifacts.opensearch.org/releases/bundle/opensearch-dashboards/${version}/opensearch-dashboards-${version}-${PLATFORM}-${ARCH}.${EXTENSION}`
    : `https://ci.opensearch.org/ci/dbc/distribution-build-opensearch-dashboards/${version}/latest/${PLATFORM}/${ARCH}/${TYPE}/dist/opensearch-dashboards/opensearch-dashboards-${version}-${PLATFORM}-${ARCH}.${EXTENSION}`;

  versions.dashboards = { src: version, version: 'Release' };
  for (const key in dashboardsPlugins) {
    versions[key] = versions.dashboards;
  }

  return {
    dest: await _download(url, dest),
    versions,
  };
};

/** Build plugins
 *
 * @param {string} folder
 * @param {string} buildDir
 */
const buildPlugins = async (folder, buildDir) => {
  const pluginsDir = path.join(folder, 'plugins');
  const pluginContent = await readdir(pluginsDir, { withFileTypes: true, encoding: 'utf8' });
  for (const item of pluginContent) {
    if (item.isDirectory()) {
      await _exec(`node ../../scripts/plugin_helpers.js version --sync legacy`, { cwd: path.join(pluginsDir, item.name) });
    }
  }

  await _spawn('yarn osd bootstrap --single-version=loose', { cwd: folder, maxBuffer: 100 * 1024 * 1024 });
  const buildType = '--' + PLATFORM + (process.platform !== 'win32' && process.arch === 'arm64' ? '-arm' : '');
  await _spawn(`yarn build-platform ${buildType} --release --skip-archives --skip-os-packages`, { cwd: folder });

  const pluginBuildDestDir = path.join(buildDir, 'plugins');

  const pluginBuilds = [];
  for (const item of pluginContent) {
    if (item.isDirectory()) {
      pluginBuilds.push(buildPlugin(item.name, pluginsDir, pluginBuildDestDir));

    }
  }

  await Promise.all(pluginBuilds);
};

/** Build plugin
 * @param {string} name
 * @param {string} pluginsDir
 * @param {string} pluginBuildDestDir
 */
export const buildPlugin = async (name, pluginsDir, pluginBuildDestDir) => {
  const pluginFolder = path.join(pluginsDir, name);
  _info(`Building plugin in ${pluginFolder}`);
  try {
    await _exec(`node ../../scripts/plugin_helpers.js build --skip-archive`, { cwd: pluginFolder });
    const pluginBuildDir = path.join(pluginsDir, name, 'build/opensearch-dashboards');
    const pluginBuiltContent = await readdir(pluginBuildDir, { withFileTypes: true, encoding: 'utf8' });
    for (const pluginBuiltItem of pluginBuiltContent) {
      if (pluginBuiltItem.isDirectory()) {
        await rename(path.join(pluginBuildDir, pluginBuiltItem.name), path.join(pluginBuildDestDir, pluginBuiltItem.name));
      }
    }
  } catch (ex) {
    _error(`Failed to build ${name} in ${pluginFolder}`);
    _verbose(ex);
  }
};

/** Build OpenSearch Dashboards and plugins
 *
 * @param {string} folder
 * @returns {Promise<string>} Build directory location
 */
export const buildDashboards = async (folder) => {
  _info(`Building OpenSearch Dashboards in ${folder}`);
  const buildVersion = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8')).version;
  const buildDir = path.join(folder, 'build', `opensearch-dashboards-${buildVersion}-${PLATFORM}-${process.arch}`);

  await _spawn('yarn osd bootstrap --single-version=loose --skip-opensearch-dashboards-plugins', {
    cwd: folder,
    maxBuffer: 100 * 1024 * 1024
  });

  await buildPlugins(folder, buildDir);

  return buildDir;
};

/** Patch OpenSearch Dashboards plugins
 *
 * @param {string} folder
 */
export const patchDashboardsPlugins = async (folder) => {
  if (!params.has('--no-plugins')) {
    // maps: @opensearch-dashboards-test/opensearch-dashboards-test-library
    await _changeInFile(path.join(folder, 'plugins/maps/package.json'), {
      '"@opensearch-dashboards-test/opensearch-dashboards-test-library"': '"@opensearch-dashboards-test/opensearch-dashboards-test-library": "https://github.com/opensearch-project/opensearch-dashboards-test-library/archive/refs/tags/1.0.6.tar.gz",'
    });

    // reporting: jsdom
    await _deleteFromFile(path.join(folder, 'plugins/reporting/package.json'), '"jsdom":');
  }
  // osd
  await _changeInFile(path.join(folder, 'src/dev/build/tasks/build_opensearch_dashboards_platform_plugins.ts'), {
    'import { REPO_ROOT } from \'@osd/utils\';': 'import { resolve } from "path";import { REPO_ROOT } from \'@osd/utils\';\n',
    'repoRoot: REPO_ROOT,': 'repoRoot: REPO_ROOT,pluginScanDirs: [resolve(REPO_ROOT, "src/plugins")],',
  });
};

/** Patch OpenSearch Dashboards for code coverage
 *
 * @param {string} folder
 */
export const patchDashboardsCodeOverage = async (folder) => {
  if (1) return _notice(`Skipping code coverage patching in ${folder}`);

  await _changeInFile(path.join(folder, 'package.json'), {
    '"devDependencies":': `"devDependencies": {\n"babel-plugin-istanbul": "^6.1.1",\n"@cypress/code-coverage": "^3.12.28",\n"nyc": "^15.1.0",\n"istanbul-lib-coverage": "^3.2.2",`
  });

  await _changeInFile(path.join(folder, 'packages/osd-babel-preset/common_preset.js'), {
    'const plugins = [': `const plugins = [\n['istanbul', {exclude: ['**/public/framework/redux/store/**']}],`
  });
};

/** Patch test for code coverage
 *
 * @param {string} folder
 */
export const patchTestCodeOverage = async (folder) => {
  if (1) return _notice(`Skipping code coverage patching in ${folder}`);

  await _changeInFile(path.join(folder, 'package.json'), {
    '"devDependencies":': `"devDependencies": {\n"babel-plugin-istanbul": "^6.1.1",\n"@cypress/code-coverage": "^3.12.28",\n"nyc": "^15.1.0",\n"istanbul-lib-coverage": "^3.2.2",`
  });
};

/** Patch function tests in OpenSearch Dashboards
 *
 * @param {string} folder
 */
export const patchDashboardsFunctionalTests = async (folder) => {
  const depChanges = {
    '"devDependencies":': `"devDependencies": {\n"mochawesome": "^7.1.3",`
  };

  if (params.get('--test-type') === 'mocha' && params.get('--group') === '0') {
    depChanges['"dependencies":'] = `"dependencies": {\n"@babel/preset-env": "^7.22.9",`;
  }

  await _changeInFile(path.join(folder, 'package.json'), depChanges);

  await _changeInFile(path.join(folder, 'packages/osd-test/src/functional_test_runner/lib/mocha/setup_mocha.js'), {
    'reporter:': `reporter: 'mochawesome',\nreporterOptions: { reportDir: 'mochawesome/results', overwrite: false, html: false, json: true },`
  });
};

/** Patch OpenSearch Dashboards to ignore version mismatch
 *
 * @param {string} folder
 * @returns {Promise<void>}
 */
export const patchDashboardsIgnoreVersionMismatch = async (folder) => {
  await _deleteFromFile(
    path.join(folder, 'src/core/server/opensearch/opensearch_config.js'),
    '"ignoreVersionMismatch" can only be set to true in development mode'
  );
};

/** Patch OpenSearch Dashboards binary files
 *
 * @param {string} folder
 * @returns {Promise<void>}
 */
export const patchDashboardsBinary = async (folder) => {
  await copyFile(
    path.join(folder, 'bin/opensearch-dashboards' + (process.platform === 'win32' ? '.bat' : '')),
    path.join(folder, 'bin/opensearch_dashboards' + (process.platform === 'win32' ? '.bat' : '')),
  );
};

/** Configure OpenSearch Dashboards
 *
 * @param {string} folder
 * @returns {Promise<void>}
 */
export const configureDashboards = async (folder) => {
  const configFile = path.join(folder, 'config/opensearch_dashboards.yml');

  const linesToDelete = [
    'server.host',
    'opensearch.ssl.verificationMode',
    'opensearch.ignoreVersionMismatch',
    'opensearch.hosts',
    'opensearch.username',
    'opensearch.password',
  ];
  if (params.has('--disable-security'))
    linesToDelete.push('opensearch_security.');
  await _deleteFromFile(configFile, linesToDelete);

  const configParams = [
    'server.host: 0.0.0.0',
    'opensearch.ssl.verificationMode: none',
    'opensearch.ignoreVersionMismatch: true',
    'savedObjects.maxImportPayloadBytes: 10485760',
    'server.maxPayloadBytes: 1759977',
    'logging.json: false',
    'data.search.aggs.shardDelay.enabled: true',
    'csp.warnLegacyBrowsers: false',
  ];

  if (params.has('--no-plugins')) {
    configParams.push('opensearch.hosts: ["http://localhost:9200"]');
    await rm(path.join(folder, 'plugins'), { force: true, recursive: true });
    await mkdir(path.join(folder, 'plugins'), { recursive: true });
  } else if (params.has('--disable-security')) {
    configParams.push('opensearch.hosts: ["http://localhost:9200"]');
    await rm(path.join(folder, 'plugins/securityDashboards'), { force: true, recursive: true });
  } else {
    configParams.push(
      'opensearch.hosts: ["https://localhost:9200"]',
      'opensearch.username: "admin"',
      'opensearch.password: "admin"',
    );
  }

  await _appendToFile(configFile, configParams);
};

/** Check OpenSearch Dashboards health
 *
 * @returns {Promise<boolean|undefined>}
 */
export const checkDashboardsHealth = async () => {
  try {
    const opts = params.has('--disable-security')
      ? {}
      : {
        headers: {
          Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}`
        }
      };
    const response = await fetch('http://localhost:5601/api/status', opts);
    const contentType = response?.headers?.get?.('content-type');
    if (!contentType.includes('application/json')) return;

    const json = await response.json();
    if (json?.status?.overall?.state === 'green') {
      _ok(`OpenSearch Dashboards is ${json?.status?.overall?.state}`);
    } else {
      _error(`OpenSearch Dashboards is ${json?.status?.overall?.state}`);
    }

    return json?.status?.overall?.state === 'green';
  } catch (ex) {
  }
};

/** Run OpenSearch Dashboards
 *
 * @param {string} folder
 * @param {number} timeoutSeconds
 * @returns {Promise<ChildProcess|undefined>}
 */
export const runDashboards = async (folder, timeoutSeconds) => {
  const executable = process.platform === 'win32' ? 'opensearch-dashboards.bat' : 'opensearch-dashboards';
  const child =
    spawn(path.join(folder, 'bin', executable), {
      cwd: folder,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .on('close', code => {
        _error(`\n\nOpenSearch Dashboards closed with ${code}.\n`);
      });

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  const timerStart = Date.now();
  do {
    const tryStart = Date.now();
    if (await checkDashboardsHealth()) {
      if (params.has('--less-logs')) {
        child.stdout.unpipe(process.stdout);
        child.stderr.unpipe(process.stderr);
      }
      recordProcess(child);
      return child;
    }

    if (Date.now() - timerStart > timeoutSeconds * 1e3) {
      child.kill('SIGTERM');
      child.unref();
      return;
    }

    _notice(`\n\nWaiting for OpenSearch Dashboards to stabilize (${Math.floor((timeoutSeconds * 1e3 - Date.now() + timerStart) / 1e3)}s)\n`);
    await setTimeout(5000 - Date.now() + tryStart);
  } while (true);
};

/** Prepare OpenSearch Dashboards
 *
 * @returns {Promise<string>}
 */
export const prepareDashboards = async () => {
  _info(`Preparing OpenSearch Dashboards ...`);

  const startTime = Date.now();
  let osdDir = params.get('--use-dashboards');
  if (osdDir) {
    if (!existsSync(osdDir))
      throw `Path doesn't point to OpenSearch Dashboards: ${osdDir}`;
  } else {
    const version = params.get('--dashboards-version') || dashboardsDefault;
    if (!/^\d+\.\d+\.\d+$/.test(version) && !/^git:\/\/[^\/]+\/[^\/]+\/[^\/]+$/.test(version))
      throw `Use '--dashboards-version' to provide a valid release version for OpenSearch Dashboards`;

    osdDir = path.join(tmpDir, `Dashboards-${version.replace(/[:\/]+/g, '-')}`);

    if (version.startsWith('git://')) {
      const { dest: gitDir, versions: downloadedVersions } = await downloadDashboards(version);
      for (const key of Object.keys(downloadedVersions))
        LOG_PROPS.package[key] = downloadedVersions[key];
      await patchDashboardsPlugins(gitDir);
      await patchDashboardsCodeOverage(gitDir);
      _info(`Building OpenSearch Dashboards in ${gitDir}`);
      const buildDir = await buildDashboards(gitDir);
      await rm(osdDir, { force: true, recursive: true });
      await rename(buildDir, osdDir);
    } else {
      const { dest: archive, versions: downloadedVersions } = await downloadDashboards(version);
      for (const key of Object.keys(downloadedVersions))
        LOG_PROPS.package[key] = downloadedVersions[key];
      _unarchive(archive, osdDir);
      rmSync(archive, { force: true });
    }

    await configureDashboards(osdDir);
    await patchDashboardsBinary(osdDir);
    await patchDashboardsIgnoreVersionMismatch(osdDir);

    _ok(`OpenSearch Dashboards took ${Math.round((Date.now() - startTime) / 1000)}s to prepare.`);
  }

  return osdDir;
};