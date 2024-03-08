import path from 'path';
import { _appendToFile, _changeInFile, _deleteFromFile, _download, _exec, _unarchive } from './utils.js';
import { mkdir, rm } from 'fs/promises';
import { existsSync, rmSync } from 'fs';
import { spawn } from 'child_process';
import { ARCH, EXTENSION, LOG_PROPS, params, PLATFORM, tmpDir, TYPE } from './params.js';
import os from 'os';
import { Agent, get } from 'https';
import { setTimeout } from 'timers/promises';
import { recordProcess } from './subprocess.js';
import { _error, _info, _notice, _ok } from './logging.js';


/** Download a release version of OpenSearch
 *
 * @param {string} version
 * @returns {Promise<{dest:string, version: string}>}
 */
export const downloadOpenSearch = async (version) => {
  const dest = path.join(tmpDir, `opensearch-${version}.${EXTENSION}`);
  const url = `https://ci.opensearch.org/ci/dbc/distribution-build-opensearch/${version}/latest/${PLATFORM}/${ARCH}/${TYPE}/dist/opensearch/opensearch-${version}-${PLATFORM}-${ARCH}.${EXTENSION}`;
  return {
    dest: await _download(url, dest),
    version: `${PLATFORM}-${ARCH}@${version}`,
  };
};

/** Configure certificates for OpenSearch
 * @param {string} folder
 * @returns {Promise<Object>}
 */
