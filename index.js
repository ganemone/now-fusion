// @flow
/* eslint-env node */
const {join, dirname} = require('path');
const {
  download,
  runNpmInstall,
  createLambda,
  runPackageJsonScript,
  FileBlob,
} = require('@now/build-utils');
const fs = require('fs');
const readdir = require('fs-readdir-recursive');

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
  const fusionFiles = readdir(join(entrypointFsDirname, '.fusion')).reduce(
    (obj, file) => {
      const relativePath = join('.fusion', file);
      const absolutePath = join(entrypointFsDirname, relativePath);
      obj[relativePath] = new FileBlob({
        data: fs.readFileSync(absolutePath).toString(),
      });
      return obj;
    },
    {}
  );
  const lambda = await createLambda({
    runtime: 'nodejs8.10',
    handler: 'index.main',
    files: {
      'index.js': new FileBlob({
        data: `
        const getHandler = require('fusion-cli/serverless');
        exports.main = getHandler({});
      `,
      }),
      ...fusionFiles,
    },
  });

  return {
    output: {
      [entrypoint]: lambda,
    },
    watch: [],
    routes: {},
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
