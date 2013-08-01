/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

dump("### SnippetsHandler.js loaded\n");

function ImageSnippet(aURL, aWidth, aHeight) {
  this.url = aURL;
  this.width = aWidth;
  this.height = aHeight;
}

function SummarySnippet(aTitle, aDesc) {
  this.title = aTitle;
  this.desc = "";
}

function PersonSnippet(aName) {
  this.name = aName;
}

let SnippetsHandler = {
  consumers: {},

  init: function Snippets_init() {
    addEventListener("DOMWindowCreated", this, false);
    addEventListener("DOMMetaAdded", this, false);
    addEventListener("DOMContentLoaded", this, false);
    addEventListener("pageshow", this, false);
  },

  handleEvent: function Snippets_handleEvent(aEvent) {
    let target = aEvent.originalTarget;
    let isRootDocument = (target == content.document ||
                          target.ownerDocument == content.document);
    if (!isRootDocument)
      return;

    switch (aEvent.type) {
      case "DOMWindowCreated":
        this.reset();
        break;

      case "DOMMetaAdded":
        if (target.name == "viewport")
          this.update();
        break;

      case "DOMContentLoaded":
      case "pageshow":
        this.update();
        break;
    }
  },

  reset: function Snippets_reset() {
    sendAsyncMessage("Browser:Snippets", {});
  },

  update: function Snippets_update(aConsumptionType) {
    sendAsyncMessage("Browser:Snippets", this.getSnippets());
  },

  getSnippets: function Snippets_getSnippets() {
    let snippets = { images: [], summary: null, author: null };

    let pool = {};
    let getSelection = function (aSelector) {
      if (!pool[aSelector]) {
        pool[aSelector] = content.document.querySelectorAll(aSelector);
      }
      return pool[aSelector];
    }

    for (let consumer of consumers) {
      let selection = getSelection(consumer.selector);
      for (let tag of selection) {
        let values = consumer.attrs.map((aAttr) => tag.getAttribute(aAttr));
        consumer.processor.call(snippets, [tag].concat(values));
      }
    }

    return snippets;
  }
};

function setPropertyOnLastItem(aArray, aField, aValue) {
  let len = aArray.length;
  if (len > 0) {
    aArray[len - 1][aField] = aValue;
  }
}

SnippetsHandler.consumers.OpenGraph = {
  selector: "meta",
  attrs: ["name", "content"],
  processor: function (aTag, aName, aContent) {
    switch(aName) {
      case "og:image":
        this.images.push(new ImageSnippet(aContent));
        break;
      case "og:image:width":
        setPropertyOnLastItem(this.images, "width", parseInt(aContent));
        break;
      case "og:image:height":
        setPropertyOnLastItem(this.images, "height", parseInt(aContent));
        break;
    }
  }
};

SnippetsHandler.consumers.Cards = {
  selector: "meta",
  attrs: ["name", "content"],
  processor: function (aTag, aName, aContent) {
    switch (aName) {
      case "twitter:image":
      case "twitter:image0":
      case "twitter:image1":
      case "twitter:image2":
      case "twitter:image3":
        this.images.push(new ImageSnippet(aContent));
        break;
      case "twitter:image:width":
        setPropertyOnLastItem(this.images, "width", parseInt(aContent));
        break;
      case "twitter:image:height":
        setPropertyOnLastItem(this.images, "height", parseInt(aContent));
        break;
    }
  }
};

SnippetsHandler.consumers.Microdata = {
  selector: "meta",
  attrs: ["itemprop", "content"],
  processor: function (aTag, aItemProp, aContent) {
    switch (aName) {
      case "image":
        this.images.push(new ImageSnippet(aContent));
        break;
    }
  }
};

SnippetsHandler.consumers.TouchIcons = {
  selector: "link[rel='apple-touch-icon']",
  attrs: ["href", "sizes"],
  processor: function (aTag, aHref, aSizes) {
    let image = new ImageSnippet(aHref, 57, 57);
    if (aSizes) {
      [image.width, image.height] = String.split(aSizes, "x");
    }
    this.images.push(image);
  }
};

SnippetsHandler.consumers.Images = {
  selector: "image",
  attrs: ["href"],
  processor: function (aTag, aHref) {
    let image = new ImageSnippet(aHref, aTag.naturalWidth, aTag.naturalHeight);
    this.images.push(image);
  }
};

SnippetsHandler.init();