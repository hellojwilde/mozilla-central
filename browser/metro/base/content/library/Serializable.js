/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

dump("### Serializable.js loaded\n");

/**
 * A value object that can be easily serialized into a String for
 * passing around and storing.
 *
 * @constructor
 */
function Serializable() {}

/**
 * Returns a string representing the object.
 *
 * @returns {String} String representing the object.
 */
Serializable.prototype.serialize = function S_serialize() {
  return JSON.stringify(this);
}

/**
 * Compares two Serializable instances to determine if they are
 * equal in terms of value.
 *
 * @returns {Boolean} True if equal, false if not.
 */
Serializable.prototype.equals = function S_equals(aOther) {
  let isEqual = true;
  for (let key in this) {
    if (this.hasOwnProperty(key)) {
      if (this[key] instanceof Serializable) {
        isEqual = isEqual && this[key].equals(aOther[key]);
      } else {
        isEqual = isEqual && this[key] == aOther[key];
      }
    }
  }
  return isEqual;
}

/**
 * Represents a node that we're trying to remember in a document.
 * There's no real global ID system for nodes in a document right now
 * and page structures change regularly.
 *
 * `SerializableNode` objects are essentially value objects representing nodes.
 * We consider nodes equivalent if the properties we track are all equal.
 *
 * They're pretty easy to serialize into JSON
 *
 * @constructor
 * @param {Node | Object} aNode  Node or object to wrap.
 */
function SerializableNode(aNode) {
  this.nodeType = aNode.nodeType;
  this.tagName = aNode.tagName;
  this.textContent = aNode.textContent;
}

SerializableNode.prototype = new Serializable;

/**
 * Finds the node in the current document that looks like the one we saw.
 * This method is slow. Use it sparingly.
 *
 * @param {Document} aDocument  The document to find the node in.
 */
SerializableNode.prototype.getNode = function SN_getNode(aDocument) {
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
 * Represents a DOM Range in a document that we're trying to track.
 *
 * @constructor
 * @param {Range | Object} aRange  Range or object to wrap.
 */
function SerializableRange(aRange) {
  this.startContainer = new SerializableNode(aRange.startContainer);
  this.startOffset = aRange.startOffset;
  this.endContainer = new SerializableNode(aRange.endContainer);
  this.endOffset = aRange.endOffset;
  this.string = aRange.string || aRange.toString();
}

SerializableRange.prototype = new Serializable;

/**
 * Finds the range in the current document that looks like the one that we saw.
 * Slow (because of `SerializableNode` node lookups. Use sparingly.
 * Currently seems to fail on ranges where the start and end nodes
 * are not under an immediate parent.
 *
 * @param {Document} aDocument  HTML document object serving as reference.
 * @returns {Range}             Associated DOM Range, if one exists.
 *                              Null otherwise.
 */
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
