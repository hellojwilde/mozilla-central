/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

XPCOMUtils.defineLazyModuleGetter(this, "View",
                                  "resource:///modules/View.jsm");

function TilePicker (aWrapper) {
  this._wrapper = aWrapper;

  this._leftButton = this._wrapper.querySelector(".tilepicker-left");
  this._rightButton = this._wrapper.querySelector(".tilepicker-right");
  this._noThumbsCheckbox = this._wrapper.querySelector("checkbox");

  this._leftButton.addEventListener("command", this.onLeftButton.bind(this), false);
  this._rightButton.addEventListener("command", this.onRightButton.bind(this), false);
  this._noThumbsCheckbox.addEventListener("command", this.onNoThumbs.bind(this), false);
}

TilePicker.prototype = {
  get _preview() { return this._wrapper.querySelector("richgriditem"); },

  get title() { return this._preview.label; },
  set title(aTitle) { return this._preview.label = aTitle; },

  get uri() { return this._preview.url; },
  set uri(aURI) {
    // XXX fragile if View changes
    let preview = this._preview;
    Util.getFaviconForURI(aURI)
        .then((iconURI) => View.prototype._gotIcon(preview, iconURI))
        .then(null, Components.utils.reportError);

    return this._preview.url = aURI;
  },

  get isThumbnail() { return Util.getBoolAttribute(this._wrapper, "thumbnail"); },
  set isThumbnail(aIsShowing) {
    this._noThumbsCheckbox.checked = !aIsShowing;
    this._preview.setAttribute("tiletype", "thumbnail");
    Util.setBoolAttribute(this._preview, "tiletype", aIsShowing, "thumbnail");
    Util.setBoolAttribute(this._wrapper, "thumbnail", aIsShowing);
    this.dispatchPick();
    return aIsShowing;
  },

  _imageSnippets: [],
  get imageSnippets() { return this._imageSnippets; },
  set imageSnippets(aImageSnippets) {
    this._imageSnippets = aImageSnippets || [];
    if (this._imageSnippets.length) {
      this.isThumbnail = true;
      this.selectedImageSnippetIndex = 0;
      this._noThumbsCheckbox.disabled = false;
    } else {
      this.isThumbnail = false;
      this._noThumbsCheckbox.disabled = true;
    }
    return this._imageSnippets;
  },

  _selectedImageSnippetIndex: 0,
  get selectedImageSnippetIndex() { return this._selectedImageSnippetIndex; },
  set selectedImageSnippetIndex(aIndex) {
    let len = this._imageSnippets.length;
    if (aIndex >= 0 && aIndex < len) {
      this._selectedImageSnippetIndex = aIndex;
      this._leftButton.disabled = aIndex <= 0;
      this._rightButton.disabled = aIndex >= len - 1;
      this._preview.backgroundImage = "url('" + this.selectedImageSnippet.uri + "')";
      this.dispatchPick();
    }
    return this._selectedImageSnippetIndex;
  },

  get selectedImageSnippet() { return this._imageSnippets[this._selectedImageSnippetIndex]; },
  set selectedImageSnippet(aSnippet) {
    let idx = -1;
    for (let i = 0, len = this._imageSnippets.length; i < len; i++) {
      if (this._imageSnippets[i].uri == aSnippet.uri) {
        idx = i;
        break;
      }
    }

    if (idx == -1) {
      this._imageSnippets.push(aSnippet);
      idx = this._imageSnippets.length -1;
    }

    this.selectedImageSnippetIndex = idx;
    this.dispatchPick();
    return aSnippet;
  },

  onLeftButton: function onLeftButton() {
    this.selectedImageSnippetIndex--;
  },

  onRightButton: function onRightButton() {
    this.selectedImageSnippetIndex++;
  },

  onNoThumbs: function onNoThumbs() {
    this.isThumbnail = !this._noThumbsCheckbox.checked;
  },

  dispatchPick: function dispatchPick() {
    if (this.parent && this.parent.onTilePick) {
      this.parent.onTilePick(this);
    }
  }
};