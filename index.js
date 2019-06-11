// @flow
/* eslint-env node */
const {join, dirname} = require('path');
const {
  glob,
  download,
  runNpmInstall,
  createLambda,
  runPackageJsonScript,
  FileBlob,
} = require('@now/build-utils');
const {spawn} = require('child_process');
// const fs = require('fs');
// const readdir = require('fs-readdir-recursive');

function spawnAsync(command, args, cwd, opts = {}) {
  return new Promise((resolve, reject) => {
    const stderrLogs = [];
    opts = {stdio: 'inherit', cwd, ...opts};
    const child = spawn(command, args, opts);

    if (opts.stdio === 'pipe') {
      child.stderr.on('data', data => stderrLogs.push(data));
    }

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        return resolve();
      }

      const errorLogs = stderrLogs.map(line => line.toString()).join('');
      if (opts.stdio !== 'inherit') {
        reject(new Error(`Exited with ${code || signal}\n${errorLogs}`));
      } else {
        reject(new Error(`Exited with ${code || signal}`));
      }
    });
  });
}

// build({
//   files: Files,
//   entrypoint: String,
//   workPath: String,
//   config: Object,
//   meta?: {
//     isDev?: Boolean,
//     requestPath?: String,
//     filesChanged?: Array<String>,
//     filesRemoved?: Array<String>
//   }
// }) : {
//   watch: Array<String>,
//   output: Files output,
//   routes: Object
// }
exports.build = async ({files, entrypoint, workPath, config, meta = {}}) => {
  const downloadedFiles = await download(files, workPath, meta);
  const entrypointFsDirname = join(workPath, dirname(entrypoint));
  await runNpmInstall(entrypointFsDirname, ['--frozen-lockfile']);
  await runPackageJsonScript(entrypointFsDirname, 'now-build');
  const entrypointPath = downloadedFiles[entrypoint].fsPath;
  const inputDir = dirname(entrypointPath);
  // await spawnAsync('rm', ['-rf', join(entrypointFsDirname, 'node_modules')]);
  // await spawnAsync('rm', [
  //   join(entrypointFsDirname, 'yarn.lock'),
  //   join(entrypointFsDirname, 'package.json'),
  // ]);
  await spawnAsync('yarn', ['add', 'fusion-cli', 'aws-serverless-express']);
  const lambda = await createLambda({
    runtime: 'nodejs8.10',
    handler: 'index.main',
    files: {
      [entrypoint]: new FileBlob({
        data: `
        const fs = require('fs');
        const getHandler = require('fusion-cli/serverless');
        const {createServer, proxy} = require('aws-serverless-express');
        const handler = getHandler();
        const server = createServer((req, res) => {
          console.log('handler', handler);
          console.log('req', req);
          console.log('res', 'res');
          res.end('OK');
        });
        exports.main = (...args) => {
          console.log('args', args);
          return proxy(server, ...args);
        }
      `,
      }),
      ...(await glob('node_modules/**', process.cwd())),
      ...(await glob('.fusion/**', inputDir)),
    },
  });
  return {
    [entrypoint]: lambda,
  };
};

// prepareCache({
//   files: Files,
//   entrypoint: String,
//   workPath: String,
//   cachePath: String,
//   config: Object
// }) : Files cacheOutput

// shouldServe({
//   entrypoint: String,
//   files: Files,
//   config: Object,
//   requestPath: String,
//   workPath: String
// }) : Boolean

exports.version = 2;
