/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

dump("### Serializable.js loaded\n");

/**
 * Represents a node that we're trying to remember in a document.
 * There's no real global ID system for nodes in a document right now
 * and page structures change regularly.
 *
 * This class tries to record what a node looked like. It can fetch a node in
 * the current version of the document that looks like that.
 *
 * @param {Node | Object} aNode  Node or object to wrap.
 */
function SerializableNode(aNode) {
  this.nodeType = aNode.nodeType;
  this.tagName = aNode.tagName;
  this.textContent = aNode.textContent;
}

/**
 * Finds the node in the current document that looks like the one we saw.
 * This method is slow. Use it sparingly.
 *
 * @param {Document} aDocument  The document to find the node in.
 */
SerializableNode.prototype.getNode = function RN_getNode(aDocument) {
  let doc = aDocument || document;
  let win = doc.defaultView;
  let walker = doc.createTreeWalker(
    doc.body,
    this.nodeType == win.Node.TEXT_NODE ? win.NodeFilter.SHOW_TEXT
                                        : win.NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function (aNode) {
        if (aNode.tagName == this.tagName
            && aNode.textContent == this.textContent) {
          return win.NodeFilter.FILTER_ACCEPT
        } else {
          return win.NodeFilter.FILTER_SKIP;
        }
      }.bind(this)
    },
    false
  );

  return walker.nextNode();
};

/**
 * Represents a text selection range in a document that's serializable to JSON.
 *
 * @param {Range | Object} Range  Range or object to wrap.
 */
function SerializableRange(aRange) {
  this.startContainer = new SerializableNode(aRange.startContainer);
  this.startOffset = aRange.startOffset;
  this.endContainer = new SerializableNode(aRange.endContainer);
  this.endOffset = aRange.endOffset;
  this.string = aRange.string || aRange.toString();
}

SerializableRange.prototype.getRange = function SR_getRange (aDocument) {
  let doc = aDocument || document;
  let startNode = this.startContainer.getNode(doc);
  let endNode = this.endContainer.getNode(doc);

  if (!startNode || !endNode) {
    return null;
  }

  let range = doc.createRange();
  range.setStart(startNode, this.startOffset);
  range.setEnd(endNode, this.endOffset);
  return range;
};
