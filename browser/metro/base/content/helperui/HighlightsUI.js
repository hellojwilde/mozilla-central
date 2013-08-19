// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

XPCOMUtils.defineLazyModuleGetter(this, "View",
                                  "resource:///modules/View.jsm");

/**
 * Subclass of PagedFlyout that has an editing mode, preset pages,
 * and state updating.
 */
function HighlightsFlyout(aPanel, aPopup) {
  PagedFlyout.call(this, aPanel, aPopup);

  this._emptyPage = document.getElementById("highlights-empty");
  this._bookmarkPage = document.getElementById("highlights-bookmark");
  this._listPage = document.getElementById("highlights-list");
  this._editButton = document.getElementById("highlights-edit-button");
  this._backButton = document.getElementById("highlights-back-button");

  this.registerPage("empty", new HighlightsEmpty(this, this._emptyPage));
  this.registerPage("bookmark", new HighlightsBookmark(this, this._bookmarkPage));
  this.registerPage("list", new HighlightsList(this, this._listPage));

  this._editButton.addEventListener("click", this.onEditButton.bind(this), false);
  this._backButton.addEventListener("click", this.onBackButton.bind(this), false);
}

HighlightsFlyout.prototype = Util.extend(Object.create(PagedFlyout.prototype), {
  selectPage: function HF_selectPage() {
    let self = this;
    return Task.spawn(function HUI_updateTask() {
      let uri = Browser.selectedBrowser.currentURI;
      let bookmarkId = yield Bookmarks.getForURI(uri);

      self.stopEditing();

      if (bookmarkId == null) {
        self.displayPage("empty");
        return;
      }

      let highlights = Browser.getHighlights(bookmarkId);
      if (highlights.length == 0) {
        self.displayPage("bookmark", { id: bookmarkId });
      } else {
        self.displayPage("list", { id: bookmarkId });
      }
    });
  },

  startEditing: function () {
    this._popup.setAttribute("editing", "true");
    this.realign();
  },

  stopEditing: function () {
    this._popup.removeAttribute("editing");
    this.realign();
  },

  onEditButton: function HUI_onEditButton() {
    this.startEditing();
  },

  onBackButton: function HUI_onBackButton() {
    this.stopEditing();
  }
});

HighlightsFlyout.prototype.constructor = HighlightsFlyout;

/**
 * Controller for "empty" page shown when there is no bookmark or highlights.
 */
function HighlightsEmpty(aFlyout, aPageElement) {
  this._flyout = aFlyout;
  this._page = aPageElement;

  this._markButton = document.getElementById("highlights-bookmark-button");
  this._markButton.addEventListener("click", this.onMarkButton.bind(this), false);
}

HighlightsEmpty.prototype = {
  onMarkButton: function () {
    let self = this;
    return Task.spawn(function HE_onMarkButtonTask () {
      let bookmarkId = yield Browser.starSite();
      self._flyout.displayPage("bookmark", { id: bookmarkId, saved: true });
      self._flyout.realign();
      yield Appbar.update();
    });
  }
};

/**
 * Controller for "bookmark" page shown when there is a bookmark,
 * but no highlights.
 */
function HighlightsBookmark(aFlyout, aPageElement) {
  this._flyout = aFlyout;
  this._page = aPageElement;

  this._removeButton = document.getElementById("highlights-remove-button");
  this._removeButton.addEventListener("command", this.onRemoveButton.bind(this), false);
}

HighlightsBookmark.prototype = {
  get _preview() { return this._page.querySelector("richgriditem"); },

  display: function (aOptions) {
    let { id, saved } = aOptions || {};
    let uri = Browser.selectedBrowser.currentURI;
    let preview = this._preview;

    Util.setBoolAttribute(this._page, "saved", saved);

    preview.label = PlacesUtils.bookmarks.getItemTitle(id);
    preview.url = uri;

    // XXX fragile if View changes
    Util.getFaviconForURI(uri)
        .then((iconURI) => View.prototype._gotIcon(preview, iconURI));
  },

  onRemoveButton: function () {
    let self = this;
    return Task.spawn(function HE_onRemoveButton () {
      yield Browser.unstarSite();
      self._flyout.displayPage("empty");
      self._flyout.realign();
      yield Appbar.update();
    });
  }
};

/**
 * Controller for "list" page shown when there is a bookmark and highlights.
 */
