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
  // const fusionFiles = readdir(join(entrypointFsDirname, '.fusion')).reduce(
  //   (obj, file) => {
  //     const relativePath = join('.fusion', file);
  //     const absolutePath = join(entrypointFsDirname, relativePath);
  //     obj[relativePath] = new FileBlob({
  //       data: fs.readFileSync(absolutePath).toString(),
  //     });
  //     return obj;
  //   },
  //   {}
  // );
  const lambda = await createLambda({
    runtime: 'nodejs8.10',
    handler: 'index.main',
    files: {
      [entrypoint]: new FileBlob({
        data: `
        const fs = require('fs');
        exports.main = (req, res) => {
          console.log('dirs', fs.readdirSync('node_modules'));
          console.log('received request');
          const getHandler = require('fusion-cli/serverless');
          const handler = getHandler();
          return handler(req, res);
        }
      `,
      }),
      ...(await glob('.fusion/**', inputDir)),
      ...(await glob('node_modules/**', inputDir)),
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
