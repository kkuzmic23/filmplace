import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';

import compression from 'compression';
import express from 'express';
import { join } from 'node:path';
import { constants } from 'node:zlib';
import { sitemapHandler } from './server/sitemap.js';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(
  compression({
    threshold: '1kb',
    brotli: {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 4,
      },
    },
  }),
);

app.get('/sitemap.xml', sitemapHandler);

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (response) {
        return writeResponseToNodeResponse(response, res);
      }

      return next();
    })
    .catch(next);
});

export const reqHandler = createNodeRequestHandler(app);

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}