function HighlightsList(aFlyout, aPageElement) {
  this._flyout = aFlyout;
  this._page = aPageElement;

  this._list = this._page.querySelector("richlistbox");
  this._deleteButton = document.getElementById("highlights-delete-button");
  this._deleteButton.addEventListener("click", this.onDeleteButton.bind(this), false);
}

HighlightsList.prototype = {
  _items: [],
  _id: null,

  display: function (aOptions) {
    let { id } = aOptions || {};
    let highlights = Browser.getHighlights(id);

    while (this._list.childNodes.length > 0) {
      this._list.removeChild(this._list.firstChild);
    }

    let items = [];
    for (let highlight of highlights) {
      let item = new HighlightsListItem(highlight);
      items.push(item);

      this._list.appendChild(item.element);
      item.elementCheckbox.addEventListener("command", this.onCheckbox.bind(this))
    }
    this._items = items;

    this.updateDeleteButton();
    this._id = id;
  },
/*
  resize: function () {
    let height = {};
    this._list.scrollBoxObject.getScrolledSize({}, height);

    if (height.value > this._list.clientHeight) {
      let min = (a, b) => a < b ? a : b;
      let rect = this._flyout._popup.getBoundingClientRect();
      let max = rect.bottom - (rect.height - this._list.clientHeight) - 50;

      this._list.height = min(height.value, max);
      Util.dumpLn("h " + height.value + " ch " + this._list.clientHeight + " m " + max);
      this._flyout.realign();
    }
  },
*/
  updateDeleteButton: function () {
    let checked = this._items.filter((aItem) => aItem.checked);
    let len = checked.length;

    this._deleteButton.disabled = (len == 0);
    this._deleteButton.label = (len > 1) ? "Delete (" + len + ")" : "Delete";
  },

  onCheckbox: function () {
    this.updateDeleteButton();
  },

  onDeleteButton: function () {
    let self = this;
    return Task.spawn(function onDeleteButtonTask() {
      let checked = self._items.filter((aItem) => aItem.checked);
      for (let item of checked) {
        yield Browser.unhighlight(item.highlight);
      }
      self._flyout.selectPage();
      self._flyout.realign();
    });
  }
};

function HighlightsListItem(aHighlight) {
  this.highlight = aHighlight;
}

HighlightsListItem.prototype = {
  _element: null,
  _elementText: null,
  _elementCheckbox: null,

  get element() {
    if (!this._element) {
      this._render();
    }
    return this._element;
  },

  get elementCheckbox() {
    if (!this._elementCheckbox) {
      this._render();
    }
    return this._elementCheckbox;
  },

  get checked() {
    return this._elementCheckbox.checked;
  },

  _render: function () {
    this._element = document.createElement("richlistitem");

    this._elementCheckbox = document.createElement("checkbox");
    this._element.appendChild(this._elementCheckbox);

    this._elementText = document.createElement("description");
    this._elementText.textContent = this.highlight.string;
    this._element.appendChild(this._elementText);
  }
};

let HighlightsUI = {
  get _panel() { return document.getElementById("highlights-container"); },
  get _popup() { return document.getElementById("highlights-popup"); },
  get _button() { return document.getElementById("star-button"); },

  __flyout: null,
  get _flyout() {
    if (!this.__flyout) {
      this.__flyout = new HighlightsFlyout(this._panel, this._popup);
      this.__flyout.controller = this;
    }
    return this.__flyout;
  },

  /**
   * Displays the popup, updated to match the current page.
   * @returns {Promise} Resolved when popup fully shown.
   */
  show: function HUI_show() {
    let self = this;
    return Task.spawn(function HUI_showTask() {
      try {
      let rect = self._button.getBoundingClientRect();
      let position = {
        xPos: (rect.left + rect.right) / 2,
        yPos: Elements.toolbar.getBoundingClientRect().top,
        centerHorizontally: true,
        bottomAligned: true
      };

      yield self._flyout.selectPage();
      yield self._flyout.show(position);
      self._flyout.resizePage();
      } catch(e) { Util.dumpLn(e);}
    });
  },

  /**
   * Event handlers.
   */

  onStarButton: function HUI_onStarButton() {
    return Task.spawn(function HUI_onStarButtonTask () {
      yield Appbar.update();
      yield HighlightsUI.show();
    });
  }
};
