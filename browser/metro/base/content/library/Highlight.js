/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

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
  this.tagName = aNode.tagName;
  this.textContent = aNode.textContent;
}

/**
 * Finds the node in the current document that looks like the one we saw.
 * This method is likely going to be slow. Use sparingly.
 *
 * @param {Document} aDocument  The document to find the node in.
 */
SerializableNode.prototype.getNode = function RN_getNode(aDocument) {
  let doc = aDocument || document;
  for (let node of doc.getElementsByTagName(this.tagName)) {
    if (node.textContent == this.textContent) {
      return node;
    }
  }
  return null;
};

/**
 * Represents a highlighted region in a web page.
 * See the Range documentation for details on what each of the arguments means.
 *
 * @param {SerializableNode}  aAnchorNode
 * @param {Number}            aAnchorOffset
 * @param {SerializableNode}  aFocusNode
 * @param {Number}            aFocusOffset
 */
function Highlight(aAnchorNode, aAnchorOffset, aFocusNode, aFocusOffset) {
  if (!(aAnchorNode instanceof SerializableNode
        && aFocusNode instanceof SerializableNode)) {
    throw "focus and anchor nodes must be SerializableNodes";
  }

  this.anchorNode = aAnchorNode;
  this.anchorOffset = aAnchorOffset;
  this.focusNode = aFocusNode;
  this.focusOffset = aFocusOffset;
}

Highlight.prototype = {
  getRange: function H_getRange (aDocument) {
    let startNode = this.anchorNode.getNode();
    let endNode = this.focusNode.getNode();

    if (!startNode || !endNode) {
      return null;
    }

    let doc = aDocument || document;
    let range = doc.createRange();

    range.setStart(startNode, this.anchorOffset);
    range.setEnd(endNode. this.focusOffset);

    return range;
  },

  /**
   * Displays the highlight in the specified document.
   *
   * @param {Document} aDocument  The document to render the highlight in.
   * @returns {String} An ID of highlight that can be used later to
   *                   find and unapply it.
   */
  apply: function H_apply(aDocument) {
    let doc = aDocument || document;
    let id = "highlight" + Date.now() + "-" + Math.random();

    let highlight = document.createElement("moz-highlight");
    highlight.id = id;
    this.getRange(doc).surroundContents(highlight);

    return id;
  },

  /**
   * Removes the highlight from the specified document.
   *
   * @param {Document}  aDocument  The document to remove the highlight from.
   * @param {String}    aId        The id of the applied highlight to remove.
   */
  unapply: function H_unapply(aDocument, aId) {
    let doc = aDocument || document;
    let highlight = doc.getElementById(aId);

    let parent = highlight.parentNode;
    for (let child of highlight.childNodes) {
      parent.insertBefore(child, highlight);
    }
    parent.removeChild(highlight);
  }
};