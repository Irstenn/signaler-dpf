/* dc-lite.js — moteur minimal pour afficher les maquettes hors du canevas.
   Gère : {{chemin}}, <template data-scfor list as>, <template data-scif value>,
   attributs onClick="{{fn}}", et une classe Component extends DCLogic avec setState. */
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(p) { Object.assign(this.state, typeof p === 'function' ? p(this.state, this.props) : p); render(); }
    forceUpdate() { render(); }
  }
  window.DCLogic = DCLogic;

  let comp = null, tpl = null, root = null;

  function lookup(path, ctx) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
  }
  const WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  const ANY = /\{\{\s*([^}]+?)\s*\}\}/g;
  const interp = (s, ctx) => s.replace(ANY, (_, p) => { const v = lookup(p, ctx); return v == null ? '' : String(v); });

  function proc(node, ctx, out) {
    if (node.nodeType === 3) { out.push(document.createTextNode(interp(node.nodeValue, ctx))); return; }
    if (node.nodeType !== 1) return;
    if (node.tagName === 'TEMPLATE' && node.hasAttribute('data-scfor')) {
      const list = lookup(WHOLE.exec(node.getAttribute('list'))[1], ctx) || [];
      const as = node.getAttribute('as') || 'item';
      list.forEach((item, i) => {
        const c = Object.assign({}, ctx, { [as]: item, $index: i });
        node.content.childNodes.forEach(ch => proc(ch, c, out));
      });
      return;
    }
    if (node.tagName === 'TEMPLATE' && node.hasAttribute('data-scif')) {
      if (lookup(WHOLE.exec(node.getAttribute('value'))[1], ctx)) node.content.childNodes.forEach(ch => proc(ch, ctx, out));
      return;
    }
    const el = document.createElementNS(node.namespaceURI, node.localName);
    for (const a of Array.from(node.attributes)) {
      if (a.name.startsWith('hint-')) continue;
      const m = WHOLE.exec(a.value);
      if (m && /^on[a-z]/i.test(a.name)) {
        const fn = lookup(m[1], ctx);
        if (typeof fn === 'function') el.addEventListener(a.name.slice(2).toLowerCase(), fn);
      } else if (m) {
        const v = lookup(m[1], ctx);
        if (v === false || v == null) continue;
        el.setAttribute(a.name, v === true ? '' : String(v));
      } else {
        el.setAttribute(a.name, a.value.indexOf('{{') >= 0 ? interp(a.value, ctx) : a.value);
      }
    }
    const kids = [];
    (node.tagName === 'TEMPLATE' ? node.content : node).childNodes.forEach(ch => proc(ch, ctx, kids));
    kids.forEach(k => el.appendChild(k));
    out.push(el);
  }

  function render() {
    const vals = comp && comp.renderVals ? comp.renderVals() : {};
    const out = [];
    tpl.content.childNodes.forEach(ch => proc(ch, vals, out));
    root.replaceChildren(...out);
  }

  document.addEventListener('DOMContentLoaded', () => {
    tpl = document.getElementById('dc-template');
    root = document.getElementById('dc-root');
    const s = document.querySelector('script[data-dc-script]');
    let props = {};
    try {
      const decl = JSON.parse(s.getAttribute('data-props') || '{}');
      Object.keys(decl).forEach(k => { if (k[0] !== '$' && 'default' in decl[k]) props[k] = decl[k].default; });
    } catch (e) {}
    const Component = new Function('DCLogic', s.textContent + '\nreturn Component;')(DCLogic);
    comp = new Component(props);
    if (!comp.state) comp.state = {};
    render();
  });
})();
