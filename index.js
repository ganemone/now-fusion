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
  const includeFiles = ['.fusion/**', 'node_modules/**'];
  const assets = {};
  for (const pattern of includeFiles) {
    // eslint-disable-next-line no-await-in-loop
    const files = await glob(pattern, inputDir);

    // eslint-disable-next-line no-restricted-syntax
    for (const assetName of Object.keys(files)) {
      const stream = files[assetName].toStream();
      const {mode} = files[assetName];
      // eslint-disable-next-line no-await-in-loop
      const {data} = await FileBlob.fromStream({stream});

      assets[assetName] = {
        source: data,
        permissions: mode,
      };
    }
  }
  const lambda = await createLambda({
    runtime: 'nodejs8.10',
    handler: 'index.main',
    files: {
      [entrypoint]: new FileBlob({
        data: `
        const fs = require('fs');
        exports.main = (req, res) => {
          console.log('dirs', fs.readdirSync('.'));
          console.log('received request', req.url);
          const getHandler = require('fusion-cli/serverless');
          const handler = getHandler();
          return handler(req, res);
        }
      `,
      }),
      ...assets,
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
