/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var BookmarkCreatorUI = {
  get _flyout() { return document.getElementById("bookmarkpreview"); },
  get _pinButton() { return document.getElementById("pin-button"); },
  get _starButton() { return document.getElementById("star-button"); },

  init: function BC_init() {
    Elements.browsers.addEventListener('URLChanged', this, true);
    Elements.tabList.addEventListener('TabSelect', this, true);
    Elements.navbar.addEventListener('MozAppbarShowing', this, false);
  },

  onPinButton: function BC_onPinButton() {
    if (this._pinButton.checked) {
      Browser.pinSite();
    } else {
      Browser.unpinSite();
    }
  },

  onStarButton: function BC_onStarButton(aValue) {
    this._flyout.openFlyout(this._starButton, "before_center");

    if (aValue === undefined) {
      aValue = this._button.checked;
    }

    if (aValue) {
      Browser.starSite(() => BookmarkCreatorUI._updateStarButton());
    } else {
      Browser.unstarSite(() => BookmarkCreatorUI._updateStarButton());
    }
  },

  update: function BP_update() {
    this._updateStarButton();
    this._updatePinButton();
  },

  handleEvent: function BC_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "URLChanged":
      case "TabSelect":
      case "MozAppbarShowing":
        this.update();
        break;
    }
  },

  /* Internal Helpers */

  _updateStarButton: function BP__updateStarButton() {
    Browser.isSiteStarredAsync(function (isStarred) {
      this._starButton.checked = isStarred;
    }.bind(this));
  },

  _updatePinButton: function() {
    this._pinButton.checked = Browser.isSitePinned();
  }
};