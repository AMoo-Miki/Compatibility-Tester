import { _exec } from './utils.js';
import { setTimeout } from 'timers/promises';
import { _error, _ok, _verbose, _verbose2 } from './logging.js';

export const PARALLEL_COUNT = 50;
const CODEBUILD_PROJECT_NAME = 'compatibility-test-worker';

export const getCompletedBuilds = async builds => {
  const stdout = await _exec(`aws codebuild batch-get-builds --ids ${builds.join(' ')}`);
  return JSON.parse(stdout.toString()).builds.reduce((arr, build) => {
    _verbose(`${build.id}: ${build.currentPhase}`);
    if (build.currentPhase === 'COMPLETED') arr.push(build.id);
    return arr;
  }, []);
};

export const triggerBuild = async (props) => {
  try {
    const stdout = await _exec(`echo '${JSON.stringify({
      projectName: CODEBUILD_PROJECT_NAME,
      ...props
    }).replace(/'/g, '\'')}' | xargs -0 aws codebuild start-build --cli-input-json`, {
      maxBuffer: 10 * 1024 * 1024
    });

    const { build } = JSON.parse(stdout.toString());
    return build.id;
  } catch (ex) {
    if (ex.toString().indexOf('AccountLimitExceededException') !== -1) {
      _verbose2('Holding...');
      await setTimeout(30000);
      return triggerBuild(props);
    }

    _error('Error triggering build:', ex);
  }
};

export const waitForBuild = async (label, builds) => {
  let errors = 0;
  while (builds.length > 0) {
    if (builds.length === 1 && builds[0] === 'SKIP') break;

    _verbose2(`Waiting for ${label} tasks to complete...`);
    await setTimeout(60000);
    const completedBuilds = await getCompletedBuilds(builds);
    if (Array.isArray(completedBuilds)) {
      completedBuilds.forEach(buildId => builds.splice(builds.indexOf(buildId), 1));
    } else {
      _error(`${++errors}/3: Failed to check status of ${label} tasks`);
      if (errors >= 3) process.exit(1);
    }
  }
  _ok(`${label} Done.`);
};

export const waitForFreeParallelBuild = async (builds) => {
  let errors = 0;
  while (builds.length >= PARALLEL_COUNT) {
    _verbose2('Waiting...');
    await setTimeout(60000);
    const completedBuilds = await getCompletedBuilds(builds);
    if (Array.isArray(completedBuilds)) {
      completedBuilds.forEach(buildId => builds.splice(builds.indexOf(buildId), 1));
    } else {
      _error(`${++errors}/3: Failed to check task status`);
      if (errors >= 3) process.exit(1);
    }
  }
};