export const configureOpenSearchCerts = async (folder) => {
  const configDir = path.join(folder, 'config');
  const dest = path.join(configDir, 'config/certs');

  await rm(dest, { force: true, recursive: true });
  await mkdir(dest, { recursive: true });

  const rooCACert = path.join(dest, 'root-ca.pem');
  const rooCAKey = path.join(dest, 'root-ca-key.pem');
  const adminKeyTemp = path.join(dest, 'admin-key-temp.pem');
  const adminCSR = path.join(dest, 'admin.csr');
  const adminKey = path.join(dest, 'admin-key.pem');
  const adminCert = path.join(dest, 'admin.pem');
  const adminCertSubject = `/C=US/ST=WASHINGTON/L=SEATTLE/O=ORG/OU=UNIT/CN=A`;
  const nodeKeyTemp = path.join(dest, 'node-key-temp.pem');
  const nodeCSR = path.join(dest, 'node.csr');
  const nodeKey = path.join(dest, 'node-key.pem');
  const nodeCert = path.join(dest, 'node.pem');
  const nodeCertSubject = `/C=US/ST=WASHINGTON/L=SEATTLE/O=ORG/OU=UNIT/CN=N`;

  await _exec(`openssl genrsa -out ${rooCAKey} 2048`);
  await _exec(`openssl req -new -x509 -sha256 -key ${rooCAKey} -subj "/C=US/ST=WASHINGTON/L=SEATTLE/O=ORG/OU=UNIT/CN=ROOT" -out ${rooCACert} -days 30`);

  await _exec(`openssl genrsa -out ${adminKeyTemp} 2048`);
  await _exec(`openssl pkcs8 -inform PEM -outform PEM -in ${adminKeyTemp} -topk8 -nocrypt -v1 PBE-SHA1-3DES -out ${adminKey}`);
  await _exec(`openssl req -new -key ${adminKey} -subj "${adminCertSubject}" -out ${adminCSR}`);
  await _exec(`openssl x509 -req -in ${adminCSR} -CA ${rooCACert} -CAkey ${rooCAKey} -CAcreateserial -sha256 -out ${adminCert} -days 30`);

  await _exec(`openssl genrsa -out ${nodeKeyTemp} 2048`);
  await _exec(`openssl pkcs8 -inform PEM -outform PEM -in ${nodeKeyTemp} -topk8 -nocrypt -v1 PBE-SHA1-3DES -out ${nodeKey}`);
  await _exec(`openssl req -new -key ${nodeKey} -subj "${nodeCertSubject}" -out ${nodeCSR}`);
  await _exec(`openssl x509 -req -in ${nodeCSR} -CA ${rooCACert} -CAkey ${rooCAKey} -CAcreateserial -sha256 -out ${nodeCert} -days 30`);

  await Promise.all([
    rm(adminKeyTemp),
    rm(adminCSR),
    rm(nodeKeyTemp),
    rm(nodeCSR)
  ]);

  return {
    rooCACert: path.relative(configDir, rooCACert),
    rooCAKey: path.relative(configDir, rooCAKey),
    adminKey: path.relative(configDir, adminKey),
    adminCert: path.relative(configDir, adminCert),
    adminCertSubject: adminCertSubject
      .replace(/\//g, ',')
      .replace(/^,+/, ''),
    nodeKey: path.relative(configDir, nodeKey),
    nodeCert: path.relative(configDir, nodeCert),
    nodeCertSubject: nodeCertSubject
      .replace(/\//g, ',')
      .replace(/^,+/, ''),
  };
};

/** Configure OpenSearch
 *
 * @param {string} folder
 * @returns {Promise<void>}
 */
export const configureOpenSearch = async (folder) => {
  _info(`Configuring OpenSearch in ${folder} ...`);
  const configFile = path.join(folder, 'config/opensearch.yml');
  const certs = await configureOpenSearchCerts(folder);
  await _deleteFromFile(configFile, ['network.host', 'discovery.type', 'cluster.routing.allocation.disk.threshold_enabled']);

  const configParams = [
    'network.host: 0.0.0.0',
    'discovery.type: single-node',
    'cluster.routing.allocation.disk.threshold_enabled: false',
  ];

  if (existsSync(path.join(folder, 'plugins/opensearch-security'))) {
    configParams.push(
      `plugins.security.ssl.transport.pemcert_filepath: ${certs.nodeCert}`,
      `plugins.security.ssl.transport.pemkey_filepath: ${certs.nodeKey}`,
      `plugins.security.ssl.transport.pemtrustedcas_filepath: ${certs.rooCACert}`,
      `plugins.security.ssl.transport.enforce_hostname_verification: false`,
      `plugins.security.ssl.http.enabled: true`,
      `plugins.security.ssl.http.pemcert_filepath: ${certs.nodeCert}`,
      `plugins.security.ssl.http.pemkey_filepath: ${certs.nodeKey}`,
      `plugins.security.ssl.http.pemtrustedcas_filepath: ${certs.rooCACert}`,
      `plugins.security.allow_default_init_securityindex: true`,
      `plugins.security.authcz.admin_dn:`,
      `  - '${certs.adminCertSubject}'`,
      `plugins.security.nodes_dn:`,
      `  - '${certs.nodeCertSubject}'`,
      `plugins.security.audit.type: internal_opensearch`,
      `plugins.security.enable_snapshot_restore_privilege: true`,
      `plugins.security.check_snapshot_restore_write_privileges: true`,
      `plugins.security.restapi.roles_enabled: ["all_access", "security_rest_api_access"]`,
    );

    if (params.has('--disable-security')) {
      configParams.push(`plugins.security.disabled: true`);
    }
  }

  if (existsSync(path.join(folder, 'plugins/opensearch-index-management'))) {
    configParams.push(`path.repo: [${os.tmpdir()}]`);
  }

  if (existsSync(path.join(folder, 'plugins/opensearch-alerting'))) {
    configParams.push('plugins.destination.host.deny_list: ["10.0.0.0/8", "127.0.0.1"]');
  }

  if (existsSync(path.join(folder, 'plugins/opensearch-sql'))) {
    configParams.push('script.context.field.max_compilations_rate: 1000/1m');
  }

  if (existsSync(path.join(folder, 'plugins/opensearch-performance-analyzer'))) {
    await _appendToFile(path.join(folder, 'config/opensearch-performance-analyzer/performance-analyzer.properties'), 'webservice-bind-host = 0.0.0.0');
  }

  await _appendToFile(configFile, configParams);

  const totalMemory = os.totalmem() / (1024 * 1024 * 1024);
  // Giving JVM 50% of the RAM
  const jvmMemory = Math.max(Math.floor(totalMemory / 2), 4);

  _notice(`Configuring OpenSearch to use ${jvmMemory}GB of memory`);
  await _changeInFile(path.join(folder, 'config/jvm.options'), {
    '-Xms1g': `-Xms${jvmMemory}g`,
    '-Xmx1g': `-Xmx${jvmMemory}g`,
  });
};

/** Check OpenSearch health
 * @returns {Promise<boolean|undefined>}
 */
export const checkOpenSearchHealth = async () => {
  try {
    let status;
    if (params.has('--disable-security')) {
      const response = await fetch('http://localhost:9200/_cluster/health');

      const contentType = response?.headers?.get?.('content-type');
      if (!contentType.includes('application/json')) return;

      const json = await response.json();
      status = json?.status;
    } else {
      const agent = new Agent({
        rejectUnauthorized: false,
      });

      const json = await new Promise((resolve, reject) => {
        get('https://localhost:9200/_cluster/health', {
          headers: {
            Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}`
          },
          agent
        }, response => {
          if (response.statusCode !== 200)
            return reject(response.statusCode);

          const contentType = response.headers?.['content-type'];
          if (!contentType?.includes('application/json')) return reject(contentType);

          const content = [];
          response.on('data', chunk => content.push(chunk));
          response.on('end', () => resolve(JSON.parse(content.join(''))));
        }).on('error', err => {
          reject(err);
        });
      });

      status = json?.status;
    }

    if (['green', 'yellow'].includes(status)) {
      _ok(`\n\nOpenSearch is ${status}\n`);
      return true;
    }

    _error(`\n\nOpenSearch is ${status}\n`);
    return false;
  } catch (ex) {
  }
};

/** Run OpenSearch
 *
 * @param {string} folder
 * @param {number} timeoutSeconds
 * @returns {Promise<ChildProcess|undefined>}
 */
export const runOpenSearch = async (folder, timeoutSeconds) => {
  const executable = process.platform === 'win32' ? 'opensearch.bat' : 'opensearch';
  const child =
    spawn(path.join(folder, 'bin', executable), {
      cwd: folder,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .on('close', code => {
        _error(`\n\nOpenSearch closed with ${code}.\n`);
      });

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  const timerStart = Date.now();
  do {
    const tryStart = Date.now();
    if (await checkOpenSearchHealth()) {
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
      _error(`\n\nTimeout waiting for OpenSearch to stabilize\n`);
      return;
    }

    _notice(`\n\nWaiting for OpenSearch to stabilize (${Math.floor((timeoutSeconds * 1e3 - Date.now() + timerStart) / 1e3)}s)\n`);
    await setTimeout(5000 - Date.now() + tryStart);
  } while (true);
};

/** Prepare OpenSearch
 *
 * @returns {Promise<string>}
 */
export const prepareOpenSearch = async () => {
  _info(`Preparing OpenSearch...`);

  const startTime = Date.now();
  let osDir = params.get('--use-opensearch');
  if (osDir) {
    if (!existsSync(osDir))
      throw `Path doesn't point to OpenSearch: ${osDir}`;
  } else {
    const version = params.get('--opensearch-version');
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw `Use '--opensearch-version' to provide a valid release version for OpenSearch`;

    osDir = path.join(tmpDir, `OpenSearch-${version}`);

    const { dest: archive, version: downloadedVersion } = await downloadOpenSearch(version);
    LOG_PROPS.version['opensearch'] = downloadedVersion;
    _unarchive(archive, osDir);
    rmSync(archive, { force: true });
    await configureOpenSearch(osDir);

    _ok(`OpenSearch took ${Math.round((Date.now() - startTime) / 1000)}s to prepare.`);
  }

  return osDir;
};