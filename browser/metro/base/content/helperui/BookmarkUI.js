// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const kThumbAnno = "snippets/tileThumbnail";

/**
 * Subclass of PagedFlyout that has an editing mode, preset pages,
 * and state updating.
 */
function BookmarkFlyout(aPanel, aPopup) {
  PagedFlyout.call(this, aPanel, aPopup);

  this.registerPage("bookmark", new BookmarkBookmark(this, aPopup));
  this.registerPage("lists", new BookmarkLists(this, aPopup));
}

BookmarkFlyout.prototype = Util.extend(Object.create(PagedFlyout.prototype), {
  selectPage: function HF_selectPage() {
    let self = this;
   /* return Task.spawn(function HUI_updateTask() {
      let uri = Browser.selectedBrowser.currentURI;
      let bookmarkId = yield Bookmarks.getForURI(uri);
      self.displayPage("bookmark", { id: bookmarkId });
    });*/
  }
});

BookmarkFlyout.prototype.constructor = BookmarkFlyout;

/**
 * Controller for the page that lets users twiddle settings about the bookmark.
 */

function BookmarkBookmark(aFlyout, aFlyoutElement) {
  this._flyout = aFlyout;
  this._page = aFlyoutElement.querySelector(".bookmarks-page-bookmark");
}

/**
 * Controller for the page that lets users manually select the list
 * to add the item to.
 */

function BookmarkLists(aFlyout, aFlyoutElement) {
  this._flyout = aFlyout;
  this._page = aFlyoutElement.querySelector(".bookmarks-page-lists");
}


/**
 * Controller for "bookmark" page shown when there is a bookmark,
 * but no highlights.
 */
function HighlightsBookmark(aFlyout, aFlyoutElement) {
  this._flyout = aFlyout;

  this._page = aFlyoutElement.querySelector(".highlights-page-bookmark");
  this._picker = new TilePicker(this._page.querySelector(".tilepicker"));
  this._picker.parent = this;
  this._removeButton = this._page.querySelector(".highlights-remove-button");

  // XXX this isn't a super clean way to do this.
  this._flyout._panel.addEventListener("popuphidden", this.onFlyoutHidden.bind(this), false);
  this._removeButton.addEventListener("command", this.onRemoveButton.bind(this), false);
}

HighlightsBookmark.prototype = {
  display: function (aOptions) {
    let { id, saved } = aOptions || {};

    Util.setBoolAttribute(this._page, "saved", saved);

    this._id = id;

    this._picker.title = PlacesUtils.bookmarks.getItemTitle(id);
    this._picker.uri = Browser.selectedBrowser.currentURI;
    this._picker.imageSnippets = Browser.selectedTab.snippets.ImageSnippet;

    try {
      let json = PlacesUtils.annotations.getItemAnnotation(id, kThumbAnno);
      let settings = JSON.parse(json);

      this._picker.selectedImageSnippet = settings.selectedImageSnippet;
      this._picker.isThumbnail = settings.isThumbnail;
    } catch (e) { /* there was no snippet data */ }
  },

  onRemoveButton: function () {
    let self = this;
    return Task.spawn(function HE_onRemoveButton () {
      yield Browser.unstarSite();
      yield Appbar.update();
      self._flyout.hide();
    });
  },

  onTilePick: function () {
    this._flyout.realign();
  },

  onFlyoutHidden: function () {
    if (!this.active) {
      return;
    }

    let json = JSON.stringify({
      selectedImageSnippet: this._picker.selectedImageSnippet,
      isThumbnail: this._picker.isThumbnail
    });

    let anno = PlacesUtils.annotations;
    anno.setItemAnnotation(this._id, kThumbAnno, json, 0, anno.EXPIRE_NEVER);
  }
};

let BookmarkUI = {
  get _panel() { return document.getElementById("bookmark-container"); },
  get _popup() { return document.getElementById("bookmark-popup"); },
  get _button() { return document.getElementById("star-button"); },

  __flyout: null,
  get _flyout() {
    if (!this.__flyout) {
      this.__flyout = new BookmarkFlyout(this._panel, this._popup);
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
      } catch(e) {
        Util.dumpLn(e);
      }
    });
  },

  /**
   * Event handlers.
   */

  onStarButton: function HUI_onStarButton() {
    return Task.spawn(function HUI_onStarButtonTask () {
      yield Appbar.update();
      yield BookmarkUI.show();
    });
  }
};
