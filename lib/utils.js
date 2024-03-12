import { createReadStream, createWriteStream, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { access, appendFile, constants, rename, rm } from 'fs/promises';
import { once } from 'events';
import { createInterface } from 'readline';
import { exec, execSync, spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import { get } from 'https';
import { _info, _verbose, _warning } from './logging.js';

/** Download a URL to a destination
 *
 * @param {string | URL} url
 * @param {string} dest
 * @returns {Promise<string>}
 */
export const _download = (url, dest) => {
  return new Promise((resolve, reject) => {
    rmSync(dest, { force: true, recursive: true });

    get(url, response => {
      if (response.statusCode < 200 || response.statusCode >= 400) {
        return reject(`Download failed with ${response.statusCode}: ${response.statusMessage}`);
      }

      if (response.statusCode > 300) {
        if (response.headers.location) {
          _verbose(`Redirected from ${url}`);
          const newURL = new URL(response.headers.location, url);
          return _download(newURL, dest)
            .then(resolve)
            .catch(reject);
        }

        return reject(`Download failed with ${response.statusCode}: ${response.statusMessage}`);
      }

      // 200
      _info(`Downloading ${url}`);
      const fs =
        createWriteStream(dest, { flags: 'wx' })
          .on('finish', () => resolve(dest))
          .on('error', err => {
            reject(err.message);
          });

      response.pipe(fs);
    }).on('error', err => {
      reject(err.message);
    });
  });
};

/** Synchronously execute a command
 *
 * @param {string} command
 * @param {Object} options
 * @returns {string|undefined}
 */
export const _execSync = (command, options = {}) => {
  try {
    return execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, ...options });
  } catch (ex) {
    throw `${ex}`;
  }
};

/** Asynchronously execute a command
 *
 * @param {string} command
 * @param {Object.<string, any>} options
 * @returns {Promise<string>}
 */
export const _exec = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 10 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
      if (err) {
        _warning('exec-stderr:', stderr);
        return reject(err);
      }

      resolve(stdout);
    });
  });
};

/** Asynchronously spawn a process
 *
 * @param {string|string[]} parts
 * @param {Object.<string, any>} options
 * @returns {Promise<string>}
 */
export const _spawn = (parts, options = {}) => {
  return new Promise((resolve, reject) => {
    const [command, ...rest] = Array.isArray(parts) ? parts : parts.split(' ');
    const child = spawn(command, rest, { stdio: ['ignore', 'inherit', 'inherit'], ...options });
    child.on('close', code => {
      if (code === 0) return resolve();
      reject(code);
    });
  });
};

export const _spawnRetry = async (parts, options, tries) => {
  let _tryCount = 0;
  while (true) {
    try {
      await _spawn(parts, options);
      break;
    } catch (ex) {
      if (++_tryCount < tries) {
        _warning(`Try ${_tryCount} failed; will retry...`);
        await setTimeout(30000);
      } else {
        throw ex;
      }
    }
  }
}

/** Delete lines containing texts from a file
 *
 * @param {string} file
 * @param {string|string[]} texts
 */
export const _deleteFromFile = async (file, texts) => {
  await access(file, constants.R_OK | constants.W_OK);

  await rm(`${file}.swap`, { force: true });
  const writer = createWriteStream(`${file}.swap`, { encoding: 'utf8', flags: 'w' });

  const strings = Array.isArray(texts) ? texts : [texts];

  const reader = createInterface({
    input: createReadStream(file, 'utf8'),
    crlfDelay: Infinity,
  });

  reader.on('line', (line) => {
    if (!strings.some(str => line.includes(str))) {
      writer.write(line + '\n', 'utf8');
    }
  });

  reader.on('close', () => {
    writer.end();
  });

  await once(writer, 'finish');

  await rename(file, `${file}.bak`);
  await rename(`${file}.swap`, file);
};

/** Find lines than contain texts and replace them
 *
 * @param {string} file
 * @param {Object<string, string>} texts
 */
export const _changeInFile = async (file, texts) => {
  await access(file, constants.R_OK | constants.W_OK);

  await rm(`${file}.swap`, { force: true });
  const writer = createWriteStream(`${file}.swap`, { encoding: 'utf8', flags: 'w' });

  const keys = Object.keys(texts);
  let changed = false;

  const reader = createInterface({
    input: createReadStream(file, 'utf8'),
    crlfDelay: Infinity,
  });

  reader.on('line', (line) => {
    let content = line;
    for (const key of keys) {
      if (line.includes(key)) {
        content = texts[key];
        changed = true;
        break;
      }
    }

    writer.write(content + '\n', 'utf8');
  });

  reader.on('close', () => {
    writer.end();
  });

  await once(writer, 'finish');

  await rename(file, `${file}.bak`);
  await rename(`${file}.swap`, file);

  return changed;
};

/** Append texts to a file
 *
 * @param {string} file
 * @param {string|string[]} texts
 */
export const _appendToFile = async (file, texts) => {
  return appendFile(file, '\n' + (Array.isArray(texts) ? texts.join('\n') : texts) + '\n', 'utf8');
};

/** Unarchive an archive to a destination
 *
 * @param {string} archive
 * @param {string} dest
 * @returns {void}
 */
export const _unarchive = (archive, dest) => {
  _info(`Unarchiving ${archive} to ${dest}`);

  rmSync(dest, { force: true, recursive: true });
  mkdirSync(dest, { recursive: true });

  if (process.platform === 'win32') {
    _execSync(`Expand-Archive -Path ${archive} -DestinationPath ${dest}`, { shell: 'powershell.exe' });
  } else {
    if (path.extname(archive) === '.zip') {
      _execSync(`unzip ${archive} -d ${dest}`);
    } else {
      _execSync(`tar -xz --strip-components=1 -f ${archive} --directory ${dest}`);
    }
  }
};