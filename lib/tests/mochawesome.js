import path from 'path';
import { fileURLToPath } from 'url';
import { readdir, readFile } from 'fs/promises';
import { LOG_PROPS } from '../params.js';
import { addResultDoc, addSummaryDoc } from '../data.js';
import { _error, _info } from '../logging.js';

export const processMochAwesomeResult = json => {
  const result = [];
  if (Array.isArray(json.suites)) {
    for (const suite of json.suites) {
      result.push(...processMochAwesomeResult(suite));
    }
  }
  if (Array.isArray(json.tests)) {
    json.tests.forEach(test => {
      result.push({
        title: test.fullTitle,
        state: test.state,
        duration: test.duration,
        error: test.err?.estack || test.err?.message || null,
      });
    });
  }

  return result;
};

export const processMochAwesomeResults = async (sourceLabel, folder, testRoot, ref, timestamp) => {
  _info(`Processing test results for ${folder}`)
  const resultDir = path.join(folder, 'mochawesome/results');
  const resultContent = await readdir(resultDir, { encoding: 'utf8' });
  for (const item of resultContent) {
    const { results: runs } = JSON.parse(await readFile(path.join(resultDir, item), 'utf8'));
    for (const run of runs) {
      if (run === false) continue;
      const results = processMochAwesomeResult(run);
      const count = { passed: 0, failed: 0, pending: 0, skipped: 0 };
      results.forEach(result => count[result.state]++);
      const specFile = path.relative(testRoot, path.join(folder, run.fullFile));
      const doc = {
        spec: specFile,
        results,
        count,
        ...LOG_PROPS,
        timestamp,
        ref: ref,
        src: sourceLabel,
      };

      let indexErrors = 1;

      do {
        try {
          await addSummaryDoc(doc);
          break;
        } catch (ex) {
          _error(`Failed to index (${indexErrors}/3)`, doc);
        }
      } while (indexErrors++ < 3);

      for (const result of results) {
        const doc = {
          spec: specFile,
          ...result,
          ...LOG_PROPS,
          timestamp,
          ref: ref,
          src: sourceLabel,
        };

        let indexErrors = 1;

        do {
          try {
            await addResultDoc(doc);
            break;
          } catch (ex) {
            _error(`Failed to index (${indexErrors}/3)`, doc);
          }
        } while (indexErrors++ < 3);
      }
    }
  }
};

export const getReporter = () => {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/mochawesome');
};