// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("resource://gre/modules/Microformats.js");

dump("### SnippetsHandler.js loaded\n");

function Snippet(aType) {
  this.snippet = aType;
}

function ImageSnippet(aURI, aWidth, aHeight, aCaption) {
  this.uri = aURI;
  this.width = aWidth;
  this.height = aHeight;
  this.caption = aCaption;
}
ImageSnippet.prototype = new Snippet("Image");

function SummarySnippet(aTitle, aDesc, aImageSnippet) {
  this.title = aTitle;
  this.desc = aDesc;
  this.imageSnippet = aImageSnippet;
}
SummarySnippet.prototype = new Snippet("Summary");

function RecipeSnippet(aSummarySnippet, aIngredients, aInstructions, aYield, aDuration) {
  this.summarySnippet = aSummarySnippet;
  this.ingredients = aIngredients;
  this.instructions = aInstructions;
  this.yield = aYield;
  this.duration = aDuration;
}
RecipeSnippet.prototype = new Snippet("Recipe");

let SnippetsHandler = {
  init: function init() {
    addEventListener("DOMWindowCreated", this, false);
    addEventListener("DOMMetaAdded", this, false);
    addEventListener("DOMContentLoaded", this, false);
    addEventListener("pageshow", this, false);
  },

  handleEvent: function handleEvent(aEvent) {
    let target = aEvent.originalTarget;
    let isRootDocument = (target == content.document ||
                          target.ownerDocument == content.document);
    if (!isRootDocument)
      return;

    switch (aEvent.type) {
      case "DOMWindowCreated":
        this.resetMetadata();
        break;

      case "DOMMetaAdded":
        if (target.name == "viewport")
          this.updateMetadata();
        break;

      case "DOMContentLoaded":
      case "pageshow":
        this.updateMetadata();
        break;
    }
  },

  resetMetadata: function resetMetadata() {
    sendAsyncMessage("Browser:Snippets", {});
  },

  updateMetadata: function updateMetadata() {
    sendAsyncMessage("Browser:Snippets", this.getSnippets());
  },

  providers: {},

  getSnippetsForType: function getSnippetsForType(aType, aElement) {
    let providers = this.providers[aType];
    let snippets = providers.reduce((aArr, aProviderFn) =>
                              aArr.concat(aProviderFn(aElement) || []), []);
    return snippets;
  },

  getSnippets: function getSnippets(aElement) {
    let element = aElement || content.document;
    let snippets = {};
    for (let type in this.providers) {
      snippets[type] = this.getSnippetsForType(type, element);
    }
    return snippets;
  }
};

SnippetsHandler.providers.ImageSnippet = [
  function basic(aElement) {
    let snippets = [];
    let tags = aElement.getElementsByTagName("img");
    for (let tag of tags) {
      let rect = tag.getBoundingClientRect();
      let width = Math.min(rect.width, rect.naturalWidth);
      let height = Math.min(rect.height, rect.naturaHeight);
      if (tag.naturalWidth > 250 && tag.naturalHeight > 150) {
        snippets.push(new ImageSnippet(tag.src, tag.naturalWidth,
                                       tag.naturalHeight, tag.alt));
      }
    }
    return snippets;
  },

  function ogp(aElement) {
    let snippets = [];
    let image = null;
    let tags = aElement.getElementsByTagName("meta");
    for (let tag of tags) {
      switch (tag.getAttribute("property")) {
        case "og:image":
        case "og:image:url":
          // XXX Not sure whether it's really defined in OGP as to what tags
          // implicitly construct snippets and what ones add new data.
          image = new ImageSnippet(tag.content);
          snippets.push(image);
          break;
        case "og:image:width":
          if (image) {
            image.width = tag.content;
          }
          break;
        case "og:image:height":
          if (image) {
            image.height = tag.content;
          }
          break;
      }
    }
    return snippets;
  }
];

let hRecipe = function(aNode, aValidate) {
  if (aNode) {
    Microformats.parser.newMicroformat(this, aNode, "hRecipe", aValidate);
  }
};

hRecipe.prototype.toString = function() {
  return this.fn;
};

let hRecipe_definition = {
  mfObject: hRecipe,
  className: "hrecipe",
  required: ["fn"],
  properties: {
    "fn": {
      required: true
    },
    "ingredient": {
      subproperties: {
        "type": {},
        "value": {}
      },
      required: true,
      plural: true
    },
    "yield": {},
    "instructions": {
      datatype: "HTML"
    },
    "duration": {},
    "photo": {
      plural: true,
      datatype: "anyURI"
    },
    "summary": {},
    "author": {
      plural: true,
      datatype: "microformat",
      microformat: "hCard"
    },
    "published": {
      datatype: "dateTime"
    },
    "nutrition": {
      subproperties: {
        "type": {},
        "value": {}
      },
      plural: true
    },
    "tag": {
      plural: true,
      datatype: "microformat",
      microformat: "tag",
      microformat_property: "tag"
    },
    "license": {}
  }
};

Microformats.add("hRecipe", hRecipe_definition);

SnippetsHandler.providers.RecipeSnippet = [
  function microformats(aElement) {
    let recipes = Microformats.get("hRecipe", aElement);
    return recipes.map(function (aRecipe) {
      let summary = new SummarySnippet(aRecipe.fn, aRecipe.summary);
      if (aRecipe.photo && aRecipe.photo.length > 0) {
        summary.imageSnippet = new ImageSnippet(aRecipe.photo[0]);
      }
      return new RecipeSnippet(summary, aRecipe.ingredients,
                               aRecipe.instructions, aRecipe.yield,
                               aRecipe.duration);
    });
  }
];

SnippetsHandler.init();