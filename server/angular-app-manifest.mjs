
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: 'ectd-ui',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/ectd-ui"
  },
  {
    "renderMode": 2,
    "route": "/ectd-ui/dashboard"
  },
  {
    "renderMode": 2,
    "route": "/ectd-ui/upload"
  },
  {
    "renderMode": 2,
    "route": "/ectd-ui/consistency"
  },
  {
    "renderMode": 2,
    "route": "/ectd-ui/history"
  },
  {
    "renderMode": 2,
    "route": "/ectd-ui/results"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 37061, hash: 'afb319b3e09840ced1470ed2d721170a91478f400667ec6dfddbd7137afe6b30', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 26496, hash: 'c0f0c51e92a7124555f7daf792800e6be0e5aee12970c06f3f886d8610d3c43f', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-JYF6RQ3I.css': {size: 15066, hash: 'GsE8MKSJqis', text: () => import('./assets-chunks/styles-JYF6RQ3I_css.mjs').then(m => m.default)}
  },
};
