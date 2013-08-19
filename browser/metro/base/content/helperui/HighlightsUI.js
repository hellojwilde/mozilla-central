// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

XPCOMUtils.defineLazyModuleGetter(this, "View",
                                  "resource:///modules/View.jsm");

/**
 * Subclass of PagedFlyout that has an editing mode, preset pages,
 * and state autoupdating.
 */
function HighlightsFlyout(aPanel, aPopup) {
  PagedFlyout.call(this, aPanel, aPopup);

  this.registerPage("empty", new HighlightsEmpty(this));
  this.registerPage("bookmark", new HighlightsBookmark(this));
  this.registerPage("list", new HighlightsList(this));
}

HighlightsFlyout.prototype = Util.extend(Object.create(PagedFlyout.prototype), {
  get isEditing() { return this._popup.getAttribute("editing") == "true"; },
  set isEditing(aIsEditing) {
    Util.setBoolAttribute(this._popup, "editing", aIsEditing);
    return aIsEditing;
  },

  update: function HF_update() {

  },

  onBackButton: function HUI_onBackButton() {
    this.isEditing = false;
  },

  onEditButton: function HUI_onEditButton() {
    this.isEditing = true;
  },
});

HighlightsFlyout.prototype.constructor = HighlightsFlyout;

/**
 * Controller for "empty" page shown when there is no bookmark or highlights.
 */
function HighlightsEmpty(aFlyout, aPageElement) {
  this._flyout = aFlyout;
  this._page = aPageElement;

  this._markButton = this._page.getElementById("highlights-bookmark-button");
  this._markButton.addEventListener("command", this.onMarkButton.bind(this), false);
}

HighlightsEmpty.prototype = {
  onMarkButton: function () {
    let self = this;
    return Task.spawn(function HE_onMarkButtonTask () {
      let bookmarkId = yield Browser.starSite();
      yield self._flyout.display("bookmark", { id: bookmarkId, saved: true });
      yield self._flyout.align();
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

  this._removeButton = this._page.getElementById("highlights-remove-button");
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
      yield self._flyout.display("empty");
      yield self._flyout.align();
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

  this._deleteButton = this._page.getElementById("highlights-delete-button");
  this._deleteButton.addEventListener("click", this.onDeleteButton.bind(this), false);
}

HighlightsList.prototype = {
  _items: [],

  display: function (aOptions) {
    let { id } = aOptions || {};
    let highlights = Browser.getHighlights(id);

    while (this._list.childNodes.length > 0) {
      this._list.removeChild(list.firstChild);
    }

    let items = [];
    for (let highlight of this._highlights) {
      let item = new HighlightsListItem(highlight);
      items.push(item);
      this._list.appendChild(item.element);
    }
    this._items = items;
  },

  onDeleteButton: function () {
    let checked = this._items.filter((aItem) => aItem.checked);

    // TODO
    // commit changes
    // end editing
    // update flyout
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
      this._element = document.createElement("richlistitem");

      this._elementCheckbox = document.createElement("checkbox");
      this._element.appendChild(this._elementCheckbox);

      this._elementText = document.createElement("description");
      this._elementText.textContent = this.highlight.range.string;
      this._element.appendChild(this._elementText);
    }
    return this._element;
  },

  get checked() {
    return this._elementCheckbox.checked;
  }
};

let HighlightsUI = {
  get _panel() { return document.getElementById("highlights-container"); },
  get _popup() { return document.getElementById("highlights-popup"); },
  get _button() { return document.getElementById("star-button"); },

  __flyout: null,
  get _flyout() {
    if (!this.__flyout) {
      this.__flyout = new Flyout(this._panel, this._popup);
      this.__flyout.controller = this;
    }
    return this.__flyout;
  },

  /**
   * Displays the popup, updated to match the current page.
   * @returns {Promise} Resolved when popup fully shown.
   */
  show: function HUI_show() {
    return Task.spawn(function HUI_showTask() {
      yield HighlightsUI.update();

      let rect = HighlightsUI._button.getBoundingClientRect();
      let x = (rect.left + rect.right) / 2;
      let y = Elements.toolbar.getBoundingClientRect().top;
      let position = HighlightsUI._positionOptions = {
        xPos: x,
        yPos: y,
        centerHorizontally: true,
        bottomAligned: true
      };

      yield HighlightsUI._flyout.show(position);
    });
  },

  /**
   * Updates the flyout's contents to reflect status of the current page.
   * @returns {Promise} Resolved when update is complete.
   */
  update: function HUI_update() {
    return Task.spawn(function HUI_update_task() {
      let uri = Browser.selectedBrowser.currentURI;
      let bookmarkId = yield Bookmarks.getForURI(uri);

      if (bookmarkId == null) {
        // Empty page: no bookmark for current URI.
        HighlightsUI.showEmptyPage();
        return;
      }

      let highlights = Browser.getHighlights(bookmarkId);
      if (highlights.length == 0) {
        // Bookmark page: bookmark, but no highlights
        HighlightsUI.showBookmarkPage(bookmarkId);
      } else {
        // Highlights page: bookmark and highlights
        HighlightsUI.showHighlightsPage(bookmarkId);
      }
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
