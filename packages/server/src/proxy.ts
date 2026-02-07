import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import type { Request, Response } from 'express';
import { injectWidget } from './inject.js';

export function createProxy(targetUrl: string) {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    ws: true,
    selfHandleResponse: true,
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';

      if (contentType.includes('text/html')) {
        const html = responseBuffer.toString('utf8');
        return injectWidget(html);
      }

      return responseBuffer;
    }),
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      if (res instanceof Response) {
        res.status(502).send('Proxy error: ' + err.message);
      }
    },
  });
}
