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
// const fs = require('fs');
// const readdir = require('fs-readdir-recursive');

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
  const lambda = await createLambda({
    runtime: 'nodejs8.10',
    handler: 'index.main',
    files: {
      [entrypoint]: new FileBlob({
        data: `
        // const fs = require('fs');
        // const getHandler = require('fusion-cli/serverless');
        // const {createServer, proxy} = require('aws-serverless-express');
        // const handler = getHandler();
        // const server = createServer(handler);
        exports.main = (...args) => {
            console.log('args', args);
            throw new Error('FAIL');
          // return proxy(server, ...args);
        }
      `,
      }),
      // ...(await glob('node_modules/**', inputDir)),
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
