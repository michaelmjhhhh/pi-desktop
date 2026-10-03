import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const { downloadMermaidSvg } = await jiti.import("./MermaidBlock.tsx");

test("downloadMermaidSvg downloads XML-serialized SVG and releases its URL", async () => {
  const originalDocument = globalThis.document;
  const originalXMLSerializer = globalThis.XMLSerializer;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const svgElement = { nodeName: "svg" };
  const serializedSvg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">first<br />second</div></foreignObject></svg>';
  const link = { href: "", download: "", clicked: false, click() { this.clicked = true; } };
  let downloadedBlob;
  globalThis.document = { createElement: () => link };
  globalThis.XMLSerializer = class {
    serializeToString(element) {
      assert.equal(element, svgElement);
      return serializedSvg;
    }
  };
  URL.createObjectURL = (blob) => {
    assert.equal(blob.type, "image/svg+xml;charset=utf-8");
    downloadedBlob = blob;
    return "blob:mermaid";
  };
  let revoked = null;
  URL.revokeObjectURL = (url) => { revoked = url; };

  try {
    downloadMermaidSvg(svgElement);
    assert.equal(await downloadedBlob.text(), serializedSvg);
    assert.equal(link.href, "blob:mermaid");
    assert.equal(link.download, "mermaid-diagram.svg");
    assert.equal(link.clicked, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(revoked, "blob:mermaid");
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalXMLSerializer === undefined) delete globalThis.XMLSerializer;
    else globalThis.XMLSerializer = originalXMLSerializer;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
