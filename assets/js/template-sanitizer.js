(function (global) {
  'use strict';

  const blockedElements = [
    'script', 'iframe', 'object', 'embed', 'meta', 'base', 'link', 'style',
    'form', 'input', 'button', 'textarea', 'select', 'option', 'svg', 'math'
  ].join(',');
  const unsafeCss = /(?:expression\s*\(|url\s*\(|@import|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding)/i;
  const templateToken = /^\{[A-Z][A-Z0-9_]*\}$/;

  function safeImageSource(value) {
    const source = String(value || '').trim();
    return templateToken.test(source)
      || /^https:\/\//i.test(source)
      || /^(?:\.\.?\/|\/)?[A-Za-z0-9_.~/-]+(?:\?[A-Za-z0-9_.~!$&'()*+,;=:@%/?-]*)?$/i.test(source)
      || /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(source);
  }

  function safeLink(value) {
    const target = String(value || '').trim();
    return /^https:\/\//i.test(target)
      || /^(?:mailto|tel):/i.test(target)
      || /^#[A-Za-z0-9_-]*$/.test(target)
      || /^(?:\.\.?\/|\/)[A-Za-z0-9_.~/-]*(?:\?[A-Za-z0-9_.~!$&'()*+,;=:@%/?-]*)?$/i.test(target);
  }

  function sanitize(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll(blockedElements).forEach(function (node) { node.remove(); });
    template.content.querySelectorAll('*').forEach(function (element) {
      Array.from(element.attributes).forEach(function (attribute) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value;
        if (name.startsWith('on') || name.startsWith('data-qa-on') || ['srcdoc', 'formaction', 'action', 'poster', 'srcset', 'xmlns', 'id', 'name'].includes(name)) {
          element.removeAttribute(attribute.name);
          return;
        }
        if (name === 'style' && unsafeCss.test(value)) {
          element.removeAttribute(attribute.name);
          return;
        }
        if (name === 'src' && (element.tagName !== 'IMG' || !safeImageSource(value))) {
          element.removeAttribute(attribute.name);
          return;
        }
        if ((name === 'href' || name === 'xlink:href') && !safeLink(value)) {
          element.removeAttribute(attribute.name);
        }
      });
      if (element.tagName === 'A' && element.getAttribute('target') === '_blank') {
        element.setAttribute('rel', 'noopener noreferrer');
      }
    });
    return template.innerHTML;
  }

  global.QATemplateSanitizer = Object.freeze({ sanitize: sanitize });
})(window);
