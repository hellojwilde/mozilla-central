// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

XPCOMUtils.defineLazyModuleGetter(this, "View",
                                  "resource:///modules/View.jsm");

function Highlight(aRange, aApplyId) {
  this.range = aRange;
  this.applyId = aApplyId;
}

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

function HighlightsList(aFlyout, aPageElement) {
  this._flyout = aFlyout;

  this._page = aPageElement;
  this._list = this._page.getElementById("highlights-list-items");
  this._render();
}

HighlightsList.prototype = {
  _highlights: [],
  _items: [],

  get highlights() { return this._highlights; },
  set highlights (aHighlights) {
    this._highlights = aHighlights;
    this._render();
    return this._ranges;
  },

  get checkedHighlights() {
    let checked = [];
    for (let item of this._items) {
      if (item.checked) {
        checked.push(item.highlight);
      }
    }
    return checked;
  },

  _render: function () {
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
  }
};

let HighlightsUI = {
  __flyout: null,
  __page: "empty", // empty, bookmark, highlights

  _positionOptions: null,

  get _page() { return this.__page; },
  set _page(aPage) {
    if (aPage == "empty" || aPage == "bookmark" || aPage == "highlights") {
      this.__page = aPage;
      this._popup.setAttribute("page", aPage);
    }
    return this.__page;
  },

  get _isEditing() { return this._popup.getAttribute("editing") == "true"; },
  set _isEditing(aIsEditing) {
    if (aIsEditing) {
      this._popup.setAttribute("editing", "true");
    } else {
      this._popup.removeAttribute("editing");
    }
    return aIsEditing;
  },

  get _panel() { return document.getElementById("highlights-container"); },
  get _popup() { return document.getElementById("highlights-popup"); },
  get _button() { return document.getElementById("star-button"); },

  get _flyout() {
    if (!this.__flyout) {
      this.__flyout = new Flyout(this._panel, this._popup);
      this.__flyout.controller = this;
      this.__flyout.addEventListener("popuphidden",
                                     this.onPopupHidden.bind(this), false);
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
   * Page display methods.
   */

  showEmptyPage: function HUI_showEmptyPage() {
    this._page = "empty";
  },

  showBookmarkPage: function HUI_showBookmarkPage(aBookmarkId, aOptions) {
    let options = Util.extend({ saved: false }, aOptions || {});
    let browser = Browser.selectedBrowser;

    this._page = "bookmark";

    let page = document.getElementById("highlights-bookmark");
    if (options.saved) {
      page.setAttribute("saved", "true");
    } else {
      page.removeAttribute("saved");
    }

    let preview = document.getElementById("highlights-page-preview");
    preview.label = PlacesUtils.bookmarks.getItemTitle(aBookmarkId);
    preview.url = browser.currentURI;

    // XXX fragile if View changes
    Util.getFaviconForURI(browser.currentURI)
        .then((iconURI) => View.prototype._gotIcon(preview, iconURI));
  },

  showHighlightsPage: function HUI_showHighlightsPage(aBookmarkId) {
    this._page = "highlights";


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
   * Updates the flyout's position to reflect the new size of the contents.
   */
  reposition: function HUI_reposition() {
    let positionOptions = this._positionOptions;

    // XXX we have to run this twice. first time sets size properly.
    // second time sets the position given the new size
    this._flyout._position(positionOptions);
    this._flyout._position(positionOptions);
  },

  /**
   * Event handlers.
   */

  onStarButton: function HUI_onStarButton() {
    return Task.spawn(function HUI_onStarButtonTask () {
      yield Appbar.update();
      yield HighlightsUI.show();
    });
  },

  onBookmarkButton: function HUI_onSaveButton() {
    return Task.spawn(function HUI_onSaveButtonTask () {
      let bookmarkId = yield Browser.starSite();
      yield HighlightsUI.showBookmarkPage(bookmarkId, { saved: true });
      yield HighlightsUI.reposition();
      yield Appbar.update();
    });
  },

  onRemoveButton: function HUI_onRemoveButton() {
    return Task.spawn(function HUI_onRemoveButton () {
      yield Browser.unstarSite();
      yield HighlightsUI.showEmptyPage();
      yield HighlightsUI.reposition();
      yield Appbar.update();
    });
  },

  onBackButton: function HUI_onBackButton() {
    this._isEditing = false;
  },

  onEditButton: function HUI_onEditButton() {
    this._isEditing = false;
  },

  onDeleteButton: function HUI_onDeleteButton() {
    // delete the highlights both in the _highlights bin and on the list.
    // if all are deleted, drop the bookmark.
  },

  onPopupHidden: function HUI_onPopupHidden() {
    switch (this._page) {
      case "bookmark":
        // save changes to the rich bookmark snippet, which we don't have yet.
        break;
    }
  }
};
