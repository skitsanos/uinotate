/* Uinotate browser bundle. Generated from src/widget.js by bun run build.

Includes html-to-image 1.11.13:
MIT License

Copyright (c) 2017-2025 W.Y.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
(() => {
  // node_modules/html-to-image/es/util.js
  function resolveUrl(url, baseUrl) {
    if (url.match(/^[a-z]+:\/\//i)) {
      return url;
    }
    if (url.match(/^\/\//)) {
      return window.location.protocol + url;
    }
    if (url.match(/^[a-z]+:/i)) {
      return url;
    }
    const doc = document.implementation.createHTMLDocument();
    const base = doc.createElement("base");
    const a = doc.createElement("a");
    doc.head.appendChild(base);
    doc.body.appendChild(a);
    if (baseUrl) {
      base.href = baseUrl;
    }
    a.href = url;
    return a.href;
  }
  var uuid = (() => {
    let counter = 0;
    const random = () => `0000${(Math.random() * 36 ** 4 << 0).toString(36)}`.slice(-4);
    return () => {
      counter += 1;
      return `u${random()}${counter}`;
    };
  })();
  function toArray(arrayLike) {
    const arr = [];
    for (let i = 0, l = arrayLike.length;i < l; i++) {
      arr.push(arrayLike[i]);
    }
    return arr;
  }
  var styleProps = null;
  function getStyleProperties(options = {}) {
    if (styleProps) {
      return styleProps;
    }
    if (options.includeStyleProperties) {
      styleProps = options.includeStyleProperties;
      return styleProps;
    }
    styleProps = toArray(window.getComputedStyle(document.documentElement));
    return styleProps;
  }
  function px(node, styleProperty) {
    const win = node.ownerDocument.defaultView || window;
    const val = win.getComputedStyle(node).getPropertyValue(styleProperty);
    return val ? parseFloat(val.replace("px", "")) : 0;
  }
  function getNodeWidth(node) {
    const leftBorder = px(node, "border-left-width");
    const rightBorder = px(node, "border-right-width");
    return node.clientWidth + leftBorder + rightBorder;
  }
  function getNodeHeight(node) {
    const topBorder = px(node, "border-top-width");
    const bottomBorder = px(node, "border-bottom-width");
    return node.clientHeight + topBorder + bottomBorder;
  }
  function getImageSize(targetNode, options = {}) {
    const width = options.width || getNodeWidth(targetNode);
    const height = options.height || getNodeHeight(targetNode);
    return { width, height };
  }
  function getPixelRatio() {
    let ratio;
    let FINAL_PROCESS;
    try {
      FINAL_PROCESS = process;
    } catch (e) {}
    const val = FINAL_PROCESS && FINAL_PROCESS.env ? FINAL_PROCESS.env.devicePixelRatio : null;
    if (val) {
      ratio = parseInt(val, 10);
      if (Number.isNaN(ratio)) {
        ratio = 1;
      }
    }
    return ratio || window.devicePixelRatio || 1;
  }
  var canvasDimensionLimit = 16384;
  function checkCanvasDimensions(canvas) {
    if (canvas.width > canvasDimensionLimit || canvas.height > canvasDimensionLimit) {
      if (canvas.width > canvasDimensionLimit && canvas.height > canvasDimensionLimit) {
        if (canvas.width > canvas.height) {
          canvas.height *= canvasDimensionLimit / canvas.width;
          canvas.width = canvasDimensionLimit;
        } else {
          canvas.width *= canvasDimensionLimit / canvas.height;
          canvas.height = canvasDimensionLimit;
        }
      } else if (canvas.width > canvasDimensionLimit) {
        canvas.height *= canvasDimensionLimit / canvas.width;
        canvas.width = canvasDimensionLimit;
      } else {
        canvas.width *= canvasDimensionLimit / canvas.height;
        canvas.height = canvasDimensionLimit;
      }
    }
  }
  function createImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image;
      img.onload = () => {
        img.decode().then(() => {
          requestAnimationFrame(() => resolve(img));
        });
      };
      img.onerror = reject;
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = url;
    });
  }
  async function svgToDataURL(svg) {
    return Promise.resolve().then(() => new XMLSerializer().serializeToString(svg)).then(encodeURIComponent).then((html) => `data:image/svg+xml;charset=utf-8,${html}`);
  }
  async function nodeToDataURL(node, width, height) {
    const xmlns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(xmlns, "svg");
    const foreignObject = document.createElementNS(xmlns, "foreignObject");
    svg.setAttribute("width", `${width}`);
    svg.setAttribute("height", `${height}`);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    foreignObject.setAttribute("width", "100%");
    foreignObject.setAttribute("height", "100%");
    foreignObject.setAttribute("x", "0");
    foreignObject.setAttribute("y", "0");
    foreignObject.setAttribute("externalResourcesRequired", "true");
    svg.appendChild(foreignObject);
    foreignObject.appendChild(node);
    return svgToDataURL(svg);
  }
  var isInstanceOfElement = (node, instance) => {
    if (node instanceof instance)
      return true;
    const nodePrototype = Object.getPrototypeOf(node);
    if (nodePrototype === null)
      return false;
    return nodePrototype.constructor.name === instance.name || isInstanceOfElement(nodePrototype, instance);
  };

  // node_modules/html-to-image/es/clone-pseudos.js
  function formatCSSText(style) {
    const content = style.getPropertyValue("content");
    return `${style.cssText} content: '${content.replace(/'|"/g, "")}';`;
  }
  function formatCSSProperties(style, options) {
    return getStyleProperties(options).map((name) => {
      const value = style.getPropertyValue(name);
      const priority = style.getPropertyPriority(name);
      return `${name}: ${value}${priority ? " !important" : ""};`;
    }).join(" ");
  }
  function getPseudoElementStyle(className, pseudo, style, options) {
    const selector = `.${className}:${pseudo}`;
    const cssText = style.cssText ? formatCSSText(style) : formatCSSProperties(style, options);
    return document.createTextNode(`${selector}{${cssText}}`);
  }
  function clonePseudoElement(nativeNode, clonedNode, pseudo, options) {
    const style = window.getComputedStyle(nativeNode, pseudo);
    const content = style.getPropertyValue("content");
    if (content === "" || content === "none") {
      return;
    }
    const className = uuid();
    try {
      clonedNode.className = `${clonedNode.className} ${className}`;
    } catch (err) {
      return;
    }
    const styleElement = document.createElement("style");
    styleElement.appendChild(getPseudoElementStyle(className, pseudo, style, options));
    clonedNode.appendChild(styleElement);
  }
  function clonePseudoElements(nativeNode, clonedNode, options) {
    clonePseudoElement(nativeNode, clonedNode, ":before", options);
    clonePseudoElement(nativeNode, clonedNode, ":after", options);
  }

  // node_modules/html-to-image/es/mimes.js
  var WOFF = "application/font-woff";
  var JPEG = "image/jpeg";
  var mimes = {
    woff: WOFF,
    woff2: WOFF,
    ttf: "application/font-truetype",
    eot: "application/vnd.ms-fontobject",
    png: "image/png",
    jpg: JPEG,
    jpeg: JPEG,
    gif: "image/gif",
    tiff: "image/tiff",
    svg: "image/svg+xml",
    webp: "image/webp"
  };
  function getExtension(url) {
    const match = /\.([^./]*?)$/g.exec(url);
    return match ? match[1] : "";
  }
  function getMimeType(url) {
    const extension = getExtension(url).toLowerCase();
    return mimes[extension] || "";
  }

  // node_modules/html-to-image/es/dataurl.js
  function getContentFromDataUrl(dataURL) {
    return dataURL.split(/,/)[1];
  }
  function isDataUrl(url) {
    return url.search(/^(data:)/) !== -1;
  }
  function makeDataUrl(content, mimeType) {
    return `data:${mimeType};base64,${content}`;
  }
  async function fetchAsDataURL(url, init, process2) {
    const res = await fetch(url, init);
    if (res.status === 404) {
      throw new Error(`Resource "${res.url}" not found`);
    }
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader;
      reader.onerror = reject;
      reader.onloadend = () => {
        try {
          resolve(process2({ res, result: reader.result }));
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsDataURL(blob);
    });
  }
  var cache = {};
  function getCacheKey(url, contentType, includeQueryParams) {
    let key = url.replace(/\?.*/, "");
    if (includeQueryParams) {
      key = url;
    }
    if (/ttf|otf|eot|woff2?/i.test(key)) {
      key = key.replace(/.*\//, "");
    }
    return contentType ? `[${contentType}]${key}` : key;
  }
  async function resourceToDataURL(resourceUrl, contentType, options) {
    const cacheKey = getCacheKey(resourceUrl, contentType, options.includeQueryParams);
    if (cache[cacheKey] != null) {
      return cache[cacheKey];
    }
    if (options.cacheBust) {
      resourceUrl += (/\?/.test(resourceUrl) ? "&" : "?") + new Date().getTime();
    }
    let dataURL;
    try {
      const content = await fetchAsDataURL(resourceUrl, options.fetchRequestInit, ({ res, result }) => {
        if (!contentType) {
          contentType = res.headers.get("Content-Type") || "";
        }
        return getContentFromDataUrl(result);
      });
      dataURL = makeDataUrl(content, contentType);
    } catch (error) {
      dataURL = options.imagePlaceholder || "";
      let msg = `Failed to fetch resource: ${resourceUrl}`;
      if (error) {
        msg = typeof error === "string" ? error : error.message;
      }
      if (msg) {
        console.warn(msg);
      }
    }
    cache[cacheKey] = dataURL;
    return dataURL;
  }

  // node_modules/html-to-image/es/clone-node.js
  async function cloneCanvasElement(canvas) {
    const dataURL = canvas.toDataURL();
    if (dataURL === "data:,") {
      return canvas.cloneNode(false);
    }
    return createImage(dataURL);
  }
  async function cloneVideoElement(video, options) {
    if (video.currentSrc) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      ctx === null || ctx === undefined || ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataURL = canvas.toDataURL();
      return createImage(dataURL);
    }
    const poster = video.poster;
    const contentType = getMimeType(poster);
    const dataURL = await resourceToDataURL(poster, contentType, options);
    return createImage(dataURL);
  }
  async function cloneIFrameElement(iframe, options) {
    var _a;
    try {
      if ((_a = iframe === null || iframe === undefined ? undefined : iframe.contentDocument) === null || _a === undefined ? undefined : _a.body) {
        return await cloneNode(iframe.contentDocument.body, options, true);
      }
    } catch (_b) {}
    return iframe.cloneNode(false);
  }
  async function cloneSingleNode(node, options) {
    if (isInstanceOfElement(node, HTMLCanvasElement)) {
      return cloneCanvasElement(node);
    }
    if (isInstanceOfElement(node, HTMLVideoElement)) {
      return cloneVideoElement(node, options);
    }
    if (isInstanceOfElement(node, HTMLIFrameElement)) {
      return cloneIFrameElement(node, options);
    }
    return node.cloneNode(isSVGElement(node));
  }
  var isSlotElement = (node) => node.tagName != null && node.tagName.toUpperCase() === "SLOT";
  var isSVGElement = (node) => node.tagName != null && node.tagName.toUpperCase() === "SVG";
  async function cloneChildren(nativeNode, clonedNode, options) {
    var _a, _b;
    if (isSVGElement(clonedNode)) {
      return clonedNode;
    }
    let children = [];
    if (isSlotElement(nativeNode) && nativeNode.assignedNodes) {
      children = toArray(nativeNode.assignedNodes());
    } else if (isInstanceOfElement(nativeNode, HTMLIFrameElement) && ((_a = nativeNode.contentDocument) === null || _a === undefined ? undefined : _a.body)) {
      children = toArray(nativeNode.contentDocument.body.childNodes);
    } else {
      children = toArray(((_b = nativeNode.shadowRoot) !== null && _b !== undefined ? _b : nativeNode).childNodes);
    }
    if (children.length === 0 || isInstanceOfElement(nativeNode, HTMLVideoElement)) {
      return clonedNode;
    }
    await children.reduce((deferred, child) => deferred.then(() => cloneNode(child, options)).then((clonedChild) => {
      if (clonedChild) {
        clonedNode.appendChild(clonedChild);
      }
    }), Promise.resolve());
    return clonedNode;
  }
  function cloneCSSStyle(nativeNode, clonedNode, options) {
    const targetStyle = clonedNode.style;
    if (!targetStyle) {
      return;
    }
    const sourceStyle = window.getComputedStyle(nativeNode);
    if (sourceStyle.cssText) {
      targetStyle.cssText = sourceStyle.cssText;
      targetStyle.transformOrigin = sourceStyle.transformOrigin;
    } else {
      getStyleProperties(options).forEach((name) => {
        let value = sourceStyle.getPropertyValue(name);
        if (name === "font-size" && value.endsWith("px")) {
          const reducedFont = Math.floor(parseFloat(value.substring(0, value.length - 2))) - 0.1;
          value = `${reducedFont}px`;
        }
        if (isInstanceOfElement(nativeNode, HTMLIFrameElement) && name === "display" && value === "inline") {
          value = "block";
        }
        if (name === "d" && clonedNode.getAttribute("d")) {
          value = `path(${clonedNode.getAttribute("d")})`;
        }
        targetStyle.setProperty(name, value, sourceStyle.getPropertyPriority(name));
      });
    }
  }
  function cloneInputValue(nativeNode, clonedNode) {
    if (isInstanceOfElement(nativeNode, HTMLTextAreaElement)) {
      clonedNode.innerHTML = nativeNode.value;
    }
    if (isInstanceOfElement(nativeNode, HTMLInputElement)) {
      clonedNode.setAttribute("value", nativeNode.value);
    }
  }
  function cloneSelectValue(nativeNode, clonedNode) {
    if (isInstanceOfElement(nativeNode, HTMLSelectElement)) {
      const clonedSelect = clonedNode;
      const selectedOption = Array.from(clonedSelect.children).find((child) => nativeNode.value === child.getAttribute("value"));
      if (selectedOption) {
        selectedOption.setAttribute("selected", "");
      }
    }
  }
  function decorate(nativeNode, clonedNode, options) {
    if (isInstanceOfElement(clonedNode, Element)) {
      cloneCSSStyle(nativeNode, clonedNode, options);
      clonePseudoElements(nativeNode, clonedNode, options);
      cloneInputValue(nativeNode, clonedNode);
      cloneSelectValue(nativeNode, clonedNode);
    }
    return clonedNode;
  }
  async function ensureSVGSymbols(clone, options) {
    const uses = clone.querySelectorAll ? clone.querySelectorAll("use") : [];
    if (uses.length === 0) {
      return clone;
    }
    const processedDefs = {};
    for (let i = 0;i < uses.length; i++) {
      const use = uses[i];
      const id = use.getAttribute("xlink:href");
      if (id) {
        const exist = clone.querySelector(id);
        const definition = document.querySelector(id);
        if (!exist && definition && !processedDefs[id]) {
          processedDefs[id] = await cloneNode(definition, options, true);
        }
      }
    }
    const nodes = Object.values(processedDefs);
    if (nodes.length) {
      const ns = "http://www.w3.org/1999/xhtml";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("xmlns", ns);
      svg.style.position = "absolute";
      svg.style.width = "0";
      svg.style.height = "0";
      svg.style.overflow = "hidden";
      svg.style.display = "none";
      const defs = document.createElementNS(ns, "defs");
      svg.appendChild(defs);
      for (let i = 0;i < nodes.length; i++) {
        defs.appendChild(nodes[i]);
      }
      clone.appendChild(svg);
    }
    return clone;
  }
  async function cloneNode(node, options, isRoot) {
    if (!isRoot && options.filter && !options.filter(node)) {
      return null;
    }
    return Promise.resolve(node).then((clonedNode) => cloneSingleNode(clonedNode, options)).then((clonedNode) => cloneChildren(node, clonedNode, options)).then((clonedNode) => decorate(node, clonedNode, options)).then((clonedNode) => ensureSVGSymbols(clonedNode, options));
  }

  // node_modules/html-to-image/es/embed-resources.js
  var URL_REGEX = /url\((['"]?)([^'"]+?)\1\)/g;
  var URL_WITH_FORMAT_REGEX = /url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g;
  var FONT_SRC_REGEX = /src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;
  function toRegex(url) {
    const escaped = url.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
    return new RegExp(`(url\\(['"]?)(${escaped})(['"]?\\))`, "g");
  }
  function parseURLs(cssText) {
    const urls = [];
    cssText.replace(URL_REGEX, (raw, quotation, url) => {
      urls.push(url);
      return raw;
    });
    return urls.filter((url) => !isDataUrl(url));
  }
  async function embed(cssText, resourceURL, baseURL, options, getContentFromUrl) {
    try {
      const resolvedURL = baseURL ? resolveUrl(resourceURL, baseURL) : resourceURL;
      const contentType = getMimeType(resourceURL);
      let dataURL;
      if (getContentFromUrl) {
        const content = await getContentFromUrl(resolvedURL);
        dataURL = makeDataUrl(content, contentType);
      } else {
        dataURL = await resourceToDataURL(resolvedURL, contentType, options);
      }
      return cssText.replace(toRegex(resourceURL), `$1${dataURL}$3`);
    } catch (error) {}
    return cssText;
  }
  function filterPreferredFontFormat(str, { preferredFontFormat }) {
    return !preferredFontFormat ? str : str.replace(FONT_SRC_REGEX, (match) => {
      while (true) {
        const [src, , format] = URL_WITH_FORMAT_REGEX.exec(match) || [];
        if (!format) {
          return "";
        }
        if (format === preferredFontFormat) {
          return `src: ${src};`;
        }
      }
    });
  }
  function shouldEmbed(url) {
    return url.search(URL_REGEX) !== -1;
  }
  async function embedResources(cssText, baseUrl, options) {
    if (!shouldEmbed(cssText)) {
      return cssText;
    }
    const filteredCSSText = filterPreferredFontFormat(cssText, options);
    const urls = parseURLs(filteredCSSText);
    return urls.reduce((deferred, url) => deferred.then((css) => embed(css, url, baseUrl, options)), Promise.resolve(filteredCSSText));
  }

  // node_modules/html-to-image/es/embed-images.js
  async function embedProp(propName, node, options) {
    var _a;
    const propValue = (_a = node.style) === null || _a === undefined ? undefined : _a.getPropertyValue(propName);
    if (propValue) {
      const cssString = await embedResources(propValue, null, options);
      node.style.setProperty(propName, cssString, node.style.getPropertyPriority(propName));
      return true;
    }
    return false;
  }
  async function embedBackground(clonedNode, options) {
    await embedProp("background", clonedNode, options) || await embedProp("background-image", clonedNode, options);
    await embedProp("mask", clonedNode, options) || await embedProp("-webkit-mask", clonedNode, options) || await embedProp("mask-image", clonedNode, options) || await embedProp("-webkit-mask-image", clonedNode, options);
  }
  async function embedImageNode(clonedNode, options) {
    const isImageElement = isInstanceOfElement(clonedNode, HTMLImageElement);
    if (!(isImageElement && !isDataUrl(clonedNode.src)) && !(isInstanceOfElement(clonedNode, SVGImageElement) && !isDataUrl(clonedNode.href.baseVal))) {
      return;
    }
    const url = isImageElement ? clonedNode.src : clonedNode.href.baseVal;
    const dataURL = await resourceToDataURL(url, getMimeType(url), options);
    await new Promise((resolve, reject) => {
      clonedNode.onload = resolve;
      clonedNode.onerror = options.onImageErrorHandler ? (...attributes) => {
        try {
          resolve(options.onImageErrorHandler(...attributes));
        } catch (error) {
          reject(error);
        }
      } : reject;
      const image = clonedNode;
      if (image.decode) {
        image.decode = resolve;
      }
      if (image.loading === "lazy") {
        image.loading = "eager";
      }
      if (isImageElement) {
        clonedNode.srcset = "";
        clonedNode.src = dataURL;
      } else {
        clonedNode.href.baseVal = dataURL;
      }
    });
  }
  async function embedChildren(clonedNode, options) {
    const children = toArray(clonedNode.childNodes);
    const deferreds = children.map((child) => embedImages(child, options));
    await Promise.all(deferreds).then(() => clonedNode);
  }
  async function embedImages(clonedNode, options) {
    if (isInstanceOfElement(clonedNode, Element)) {
      await embedBackground(clonedNode, options);
      await embedImageNode(clonedNode, options);
      await embedChildren(clonedNode, options);
    }
  }

  // node_modules/html-to-image/es/apply-style.js
  function applyStyle(node, options) {
    const { style } = node;
    if (options.backgroundColor) {
      style.backgroundColor = options.backgroundColor;
    }
    if (options.width) {
      style.width = `${options.width}px`;
    }
    if (options.height) {
      style.height = `${options.height}px`;
    }
    const manual = options.style;
    if (manual != null) {
      Object.keys(manual).forEach((key) => {
        style[key] = manual[key];
      });
    }
    return node;
  }

  // node_modules/html-to-image/es/embed-webfonts.js
  var cssFetchCache = {};
  async function fetchCSS(url) {
    let cache = cssFetchCache[url];
    if (cache != null) {
      return cache;
    }
    const res = await fetch(url);
    const cssText = await res.text();
    cache = { url, cssText };
    cssFetchCache[url] = cache;
    return cache;
  }
  async function embedFonts(data, options) {
    let cssText = data.cssText;
    const regexUrl = /url\(["']?([^"')]+)["']?\)/g;
    const fontLocs = cssText.match(/url\([^)]+\)/g) || [];
    const loadFonts = fontLocs.map(async (loc) => {
      let url = loc.replace(regexUrl, "$1");
      if (!url.startsWith("https://")) {
        url = new URL(url, data.url).href;
      }
      return fetchAsDataURL(url, options.fetchRequestInit, ({ result }) => {
        cssText = cssText.replace(loc, `url(${result})`);
        return [loc, result];
      });
    });
    return Promise.all(loadFonts).then(() => cssText);
  }
  function parseCSS(source) {
    if (source == null) {
      return [];
    }
    const result = [];
    const commentsRegex = /(\/\*[\s\S]*?\*\/)/gi;
    let cssText = source.replace(commentsRegex, "");
    const keyframesRegex = new RegExp("((@.*?keyframes [\\s\\S]*?){([\\s\\S]*?}\\s*?)})", "gi");
    while (true) {
      const matches = keyframesRegex.exec(cssText);
      if (matches === null) {
        break;
      }
      result.push(matches[0]);
    }
    cssText = cssText.replace(keyframesRegex, "");
    const importRegex = /@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi;
    const combinedCSSRegex = "((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]" + "*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})";
    const unifiedRegex = new RegExp(combinedCSSRegex, "gi");
    while (true) {
      let matches = importRegex.exec(cssText);
      if (matches === null) {
        matches = unifiedRegex.exec(cssText);
        if (matches === null) {
          break;
        } else {
          importRegex.lastIndex = unifiedRegex.lastIndex;
        }
      } else {
        unifiedRegex.lastIndex = importRegex.lastIndex;
      }
      result.push(matches[0]);
    }
    return result;
  }
  async function getCSSRules(styleSheets, options) {
    const ret = [];
    const deferreds = [];
    styleSheets.forEach((sheet) => {
      if ("cssRules" in sheet) {
        try {
          toArray(sheet.cssRules || []).forEach((item, index) => {
            if (item.type === CSSRule.IMPORT_RULE) {
              let importIndex = index + 1;
              const url = item.href;
              const deferred = fetchCSS(url).then((metadata) => embedFonts(metadata, options)).then((cssText) => parseCSS(cssText).forEach((rule) => {
                try {
                  sheet.insertRule(rule, rule.startsWith("@import") ? importIndex += 1 : sheet.cssRules.length);
                } catch (error) {
                  console.error("Error inserting rule from remote css", {
                    rule,
                    error
                  });
                }
              })).catch((e) => {
                console.error("Error loading remote css", e.toString());
              });
              deferreds.push(deferred);
            }
          });
        } catch (e) {
          const inline = styleSheets.find((a) => a.href == null) || document.styleSheets[0];
          if (sheet.href != null) {
            deferreds.push(fetchCSS(sheet.href).then((metadata) => embedFonts(metadata, options)).then((cssText) => parseCSS(cssText).forEach((rule) => {
              inline.insertRule(rule, inline.cssRules.length);
            })).catch((err) => {
              console.error("Error loading remote stylesheet", err);
            }));
          }
          console.error("Error inlining remote css file", e);
        }
      }
    });
    return Promise.all(deferreds).then(() => {
      styleSheets.forEach((sheet) => {
        if ("cssRules" in sheet) {
          try {
            toArray(sheet.cssRules || []).forEach((item) => {
              ret.push(item);
            });
          } catch (e) {
            console.error(`Error while reading CSS rules from ${sheet.href}`, e);
          }
        }
      });
      return ret;
    });
  }
  function getWebFontRules(cssRules) {
    return cssRules.filter((rule) => rule.type === CSSRule.FONT_FACE_RULE).filter((rule) => shouldEmbed(rule.style.getPropertyValue("src")));
  }
  async function parseWebFontRules(node, options) {
    if (node.ownerDocument == null) {
      throw new Error("Provided element is not within a Document");
    }
    const styleSheets = toArray(node.ownerDocument.styleSheets);
    const cssRules = await getCSSRules(styleSheets, options);
    return getWebFontRules(cssRules);
  }
  function normalizeFontFamily(font) {
    return font.trim().replace(/["']/g, "");
  }
  function getUsedFonts(node) {
    const fonts = new Set;
    function traverse(node) {
      const fontFamily = node.style.fontFamily || getComputedStyle(node).fontFamily;
      fontFamily.split(",").forEach((font) => {
        fonts.add(normalizeFontFamily(font));
      });
      Array.from(node.children).forEach((child) => {
        if (child instanceof HTMLElement) {
          traverse(child);
        }
      });
    }
    traverse(node);
    return fonts;
  }
  async function getWebFontCSS(node, options) {
    const rules = await parseWebFontRules(node, options);
    const usedFonts = getUsedFonts(node);
    const cssTexts = await Promise.all(rules.filter((rule) => usedFonts.has(normalizeFontFamily(rule.style.fontFamily))).map((rule) => {
      const baseUrl = rule.parentStyleSheet ? rule.parentStyleSheet.href : null;
      return embedResources(rule.cssText, baseUrl, options);
    }));
    return cssTexts.join(`
`);
  }
  async function embedWebFonts(clonedNode, options) {
    const cssText = options.fontEmbedCSS != null ? options.fontEmbedCSS : options.skipFonts ? null : await getWebFontCSS(clonedNode, options);
    if (cssText) {
      const styleNode = document.createElement("style");
      const sytleContent = document.createTextNode(cssText);
      styleNode.appendChild(sytleContent);
      if (clonedNode.firstChild) {
        clonedNode.insertBefore(styleNode, clonedNode.firstChild);
      } else {
        clonedNode.appendChild(styleNode);
      }
    }
  }

  // node_modules/html-to-image/es/index.js
  async function toSvg(node, options = {}) {
    const { width, height } = getImageSize(node, options);
    const clonedNode = await cloneNode(node, options, true);
    await embedWebFonts(clonedNode, options);
    await embedImages(clonedNode, options);
    applyStyle(clonedNode, options);
    const datauri = await nodeToDataURL(clonedNode, width, height);
    return datauri;
  }
  async function toCanvas(node, options = {}) {
    const { width, height } = getImageSize(node, options);
    const svg = await toSvg(node, options);
    const img = await createImage(svg);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const ratio = options.pixelRatio || getPixelRatio();
    const canvasWidth = options.canvasWidth || width;
    const canvasHeight = options.canvasHeight || height;
    canvas.width = canvasWidth * ratio;
    canvas.height = canvasHeight * ratio;
    if (!options.skipAutoScale) {
      checkCanvasDimensions(canvas);
    }
    canvas.style.width = `${canvasWidth}`;
    canvas.style.height = `${canvasHeight}`;
    if (options.backgroundColor) {
      context.fillStyle = options.backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  // src/screenshot.js
  var PRIVATE_SELECTOR = "[data-uinotate], [data-uinotate-private], input, textarea, select, [contenteditable]:not([contenteditable='false']), iframe, script, noscript, style, link, meta, template, object, embed";
  function canCapture(node) {
    if (node.closest(PRIVATE_SELECTOR))
      return false;
    if (node.localName === "svg" && node.querySelector(PRIVATE_SELECTOR))
      return false;
    return true;
  }
  function captureFilter(node) {
    if (node.nodeType !== 1)
      return true;
    return canCapture(node);
  }
  function pngSize(dataUrl) {
    const base64 = dataUrl.slice("data:image/png;base64,".length);
    return Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  }
  function backdropColor(node) {
    const view = node.ownerDocument.defaultView;
    const transparent = (color) => !color || color === "transparent" || /^rgba\([^)]*,\s*0(?:\.0+)?\)$/i.test(color);
    if (!transparent(view.getComputedStyle(node).backgroundColor))
      return;
    for (let parent = node.parentElement;parent; parent = parent.parentElement) {
      const color = view.getComputedStyle(parent).backgroundColor;
      if (!transparent(color))
        return color;
    }
    return;
  }
  async function fontCSS(node, options) {
    const fonts = new Set;
    const collect = (current) => {
      if (!captureFilter(current))
        return;
      node.ownerDocument.defaultView.getComputedStyle(current).fontFamily.split(",").forEach((font) => fonts.add(font.trim().replace(/["']/g, "")));
      Array.from(current.children).forEach(collect);
    };
    collect(node);
    const rules = [];
    const visited = new Set;
    const read = (sheet) => {
      if (!sheet || visited.has(sheet))
        return;
      visited.add(sheet);
      let entries;
      try {
        entries = Array.from(sheet.cssRules || []);
      } catch {
        return;
      }
      const walk = (entries) => entries.forEach((rule) => {
        if (rule.type === 5 && fonts.has(rule.style.getPropertyValue("font-family").trim().replace(/["']/g, "")))
          rules.push(rule);
        else if (rule.styleSheet)
          read(rule.styleSheet);
        else if (rule.cssRules)
          walk(Array.from(rule.cssRules));
      });
      walk(entries);
    };
    Array.from(node.ownerDocument.styleSheets).forEach(read);
    return (await Promise.all(rules.map((rule) => embedResources(rule.cssText, rule.parentStyleSheet?.href || node.ownerDocument.baseURI, options)))).join(`
`);
  }
  async function captureElement(node, config, { signal } = {}, render = toCanvas) {
    if (!canCapture(node))
      throw new Error("Screenshots are excluded for form fields, editable content, iframes, and private elements.");
    if (!node.isConnected)
      throw new Error("That element is no longer on the page.");
    const abortIfNeeded = () => {
      if (signal?.aborted)
        throw new DOMException("Aborted", "AbortError");
    };
    abortIfNeeded();
    const rect = node.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(node.offsetWidth || rect.width));
    const height = Math.max(1, Math.ceil(node.offsetHeight || rect.height));
    const scale = Math.min(2, node.ownerDocument.defaultView.devicePixelRatio || 1, config.screenshotMaxDimension / Math.max(width, height));
    const options = {
      width,
      height,
      canvasWidth: Math.max(1, Math.round(width * scale)),
      canvasHeight: Math.max(1, Math.round(height * scale)),
      pixelRatio: 1,
      backgroundColor: backdropColor(node),
      filter: captureFilter,
      includeQueryParams: true,
      preferredFontFormat: "woff2",
      fetchRequestInit: { signal, credentials: "omit", referrerPolicy: "no-referrer" },
      style: { margin: "0", transform: "none", translate: "none", rotate: "none", scale: "none", position: "relative", inset: "auto" }
    };
    options.fontEmbedCSS = await fontCSS(node, options);
    abortIfNeeded();
    let canvas = await render(node, options);
    abortIfNeeded();
    if (!canvas || !canvas.width || !canvas.height || typeof canvas.toDataURL !== "function")
      throw new Error("The screenshot renderer did not return a canvas.");
    for (let attempt = 0;attempt < 9; attempt++) {
      abortIfNeeded();
      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl.startsWith("data:image/png;base64,"))
        throw new Error("This element could not be exported as a PNG.");
      const byteLength = pngSize(dataUrl);
      const longest = Math.max(canvas.width, canvas.height);
      if (byteLength <= config.screenshotMaxBytes && longest <= config.screenshotMaxDimension) {
        return { mimeType: "image/png", dataUrl, width: canvas.width, height: canvas.height, byteLength, capturedAt: new Date().toISOString() };
      }
      const factor = Math.min(0.75, config.screenshotMaxDimension / longest, Math.sqrt(config.screenshotMaxBytes / Math.max(byteLength, 1)) * 0.9);
      const smaller = node.ownerDocument.createElement("canvas");
      smaller.width = Math.max(1, Math.floor(canvas.width * factor));
      smaller.height = Math.max(1, Math.floor(canvas.height * factor));
      const context = smaller.getContext("2d");
      if (!context)
        throw new Error("Canvas rendering is unavailable in this browser.");
      context.drawImage(canvas, 0, 0, smaller.width, smaller.height);
      canvas = smaller;
    }
    throw new Error("The screenshot is too large to attach. You can send the annotation without it.");
  }

  // src/widget.js
  (function(global) {
    const VERSION = "0.1.0";
    const POSITIONS = ["right", "left", "top", "bottom"];
    const STYLE_PROPERTIES = [
      "display",
      "position",
      "color",
      "background-color",
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "padding",
      "margin",
      "border",
      "border-radius",
      "gap",
      "align-items",
      "justify-content"
    ];
    const ICONS = {
      launcher: '<path d="M7 4h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-5l-5 4v-4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M8 9h8M8 13h5"/>',
      feedback: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h8M8 14h5"/>',
      annotate: '<path d="M16 3 21 8M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/><path d="M3 8V4a1 1 0 0 1 1-1h4M16 21h4a1 1 0 0 0 1-1v-4"/>',
      about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      target: '<path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M8 21H4a1 1 0 0 1-1-1v-4"/><path d="M8 12h8M12 8v8"/>'
    };
    let active = null;
    let sequence = 0;
    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className)
        node.className = className;
      if (text !== undefined)
        node.textContent = text;
      return node;
    }
    function icon(name) {
      const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      node.setAttribute("viewBox", "0 0 24 24");
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", "currentColor");
      node.setAttribute("stroke-width", "1.7");
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute("stroke-linejoin", "round");
      node.setAttribute("aria-hidden", "true");
      node.innerHTML = ICONS[name];
      return node;
    }
    function button(className, label, iconName) {
      const node = element("button", className);
      node.type = "button";
      node.setAttribute("aria-label", label);
      if (iconName)
        node.append(icon(iconName));
      return node;
    }
    function cssEscape(value) {
      if (global.CSS && global.CSS.escape)
        return global.CSS.escape(value);
      return Array.from(String(value), (char) => "\\" + char.codePointAt(0).toString(16) + " ").join("");
    }
    function selectorFor(node) {
      const parts = [];
      for (let current = node;current && current.nodeType === 1; current = current.parentElement) {
        let part = current.localName;
        if (current.id) {
          const byId = "#" + cssEscape(current.id);
          if (document.querySelectorAll(byId).length === 1) {
            parts.unshift(byId);
            return parts.join(" > ");
          }
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((sibling) => sibling.localName === current.localName);
          if (siblings.length > 1)
            part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        }
        parts.unshift(part);
        const candidate = parts.join(" > ");
        if (document.querySelectorAll(candidate).length === 1)
          return candidate;
      }
      return parts.join(" > ");
    }
    function rectFor(node) {
      const rect = node.getBoundingClientRect();
      const round = (value) => Math.round(value * 100) / 100;
      return {
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height),
        pageX: round(rect.x + global.scrollX),
        pageY: round(rect.y + global.scrollY)
      };
    }
    function normalize(options) {
      const config = Object.assign({
        position: "right",
        offset: "50%",
        title: "A little feedback goes a long way.",
        apiUrl: null,
        token: null,
        headers: {},
        metadata: {},
        theme: {},
        zIndex: 2147483000,
        includeElementText: false,
        collectStyles: true,
        captureScreenshot: true,
        screenshotMaxDimension: 1200,
        screenshotMaxBytes: 300000,
        screenshotTimeout: 8000,
        screenshotRenderer: null,
        maxLength: 5000,
        requestTimeout: 15000,
        onSubmit: null,
        onSuccess: null,
        onError: null
      }, options);
      if (!POSITIONS.includes(config.position))
        throw new TypeError("Uinotate: position must be right, left, top, or bottom.");
      if (typeof config.offset === "number")
        config.offset += "px";
      if (typeof config.offset !== "string" || /^(auto|inherit|initial|unset|revert|revert-layer)$/i.test(config.offset.trim()) || !global.CSS.supports("top", config.offset)) {
        throw new TypeError("Uinotate: offset must be a valid CSS length or percentage.");
      }
      if (!Number.isInteger(config.maxLength) || config.maxLength < 1)
        throw new TypeError("Uinotate: maxLength must be a positive integer.");
      if (!Number.isFinite(config.requestTimeout) || config.requestTimeout < 1 || config.requestTimeout > 2147483647)
        throw new TypeError("Uinotate: requestTimeout must be between 1 and 2147483647 milliseconds.");
      if (!Number.isInteger(config.zIndex) || config.zIndex < 1 || config.zIndex > 2147483640)
        throw new TypeError("Uinotate: zIndex must be an integer between 1 and 2147483640.");
      for (const name of ["onSubmit", "onSuccess", "onError", "screenshotRenderer"]) {
        if (config[name] != null && typeof config[name] !== "function")
          throw new TypeError("Uinotate: " + name + " must be a function.");
      }
      if (typeof config.captureScreenshot !== "boolean")
        throw new TypeError("Uinotate: captureScreenshot must be a boolean.");
      if (!Number.isInteger(config.screenshotMaxDimension) || config.screenshotMaxDimension < 32 || config.screenshotMaxDimension > 4096)
        throw new TypeError("Uinotate: screenshotMaxDimension must be between 32 and 4096 pixels.");
      if (!Number.isInteger(config.screenshotMaxBytes) || config.screenshotMaxBytes < 1024 || config.screenshotMaxBytes > 2000000)
        throw new TypeError("Uinotate: screenshotMaxBytes must be between 1024 and 2000000 bytes.");
      if (!Number.isFinite(config.screenshotTimeout) || config.screenshotTimeout < 1 || config.screenshotTimeout > 2147483647)
        throw new TypeError("Uinotate: screenshotTimeout must be positive and at most 2147483647 milliseconds.");
      if (config.token != null && typeof config.token !== "string" && typeof config.token !== "function") {
        throw new TypeError("Uinotate: token must be a string or a function returning a token.");
      }
      if (config.apiUrl) {
        const url = new URL(config.apiUrl, global.location.href);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
          throw new TypeError("Uinotate: apiUrl must be an HTTP(S) URL without embedded credentials.");
        }
        config.apiUrl = url.href;
      }
      for (const name of ["headers", "metadata", "theme"]) {
        if (!config[name] || typeof config[name] !== "object" || Array.isArray(config[name]))
          throw new TypeError("Uinotate: " + name + " must be an object.");
      }
      JSON.stringify(config.metadata);
      return config;
    }

    class Widget {
      constructor(options) {
        this.config = normalize(options);
        this.id = "uinotate-" + ++sequence;
        this.destroyed = false;
        this.picking = false;
        this.busy = false;
        this.selected = null;
        this.listeners = [];
        this.viewListeners = [];
        this.drafts = { feedback: { message: "" }, annotation: { message: "", category: "style" } };
        this.request = null;
        this.captureRevision = 0;
        this.captureController = null;
        this.capturePromise = null;
        this.screenshot = null;
        this.closeTimer = null;
        this.nodes = [];
        this.mount();
      }
      listen(node, type, handler, options) {
        node.addEventListener(type, handler, options);
        this.listeners.push(() => node.removeEventListener(type, handler, options));
      }
      listenView(node, type, handler) {
        node.addEventListener(type, handler);
        this.viewListeners.push(() => node.removeEventListener(type, handler));
      }
      clearView() {
        this.viewListeners.splice(0).forEach((remove) => remove());
        this.content.replaceChildren();
      }
      saveDraft() {
        if (this.currentType && this.textarea && this.textarea.isConnected) {
          this.drafts[this.currentType] = { message: this.textarea.value, category: this.category?.value || "style" };
        }
      }
      owned(node) {
        return node instanceof global.Element && Boolean(node.closest("[data-uinotate]"));
      }
      mount() {
        const root = this.root = element("div", "uinotate-root");
        root.setAttribute("data-uinotate", "dock");
        const launcher = this.launcher = button("uinotate-launcher", "Open feedback tools", "launcher");
        launcher.setAttribute("aria-expanded", "false");
        launcher.setAttribute("aria-controls", this.id + "-menu");
        const menu = this.menu = element("div", "uinotate-menu");
        menu.id = this.id + "-menu";
        menu.setAttribute("role", "group");
        menu.setAttribute("aria-label", "Feedback tools");
        menu.setAttribute("inert", "");
        const orbit = element("div", "uinotate-orbit");
        orbit.setAttribute("aria-hidden", "true");
        menu.append(orbit);
        [
          ["feedback", "Quick feedback", () => this.openFeedback()],
          ["annotate", "Annotate an element", () => this.startAnnotation()],
          ["about", "About Uinotate", () => this.openAbout()]
        ].forEach(([name, label, handler]) => {
          const action = button("uinotate-action uinotate-action--" + name, label, name);
          action.append(element("span", "uinotate-tooltip", label));
          this.listen(action, "click", handler);
          menu.append(action);
        });
        root.append(menu, launcher);
        const dialog = this.dialog = element("dialog", "uinotate-dialog");
        dialog.setAttribute("data-uinotate", "dialog");
        dialog.setAttribute("aria-labelledby", this.id + "-title");
        const shell = element("div", "uinotate-dialog-shell");
        const header = element("div", "uinotate-dialog-header");
        header.append(element("span", "uinotate-wordmark", "uinotate"));
        const close = this.closeButton = button("uinotate-icon-button", "Close dialog", "close");
        header.append(close);
        this.content = element("div", "uinotate-content");
        shell.append(header, this.content);
        dialog.append(shell);
        const highlight = this.highlight = element("div", "uinotate-highlight");
        highlight.setAttribute("data-uinotate", "highlight");
        highlight.setAttribute("aria-hidden", "true");
        highlight.hidden = true;
        this.highlightLabel = element("span", "uinotate-highlight-label");
        highlight.append(this.highlightLabel);
        const picker = this.picker = element("div", "uinotate-picker");
        picker.setAttribute("data-uinotate", "picker");
        picker.hidden = true;
        picker.append(icon("target"));
        const instructions = element("div", "uinotate-picker-instructions");
        instructions.append(element("strong", "", "Pick something to annotate"), element("span", "", "Click an element, or Tab to it and press Enter. Esc cancels."));
        const cancel = button("uinotate-icon-button", "Cancel element selection", "close");
        picker.append(instructions, cancel);
        this.live = element("span", "uinotate-sr-only");
        this.live.setAttribute("role", "status");
        this.live.setAttribute("aria-live", "polite");
        root.append(this.live);
        this.nodes = [root, dialog, highlight, picker];
        this.applyConfig();
        document.body.append(...this.nodes);
        this.listen(root, "pointerenter", () => this.expand());
        this.listen(root, "pointerleave", () => this.scheduleCollapse());
        this.listen(root, "focusin", () => this.expand());
        this.listen(root, "focusout", () => this.scheduleCollapse());
        this.listen(launcher, "click", () => this.expand());
        this.listen(root, "keydown", (event) => {
          if (event.key === "Escape") {
            this.launcher.focus();
            this.expand(false);
          }
        });
        this.listen(close, "click", () => this.closeDialog());
        this.listen(cancel, "click", () => this.stopAnnotation(true));
        this.listen(dialog, "cancel", (event) => {
          event.preventDefault();
          this.closeDialog();
        });
        this.listen(dialog, "close", () => {
          this.highlight.hidden = true;
        });
        this.listen(dialog, "click", (event) => {
          if (event.target !== dialog)
            return;
          const rect = dialog.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
            this.closeDialog();
        });
        this.listen(document, "pointerdown", (event) => {
          if (!this.owned(event.target))
            this.expand(false);
        });
        this.listen(document, "pointermove", (event) => {
          if (this.picking && !this.owned(event.target))
            this.preview(event.target);
        }, { passive: true });
        this.listen(document, "focusin", (event) => {
          if (this.picking && !this.owned(event.target))
            this.preview(event.target);
        });
        this.listen(document, "click", (event) => {
          if (!this.picking || this.owned(event.target))
            return;
          event.preventDefault();
          event.stopImmediatePropagation();
          if (this.eligible(event.target))
            this.select(event.target);
        }, true);
        this.listen(document, "keydown", (event) => {
          if (!this.picking)
            return;
          if (event.key === "Escape") {
            event.preventDefault();
            this.stopAnnotation(true);
          }
          if ((event.key === "Enter" || event.key === " ") && this.eligible(document.activeElement)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.select(document.activeElement);
          }
        }, true);
        const refresh = () => {
          if ((this.picking || this.dialog.open) && this.selected)
            this.drawHighlight(this.selected);
        };
        this.listen(global, "resize", refresh, { passive: true });
        this.listen(document, "scroll", refresh, { capture: true, passive: true });
      }
      applyConfig() {
        this.root.dataset.position = this.config.position;
        this.root.style.setProperty("--uinotate-offset", this.config.offset);
        this.nodes.forEach((node) => {
          Array.from(node.style).filter((key) => key.startsWith("--uinotate-") && key !== "--uinotate-offset").forEach((key) => node.style.removeProperty(key));
          node.style.setProperty("--uinotate-z-index", String(this.config.zIndex));
          Object.entries(this.config.theme).forEach(([key, value]) => {
            if (key.startsWith("--uinotate-") && key !== "--uinotate-z-index" && key !== "--uinotate-offset")
              node.style.setProperty(key, String(value));
          });
        });
      }
      update(options) {
        if (this.destroyed)
          throw new Error("Uinotate: this instance has been destroyed.");
        const previousCapture = this.config.captureScreenshot;
        this.config = normalize(Object.assign({}, this.config, options));
        this.applyConfig();
        if (previousCapture !== this.config.captureScreenshot && this.currentType === "annotation" && this.selected && !this.busy) {
          this.saveDraft();
          this.cancelCapture();
          this.screenshot = null;
          this.renderForm("annotation", this.drafts.annotation.message, this.drafts.annotation.category);
          if (this.config.captureScreenshot)
            this.captureSelection();
        }
        return this;
      }
      expand(open = true) {
        if (this.destroyed)
          return;
        global.clearTimeout(this.closeTimer);
        if (this.picking || this.dialog.open)
          open = false;
        this.root.classList.toggle("uinotate-open", open);
        this.launcher.setAttribute("aria-expanded", String(open));
        this.menu.toggleAttribute("inert", !open);
      }
      scheduleCollapse() {
        global.clearTimeout(this.closeTimer);
        this.closeTimer = global.setTimeout(() => {
          if (!this.root.matches(":hover") && !this.root.contains(document.activeElement))
            this.expand(false);
        }, 240);
      }
      heading(title, description) {
        const heading = element("h2", "uinotate-heading", title);
        heading.id = this.id + "-title";
        this.content.append(heading);
        if (description) {
          const subtitle = element("p", "uinotate-description", description);
          subtitle.id = this.id + "-description";
          this.dialog.setAttribute("aria-describedby", subtitle.id);
          this.content.append(subtitle);
        } else
          this.dialog.removeAttribute("aria-describedby");
      }
      showDialog() {
        this.expand(false);
        if (!this.dialog.open)
          this.dialog.showModal();
      }
      closeDialog() {
        if (this.busy)
          return;
        this.saveDraft();
        this.dialog.close();
        this.highlight.hidden = true;
        this.launcher.focus({ preventScroll: true });
        this.expand(false);
      }
      openFeedback() {
        if (this.destroyed || this.busy)
          return;
        this.saveDraft();
        this.cancelCapture();
        this.stopAnnotation(false);
        this.selected = null;
        this.renderForm("feedback", this.drafts.feedback.message);
      }
      renderForm(type, draft = "", categoryValue = "style") {
        this.clearView();
        this.currentType = type;
        this.heading(type === "annotation" ? "Make it better, right here." : this.config.title, type === "annotation" ? "Tell us what you noticed about this element." : "An idea, a rough edge, or something you love. We’re listening.");
        if (type === "annotation" && this.selected) {
          const target = element("div", "uinotate-target");
          target.append(icon("target"));
          const details = element("div", "uinotate-target-details");
          details.append(element("span", "uinotate-eyebrow", "SELECTED ELEMENT"), element("code", "uinotate-selector", selectorFor(this.selected)));
          const change = this.changeTargetButton = element("button", "uinotate-text-button", "Change");
          change.type = "button";
          this.listenView(change, "click", () => this.startAnnotation({ message: this.textarea.value, category: this.category.value }));
          target.append(details, change);
          this.content.append(target);
          if (this.config.captureScreenshot)
            this.renderScreenshot();
        }
        const form = element("form", "uinotate-form");
        if (type === "annotation") {
          const label = element("label", "uinotate-label", "What is this about?");
          label.htmlFor = this.id + "-category";
          const category = this.category = element("select", "uinotate-select");
          category.id = label.htmlFor;
          [["style", "Visual style"], ["layout", "Layout & positioning"], ["content", "Content"], ["interaction", "Interaction"], ["other", "Something else"]].forEach(([value, text]) => {
            const option = element("option", "", text);
            option.value = value;
            category.append(option);
          });
          category.value = categoryValue;
          form.append(label, category);
        }
        const label = element("label", "uinotate-label", type === "annotation" ? "Your annotation" : "Your feedback");
        label.htmlFor = this.id + "-message";
        const textarea = this.textarea = element("textarea", "uinotate-textarea");
        textarea.id = label.htmlFor;
        textarea.placeholder = type === "annotation" ? "This button feels a little out of place because…" : "I noticed that…";
        textarea.required = true;
        textarea.maxLength = this.config.maxLength;
        textarea.rows = 5;
        textarea.value = draft;
        const meta = element("div", "uinotate-field-meta");
        const hint = element("span", "", "Please avoid sharing sensitive information.");
        hint.id = this.id + "-hint";
        textarea.setAttribute("aria-describedby", hint.id);
        const count = element("span", "uinotate-character-count", draft.length + " / " + this.config.maxLength);
        meta.append(hint, count);
        const status = this.status = element("p", "uinotate-status");
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        status.hidden = true;
        const footer = element("div", "uinotate-form-footer");
        const context = element("span", "uinotate-context-note", type === "annotation" ? "Element details included" : "Page context included");
        const submit = this.submitButton = element("button", "uinotate-primary-button", "Send " + (type === "annotation" ? "annotation" : "feedback"));
        submit.type = "submit";
        submit.append(icon("arrow"));
        footer.append(context, submit);
        form.append(label, textarea, meta, status, footer);
        this.content.append(form);
        this.updateScreenshotView();
        this.listenView(textarea, "input", () => {
          textarea.setCustomValidity("");
          count.textContent = textarea.value.length + " / " + this.config.maxLength;
        });
        this.listenView(form, "submit", (event) => {
          event.preventDefault();
          if (!textarea.value.trim()) {
            textarea.setCustomValidity("Please write a message before sending.");
            textarea.reportValidity();
            return;
          }
          this.submit(type);
        });
        this.showDialog();
        textarea.focus({ preventScroll: true });
      }
      openAbout() {
        if (this.destroyed || this.busy)
          return;
        this.saveDraft();
        this.cancelCapture();
        this.stopAnnotation(false);
        this.selected = null;
        this.clearView();
        this.currentType = null;
        this.heading("Small widget. Better experiences.", "Uinotate gives your feedback a place to land.");
        const about = element("div", "uinotate-about");
        [["feedback", "Quick feedback", "Share a thought about the page."], ["annotate", "Point to the detail", "Choose an element and tell us what could improve."]].forEach(([name, title, text]) => {
          const row = element("div", "uinotate-about-row");
          const copy = element("div");
          copy.append(element("strong", "", title), element("p", "", text));
          row.append(icon(name), copy);
          about.append(row);
        });
        about.append(element("p", "uinotate-about-privacy", "When you send, this widget shares your message and page context with this website’s configured feedback service. Annotations also include element details and, if attached, a screenshot of its visible content."));
        const footer = element("div", "uinotate-about-footer");
        footer.append(element("span", "", "Uinotate · v" + VERSION), element("span", "", "Made for the little details."));
        this.content.append(about, footer);
        this.showDialog();
      }
      eligible(node) {
        return node instanceof global.Element && !this.owned(node) && !["html", "body", "script", "style", "link", "meta", "head", "template"].includes(node.localName) && node.isConnected && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
      }
      startAnnotation(draft) {
        if (this.destroyed || this.busy)
          return;
        this.saveDraft();
        this.cancelCapture();
        this.screenshot = null;
        this.annotationDraft = draft || this.drafts.annotation;
        if (this.dialog.open)
          this.dialog.close();
        this.selected = null;
        this.highlight.hidden = true;
        this.expand(false);
        this.picking = true;
        this.picker.hidden = false;
        this.root.classList.add("uinotate-picking");
        this.live.textContent = "Selection mode. Click an element, or Tab to it and press Enter. Press Escape to cancel.";
        const bodyTabIndex = document.body.getAttribute("tabindex");
        document.body.setAttribute("tabindex", "-1");
        document.body.focus({ preventScroll: true });
        if (bodyTabIndex === null)
          document.body.removeAttribute("tabindex");
        else
          document.body.setAttribute("tabindex", bodyTabIndex);
      }
      stopAnnotation(restoreFocus = false) {
        this.picking = false;
        this.picker.hidden = true;
        this.highlight.hidden = true;
        this.root.classList.remove("uinotate-picking");
        this.live.textContent = "";
        if (restoreFocus) {
          this.live.textContent = "Element selection cancelled.";
          this.launcher.focus({ preventScroll: true });
          this.expand(false);
        }
      }
      preview(node) {
        if (!this.eligible(node)) {
          this.selected = null;
          this.highlight.hidden = true;
          return;
        }
        this.selected = node;
        this.drawHighlight(node);
      }
      drawHighlight(node) {
        if (!node.isConnected) {
          this.highlight.hidden = true;
          return;
        }
        const rect = node.getBoundingClientRect();
        Object.assign(this.highlight.style, { left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", height: rect.height + "px" });
        this.highlightLabel.textContent = node.localName + (node.id ? "#" + node.id : "") + " · " + Math.round(rect.width) + " × " + Math.round(rect.height);
        this.highlightLabel.classList.toggle("uinotate-highlight-label--below", rect.top < 36);
        this.highlight.hidden = false;
      }
      select(node) {
        const draft = this.annotationDraft || this.drafts.annotation;
        this.stopAnnotation(false);
        this.selected = node;
        this.cancelCapture();
        this.screenshot = this.config.captureScreenshot ? { status: "pending", include: true } : null;
        this.annotationContext = this.elementContext(node);
        this.drawHighlight(node);
        this.renderForm("annotation", draft.message, draft.category);
        if (this.config.captureScreenshot)
          this.captureSelection();
      }
      renderScreenshot() {
        const box = this.screenshotBox = element("div", "uinotate-screenshot");
        const header = element("div", "uinotate-screenshot-header");
        const label = element("label", "uinotate-screenshot-toggle");
        const toggle = this.screenshotToggle = element("input");
        toggle.type = "checkbox";
        toggle.checked = true;
        label.append(toggle, document.createTextNode("Attach element screenshot"));
        const retake = this.retakeButton = element("button", "uinotate-text-button", "Retake");
        retake.type = "button";
        header.append(label, retake);
        const preview = this.screenshotPreview = element("img", "uinotate-screenshot-preview");
        preview.alt = "Screenshot preview of the selected element";
        preview.hidden = true;
        const status = this.screenshotStatus = element("p", "uinotate-screenshot-status");
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        box.append(header, preview, status);
        this.content.append(box);
        this.listenView(toggle, "change", () => {
          if (this.screenshot)
            this.screenshot.include = toggle.checked;
          this.updateScreenshotView();
        });
        this.listenView(retake, "click", () => this.captureSelection());
      }
      updateScreenshotView() {
        if (this.currentType !== "annotation" || !this.screenshotBox?.isConnected)
          return;
        const state = this.screenshot;
        this.screenshotBox.hidden = !this.config.captureScreenshot;
        this.screenshotToggle.checked = Boolean(state?.include);
        this.screenshotToggle.disabled = this.busy || state?.status === "excluded" || state?.status === "error";
        this.retakeButton.disabled = this.busy || state?.status === "pending" || state?.status === "excluded";
        this.screenshotPreview.hidden = state?.status !== "ready" || !state.include;
        if (state?.status === "ready") {
          const shot = state.attachment;
          this.screenshotPreview.src = shot.dataUrl;
          this.screenshotStatus.textContent = state.include ? "PNG · " + shot.width + " × " + shot.height + " · " + Math.max(1, Math.ceil(shot.byteLength / 1024)) + " KB. Check the preview before sending." : "Screenshot left out of this annotation.";
        } else if (state?.status === "error" || state?.status === "excluded") {
          this.screenshotPreview.removeAttribute("src");
          this.screenshotStatus.textContent = state.error + " You can still send your annotation.";
        } else
          this.screenshotStatus.textContent = state?.include ? "Capturing selected element…" : "Screenshot left out of this annotation.";
        if (this.submitButton?.isConnected)
          this.submitButton.disabled = this.busy || Boolean(state?.status === "pending" && state.include);
      }
      cancelCapture() {
        this.captureRevision++;
        this.captureController?.abort();
        this.captureController = null;
        this.capturePromise = null;
      }
      captureSelection() {
        if (this.destroyed || this.busy || !this.selected || !this.config.captureScreenshot)
          return Promise.resolve();
        this.cancelCapture();
        const revision = this.captureRevision;
        const node = this.selected;
        const config = this.config;
        if (!canCapture(node)) {
          this.screenshot = { status: "excluded", include: false, error: "Screenshot excluded for form fields, editable content, iframes, or private elements." };
          this.updateScreenshotView();
          return Promise.resolve();
        }
        this.annotationContext = this.elementContext(node);
        this.screenshot = { status: "pending", include: true };
        this.updateScreenshotView();
        const controller = new AbortController;
        this.captureController = controller;
        let timer;
        let onAbort;
        this.capturePromise = (async () => {
          try {
            const cancelled = new Promise((resolve, reject) => {
              onAbort = () => reject(new Error("Screenshot capture was interrupted."));
              controller.signal.addEventListener("abort", onAbort, { once: true });
            });
            const deadline = new Promise((resolve, reject) => {
              timer = global.setTimeout(() => {
                reject(new Error("Screenshot capture took too long."));
                controller.abort();
              }, config.screenshotTimeout);
            });
            const attachment = await Promise.race([captureElement(node, config, { signal: controller.signal }, config.screenshotRenderer || undefined), deadline, cancelled]);
            if (this.destroyed || revision !== this.captureRevision)
              return;
            this.screenshot = { status: "ready", include: this.screenshot.include, attachment };
          } catch (error) {
            if (this.destroyed || revision !== this.captureRevision)
              return;
            this.screenshot = { status: "error", include: false, error: "Couldn’t capture this element. Try Retake or leave the screenshot out." };
          } finally {
            global.clearTimeout(timer);
            if (onAbort)
              controller.signal.removeEventListener("abort", onAbort);
            if (!this.destroyed && revision === this.captureRevision) {
              this.captureController = null;
              this.updateScreenshotView();
            }
          }
        })();
        return this.capturePromise;
      }
      elementContext(node) {
        const target = {
          selector: selectorFor(node),
          tagName: node.localName,
          id: node.id || null,
          classes: Array.from(node.classList),
          rect: rectFor(node)
        };
        if (this.config.collectStyles) {
          const style = global.getComputedStyle(node);
          target.styles = Object.fromEntries(STYLE_PROPERTIES.map((key) => [key, style.getPropertyValue(key)]));
        }
        if (this.config.includeElementText && !node.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") && !node.querySelector("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) {
          target.text = (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300);
        }
        return target;
      }
      payload(type) {
        const payload = {
          schemaVersion: 1,
          id: global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : "uinotate-" + Date.now() + "-" + Math.random().toString(36).slice(2),
          type,
          message: this.textarea.value.trim(),
          category: type === "annotation" ? this.category.value : "general",
          createdAt: new Date().toISOString(),
          page: {
            url: global.location.origin + global.location.pathname,
            title: document.title,
            viewport: { width: global.innerWidth, height: global.innerHeight, devicePixelRatio: global.devicePixelRatio },
            scroll: { x: global.scrollX, y: global.scrollY }
          },
          metadata: JSON.parse(JSON.stringify(this.config.metadata))
        };
        if (type === "annotation") {
          if (!this.selected || !this.selected.isConnected)
            throw new Error("That element is no longer on the page. Please select it again.");
          const target = payload.element = JSON.parse(JSON.stringify(this.annotationContext || this.elementContext(this.selected)));
          if (this.config.captureScreenshot && this.screenshot?.include && this.screenshot.status === "ready")
            target.screenshot = { ...this.screenshot.attachment };
        }
        return payload;
      }
      async submit(type) {
        if (this.busy || this.destroyed)
          return;
        if (type === "annotation" && this.screenshot?.include && this.screenshot.status === "pending") {
          await this.capturePromise;
          if (this.busy || this.destroyed || this.currentType !== "annotation")
            return;
        }
        const submitConfig = this.config;
        this.busy = true;
        this.closeButton.disabled = true;
        this.dialog.setAttribute("aria-busy", "true");
        this.submitButton.disabled = true;
        this.textarea.disabled = true;
        if (type === "annotation")
          this.category.disabled = true;
        if (type === "annotation") {
          this.changeTargetButton.disabled = true;
          this.updateScreenshotView();
        }
        this.submitButton.replaceChildren(element("span", "uinotate-spinner"), document.createTextNode("Sending…"));
        this.status.hidden = true;
        const controller = new AbortController;
        this.request = controller;
        let timedOut = false;
        let timeout;
        let abortHandler;
        try {
          const payload = this.payload(type);
          const operation = (async () => {
            if (submitConfig.onSubmit)
              return await submitConfig.onSubmit(payload, { signal: controller.signal });
            if (!submitConfig.apiUrl)
              throw new Error("Feedback isn’t connected yet. Please configure apiUrl or onSubmit.");
            const headers = new Headers(submitConfig.headers);
            headers.set("Content-Type", "application/json");
            const token = typeof submitConfig.token === "function" ? await submitConfig.token() : submitConfig.token;
            if (controller.signal.aborted)
              throw new DOMException("Aborted", "AbortError");
            if (token)
              headers.set("Authorization", "Bearer " + token);
            const response = await global.fetch(submitConfig.apiUrl, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
              signal: controller.signal,
              credentials: "omit",
              referrerPolicy: "no-referrer"
            });
            if (!response.ok)
              throw new Error("The feedback service returned HTTP " + response.status + ". Please try again.");
            return response;
          })();
          const deadline = new Promise((resolve, reject) => {
            timeout = global.setTimeout(() => {
              timedOut = true;
              controller.abort();
              reject(new Error("Sending took too long. Your message is still here; please try again."));
            }, submitConfig.requestTimeout);
          });
          const cancelled = new Promise((resolve, reject) => {
            abortHandler = () => reject(new DOMException("Aborted", "AbortError"));
            if (controller.signal.aborted)
              abortHandler();
            else
              controller.signal.addEventListener("abort", abortHandler, { once: true });
          });
          const result = await Promise.race([operation, deadline, cancelled]);
          if (this.destroyed)
            return;
          this.drafts[type] = { message: "", category: "style" };
          this.renderSuccess();
          this.dispatch("success", { payload, result });
          this.notify(submitConfig.onSuccess, payload, result);
        } catch (error) {
          if (this.destroyed)
            return;
          const message = timedOut ? "Sending took too long. Your message is still here; please try again." : error instanceof TypeError ? "Couldn’t reach the feedback service. Check your connection and try again." : error.message || "Couldn’t send your feedback. Please try again.";
          this.status.textContent = message;
          this.status.hidden = false;
          this.status.setAttribute("role", "alert");
          this.dispatch("error", { error });
          this.notify(submitConfig.onError, error);
        } finally {
          global.clearTimeout(timeout);
          if (abortHandler)
            controller.signal.removeEventListener("abort", abortHandler);
          this.request = null;
          this.busy = false;
          this.closeButton.disabled = false;
          this.dialog.removeAttribute("aria-busy");
          if (!this.destroyed && this.textarea.isConnected) {
            this.textarea.disabled = false;
            if (type === "annotation")
              this.category.disabled = false;
            if (type === "annotation")
              this.changeTargetButton.disabled = false;
            this.submitButton.disabled = false;
            this.submitButton.replaceChildren(document.createTextNode("Send " + (type === "annotation" ? "annotation" : "feedback")), icon("arrow"));
            if (!this.status.hidden)
              this.textarea.focus({ preventScroll: true });
            if (type === "annotation")
              this.updateScreenshotView();
          }
        }
      }
      renderSuccess() {
        this.cancelCapture();
        this.screenshot = null;
        this.highlight.hidden = true;
        this.clearView();
        this.currentType = null;
        const mark = element("div", "uinotate-success-mark");
        mark.append(icon("check"));
        this.content.append(mark);
        this.heading("Thanks for the nudge.", "Your feedback has been sent. Little details make a big difference.");
        const done = element("button", "uinotate-primary-button uinotate-done", "Back to the page");
        done.type = "button";
        this.listenView(done, "click", () => this.closeDialog());
        this.content.append(done);
        done.focus({ preventScroll: true });
      }
      notify(callback, ...args) {
        if (!callback)
          return;
        try {
          Promise.resolve(callback(...args)).catch((error) => global.console.error("Uinotate callback failed:", error));
        } catch (error) {
          global.console.error("Uinotate callback failed:", error);
        }
      }
      dispatch(name, detail) {
        this.root.dispatchEvent(new CustomEvent("uinotate:" + name, { detail, bubbles: true }));
      }
      destroy() {
        if (this.destroyed)
          return;
        this.destroyed = true;
        global.clearTimeout(this.closeTimer);
        if (this.request)
          this.request.abort();
        this.cancelCapture();
        this.listeners.splice(0).forEach((remove) => remove());
        this.viewListeners.splice(0).forEach((remove) => remove());
        if (this.dialog.open)
          this.dialog.close();
        this.nodes.forEach((node) => node.remove());
        if (active === this)
          active = null;
      }
    }
    const api = {
      version: VERSION,
      init(options = {}) {
        if (!document.body)
          throw new Error("Uinotate: call init after the body exists, or load lib.js with defer.");
        normalize(options);
        if (active)
          active.destroy();
        active = new Widget(options);
        return active;
      },
      destroy() {
        if (active)
          active.destroy();
      },
      get instance() {
        return active;
      }
    };
    global.Uinotate = api;
    const script = document.currentScript;
    if (script && script.hasAttribute("data-uinotate-auto") && script.dataset.uinotateAuto !== "false") {
      const start = () => {
        if (active)
          return;
        const options = Object.assign({}, global.UinotateConfig || {});
        if (script.dataset.position)
          options.position = script.dataset.position;
        if (script.dataset.offset)
          options.offset = script.dataset.offset;
        if (script.dataset.endpoint)
          options.apiUrl = script.dataset.endpoint;
        api.init(options);
      };
      if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", start, { once: true });
      else
        start();
    }
  })(window);
})();
