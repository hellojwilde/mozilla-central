// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let HighlightsUI = {
  __flyout: null,
  __page: "empty", // empty, bookmark, highlights

  get _page() { return __page; },
  set _page(aPage) {
    if (aPage == "empty" || aPage == "bookmark" || aPage == "highlights") {
      this.__page = aPage;
      this._popup.setAttribute("page", aPage);
    }
    return this.__page;
  },

  get _panel() { return document.getElementById("highlights-container"); },
  get _popup() { return document.getElementById("highlights-popup"); },
  get _button() { return document.getElementById("star-button"); },

  get _flyout() {
    if (!this.__flyout) {
      this.__flyout = new Flyout(this._panel, this._popup);
      this.__flyout.controller = this;
    }
    return this.__flyout;
  },

  show: function HUI_show() {
    return Task.spawn(function HUI_show_task() {
      yield HighlightsUI.update();

      let x = HighlightsUI._button.getBoundingClientRect().left;
      let y = Elements.toolbar.getBoundingClientRect().top;

      yield HighlightsUI._flyout.show({
        xPos: x,
        yPos: y,
        leftAligned: true,
        bottomAligned: true
      });
    });
  },

  /**
   * State updater.
   */

  update: function HUI_update() {
    return Task.spawn(function HUI_update_task() {
      let uri = Browser.selectedBrowser.currentURI;
      let bookmarkId = yield Bookmarks.getForURI(uri);

      if (bookmarkId == null) {
        // Empty page: no bookmark for current URI.
        this._page = "empty";
        return;
      }

      try {
        let json = PlacesUtils.annotations.
          getItemAnnotation(bookmarkId, "highlights");
        let highlights = JSON.parse(json);
      } catch (e) { /* there were no highlights */ }

      if (!highlights) {
        // Bookmark page: bookmark, but no highlights
        this._page = "bookmark";
        yield HighlightsUI.updateBookmarkPage(bookmarkId);
      } else {
        // Highlights page: bookmark and highlights
        this._page = "highlights";
        yield HighlightsUI.updateHighlightsPage(bookmarkId);
      }
    });
  },

  updateBookmarkPage: function HUI_updateBookmarkPage(aBookmarkId) {

  },

  updateHighlightsPage: function HUI_updateHighlightsPage(aBookmarkId) {

  },

  /**
   * Event handlers.
   */

  onStarButton: function HUI_onStarButton() {
    this.show();
  },

  onBackButton: function HUI_onBackButton() {

  },

  onEditButton: function HUI_onEditButton() {

  },

  onDeleteButton: function HUI_onDeleteButton() {

  }
};
