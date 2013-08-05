/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

dump("### SnippetsHandler.js loaded\n");

function ImageSnippet(aURL, aCaption) {
  this.url = aURL;
  this.caption = aCaption;
  this.width = null;
  this.height = null;
}

let SnippetsHandler = {
  consumers: {},

  init: function Snippets_init() {
    addEventListener("DOMWindowCreated", this, false);
    addEventListener("load", this, false);
    addEventListener("DOMContentLoaded", this, false);
    addEventListener("pageshow", this, false);
  },

  handleEvent: function Snippets_handleEvent(aEvent) {
    let target = aEvent.originalTarget;
    let isRootDocument = (target == content.document ||
                          target.ownerDocument == content.document);
    if (!isRootDocument)
      return;

    Util.dumpLn("trigger: " + aEvent.type);
    switch (aEvent.type) {
      case "DOMWindowCreated":
        this.reset();
        break;

      case "DOMContentLoaded":
      case "pageshow":
      case "load":
        this.update();
        break;
    }
  },

  reset: function Snippets_reset() {
    sendAsyncMessage("Browser:Snippets", {});
  },

  update: function Snippets_update(aSelector) {
    sendAsyncMessage("Browser:Snippets", this.getSnippets());
  },

  getSnippets: function Snippets_getSnippets() {
    let snippets = { images: [], summary: null, author: null };

    // Trying to do large-scale queries for items on the page is rather
    // expensive and we run getSnippets several times per page view.
    // To reduce the load, we pool the results of the selector queries
    // that we perform here so we can reuse them among the different consumers.
    let pool = {};
    let getSelection = function (aSelector) {
      if (!pool[aSelector]) {
        pool[aSelector] = content.document.querySelectorAll(aSelector);
      }
      return pool[aSelector];
    }

    for (let name in this.consumers) {
      let consumer = this.consumers[name];
      let selection = getSelection(consumer.selector);
      for (let tag of selection) {
        let values = consumer.attrs.map(function (aAttrs) {
          // Allows us to retreive multiple attributes (separated in the attrs
          // list with a "|" and merge them into the same field value.
          return Array.reduce(aAttrs.split("|"),
            (aPrev, aAttr) => aPrev ? aPrev : tag.getAttribute(aAttr), false);
        });

        consumer.processor.apply(snippets, [tag].concat(values));
      }
    }

    return snippets;
  }
};

SnippetsHandler.consumers.OpenGraph = {
  selector: "meta",
  attrs: ["property", "content"],
  processor: function (aTag, aName, aContent) {
    function setProperty(aField, aValue) {
      let len = this.images.length;
      if (len > 0) {
        this.images[len - 1][aField] = aValue;
      }
    }

    switch(aName) {
      case "og:image":
        this.images.push(new ImageSnippet(aContent));
        break;
      case "og:image:width":
        setProperty("width", parseInt(aContent));
        break;
      case "og:image:height":
        setProperty("height", parseInt(aContent));
        break;
    }
  }
};

SnippetsHandler.init();